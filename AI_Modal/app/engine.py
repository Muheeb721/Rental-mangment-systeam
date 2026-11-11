"""Chat pipeline: NLU -> session memory -> MongoDB search / travel / areas -> LLM or template reply.

    handle_message(message, session_id, property_id=None) -> {"reply", "properties", "intent", ...}

"Current property" = the property the user is viewing on the website (property_id from the
request) or the last property discussed in the chat ("the second one"). Questions such as
"how far is this from LUMS" or "is it furnished?" are answered about that property.
"""
from __future__ import annotations

import json
import logging
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Any

from app import config
from app.nlu import _amounts, parse_message
from app.services import backend_api
from app.services.gazetteer import all_places
from app.services.llm import GROUNDED_PROMPT, SYSTEM_PROMPT, llm
from app.services.property_catalog import (
    areas_with_listings,
    get_property,
    haversine_km,
    listing_in_area,
    load_listings,
    log_unanswered_query,
    nearby_areas,
    norm,
    search_properties,
    type_matches,
)
from app.services.travel import (
    MODES,
    mode_label,
    monthly_commute,
    public_travel,
    travel_between,
    travel_estimate,
)

log = logging.getLogger("rms.engine")
PAGE = max(1, min(config.MAX_PROPERTIES, 6))
FILTER_KEYS = ("area", "near", "property_type", "purpose", "min_budget", "max_budget",
               "bedrooms", "bedrooms_mode", "furnished", "sort", "max_minutes", "radius_km")
_pool = ThreadPoolExecutor(max_workers=6)

# ---------------------------------------------------------------------------
# sessions
# ---------------------------------------------------------------------------
_sessions: dict[str, dict[str, Any]] = {}
_sessions_lock = threading.Lock()


def _new_session() -> dict[str, Any]:
    return {"filters": {}, "results": [], "offset": 0, "shown": [], "history": [],
            "note": "", "current": None, "page_property_id": None, "last_travel": None,
            "updated": time.time()}


def get_session(session_id: str) -> dict[str, Any]:
    now = time.time()
    with _sessions_lock:
        if len(_sessions) > 2000 or now % 50 < 1:
            for sid in [s for s, v in _sessions.items() if now - v["updated"] > config.SESSION_TTL_SECONDS]:
                _sessions.pop(sid, None)
        session = _sessions.get(session_id)
        if session is None or now - session["updated"] > config.SESSION_TTL_SECONDS:
            session = _sessions[session_id] = _new_session()
        session["updated"] = now
        return session


def reset_sessions() -> None:
    with _sessions_lock:
        _sessions.clear()


# ---------------------------------------------------------------------------
# formatting helpers
# ---------------------------------------------------------------------------
def pkr(amount: int | float) -> str:
    amount = int(amount or 0)
    if amount >= 10_000_000:
        return f"PKR {amount / 10_000_000:.2f}".rstrip("0").rstrip(".") + " crore"
    if amount >= 1_000_000 and amount % 100_000 == 0:
        return f"PKR {amount / 100_000:g} lakh"
    return f"PKR {amount:,}"


def price_text(item: dict[str, Any]) -> str:
    if not item.get("amount"):
        return "price on request"
    if item["purpose"] == "Rent":
        return f"{pkr(item['amount'])}/month"
    return pkr(item["amount"])


def location_text(item: dict[str, Any]) -> str:
    parts = []
    for value in (item.get("block"), item.get("area_name") or item.get("location"), item.get("city")):
        if value and value not in parts:
            parts.append(value)
    return ", ".join(parts)


def size_text(item: dict[str, Any]) -> str:
    if not item.get("area"):
        return ""
    value = item["area"]
    value = f"{value:,}" if isinstance(value, int) else f"{value:g}"
    return f"{value} {item.get('areaUnit') or 'sq ft'}"


def minutes_text(m: dict[str, Any]) -> str:
    lo, hi = m["time_min"], m.get("time_peak") or m["time_min"]
    return f"{lo}-{hi} min" if hi > lo + 1 else f"{lo} min"


def listing_line(n: int, item: dict[str, Any]) -> str:
    bits = [price_text(item), location_text(item)]
    if item.get("bedrooms") or item.get("bathrooms"):
        bits.append(f"{item.get('bedrooms', 0)} bed / {item.get('bathrooms', 0)} bath")
    if size_text(item):
        bits.append(size_text(item))
    if item.get("furnished"):
        bits.append(item["furnished"])
    if item.get("amenities"):
        bits.append("amenities: " + ", ".join(item["amenities"][:4]))
    if item.get("_travel"):
        t = item["_travel"]
        bits.append(f"~{t['distance_km']} km to {t['to']} (~{t['time_min']} min by {t['label'].lower()}"
                    + (f", ~PKR {t['cost']:,} one-way" if t.get("cost") else "") + ")")
    return f"{n}. {item['title']} ({item['propertyType']} for {item['purpose'].lower()}) - " + " | ".join(bits)


def public_property(item: dict[str, Any]) -> dict[str, Any]:
    """Exact shape the RMS chat widget expects (+ distanceKm / travelMinutes when relevant)."""
    out = {k: item.get(k) for k in ("_id", "title", "purpose", "propertyType", "price", "rent", "city",
                                    "location", "society", "bedrooms", "bathrooms", "area",
                                    "areaUnit", "image")}
    if item.get("_travel"):
        out["distanceKm"] = item["_travel"]["distance_km"]
        out["travelMinutes"] = item["_travel"]["time_min"]
        out["travelMode"] = item["_travel"]["mode"]
        out["travelTo"] = item["_travel"]["to"]
    return out


def llm_property(item: dict[str, Any]) -> dict[str, Any]:
    data = {
        "title": item["title"], "purpose": item["purpose"], "type": item["propertyType"],
        "price_pkr": item["amount"], "price_text": price_text(item),
        "area_or_society": item["area_name"], "phase": item["phase"], "block": item["block"],
        "address": item["address"], "city": item["city"], "bedrooms": item["bedrooms"],
        "bathrooms": item["bathrooms"], "size": size_text(item) or "not listed",
        "furnished": item["furnished"] or "not listed", "amenities": item["amenities"][:6],
        "description": item["description"][:160],
    }
    if item.get("deposit"):
        data["deposit_pkr"] = item["deposit"]
    if item.get("_travel"):
        t = item["_travel"]
        data["travel"] = {"to": t["to"], "mode": t["label"], "distance_km": t["distance_km"],
                          "travel_minutes": t["time_min"], "peak_minutes": t.get("time_peak"),
                          "one_way_cost_pkr": t.get("cost")}
    return data


def full_property(item: dict[str, Any]) -> dict[str, Any]:
    """Every listed fact about one property (no owner contact details) for grounded Q&A."""
    def listed(v, suffix=""):
        return f"{v}{suffix}" if v not in (None, "", 0) else "not listed"

    year = item.get("year_built")
    data = {
        "title": item["title"], "type": item["propertyType"], "purpose": item["purpose"],
        "price": price_text(item), "price_pkr": item["amount"],
        "deposit": pkr(item["deposit"]) if item.get("deposit") else "not listed",
        "other_monthly_charges": pkr(item["other_charges"]) if item.get("other_charges") else "not listed",
        "address": item.get("address") or "not listed", "area": item["area_name"], "block": item.get("block") or "",
        "city": item["city"], "bedrooms": listed(item["bedrooms"]), "bathrooms": listed(item["bathrooms"]),
        "size": size_text(item) or "not listed", "furnished": item["furnished"] or "not listed",
        "parking_spaces": listed(item.get("parking")),
        "floor": ("ground" if item.get("floor") == 0 and item.get("total_floors") else listed(item.get("floor"))),
        "total_floors": listed(item.get("total_floors")),
        "year_built": year or "not listed",
        "age_years": (datetime.now().year - year) if year else "not listed",
        "amenities": item["amenities"] or "not listed",
        "description": item["description"] or "not listed",
        "status": item["status"],
        "listed_on": item.get("listed_at") or "not listed",
    }
    return data


def describe_filters(f: dict[str, Any]) -> str:
    parts = []
    if f.get("bedrooms"):
        parts.append(f"{f['bedrooms']}{'+' if f.get('bedrooms_mode') == 'min' else ''} bed")
    if f.get("furnished"):
        parts.append(f["furnished"])
    parts.append((f.get("property_type") or "propert").lower() + ("ies" if not f.get("property_type") else "s"))
    if f.get("purpose"):
        parts.append(f"for {f['purpose'].lower()}")
    if f.get("area"):
        parts.append(f"in {f['area']['name']}")
    elif f.get("near"):
        if f.get("max_minutes"):
            parts.append(f"within {f['max_minutes']} min of {f['near']['name']}")
        else:
            parts.append(f"near {f['near']['name']}")
    if f.get("min_budget") and f.get("max_budget"):
        parts.append(f"between {pkr(f['min_budget'])} and {pkr(f['max_budget'])}")
    elif f.get("max_budget"):
        parts.append(f"under {pkr(f['max_budget'])}")
    elif f.get("min_budget"):
        parts.append(f"above {pkr(f['min_budget'])}")
    return " ".join(parts).replace("flats", "flats/apartments")


def filters_for_response(f: dict[str, Any]) -> dict[str, Any]:
    out = {}
    for k in FILTER_KEYS:
        v = f.get(k)
        if v in (None, "", False):
            continue
        out[k] = v["name"] if isinstance(v, dict) else v
    return out


def property_place(item: dict[str, Any]) -> dict[str, Any] | None:
    if item.get("lat") is None:
        return None
    return {"name": f"{item['title']}", "short": f"this property ({item['area_name']})",
            "lat": item["lat"], "lng": item["lng"], "property_id": item["_id"] if item.get("has_coords") else None}


# ---------------------------------------------------------------------------
# search with graceful relaxation
# ---------------------------------------------------------------------------
def _within_minutes(items: list[dict], near: dict, max_minutes: int, mode: str) -> list[dict]:
    out = []
    for item in items:
        if item["lat"] is None:
            continue
        est = travel_estimate(item["lat"], item["lng"], near["lat"], near["lng"])
        if mode in est["modes"] and est["modes"][mode]["time_min"] <= max_minutes:
            out.append(item)
    return out


def _run(f: dict[str, Any]) -> list[dict[str, Any]]:
    near = f.get("near")
    kwargs = dict(area=f.get("area"), property_type=f.get("property_type"), purpose=f.get("purpose"),
                  max_budget=f.get("max_budget"), min_budget=f.get("min_budget"),
                  bedrooms=f.get("bedrooms"), bedrooms_mode=f.get("bedrooms_mode") or "exact",
                  furnished=f.get("furnished"), sort=f.get("sort") or "price_asc")
    if near and near.get("lat") is not None:
        radius = f.get("radius_km") or 6
        if f.get("max_minutes"):
            radius = max(radius, f["max_minutes"] / 60 * 40)       # generous prefilter, exact check below
        kwargs.update(near=(near["lat"], near["lng"]), radius_km=radius)
        if not f.get("sort"):
            kwargs["sort"] = "distance"
    results = search_properties(**kwargs)
    if near and f.get("max_minutes"):
        results = _within_minutes(results, near, f["max_minutes"], f.get("mode") or "car")
    return results


def search_with_relaxation(f: dict[str, Any]) -> tuple[list[dict[str, Any]], str]:
    results = _run(f)
    if results:
        return results, ""
    target = describe_filters(f)
    steps: list[tuple[str, dict[str, Any]]] = []
    g = dict(f)
    if g.get("near"):
        if g.get("max_minutes"):
            g["max_minutes"] = int(g["max_minutes"] * 1.6)
            steps.append((f"Nothing that close, so I widened it to {g['max_minutes']} min by "
                          f"{mode_label(g.get('mode') or 'car').lower()}.", dict(g)))
        else:
            g["radius_km"] = 12
            steps.append((f"Nothing within 6 km of {g['near']['name']}, so I widened the radius to 12 km.", dict(g)))
    if g.get("bedrooms") and g.get("bedrooms_mode", "exact") == "exact":
        g["bedrooms_mode"] = "min"
        steps.append((f"No exact {g['bedrooms']}-bedroom match, so these have {g['bedrooms']} or more bedrooms.", dict(g)))
    if g.get("furnished"):
        g["furnished"] = None
        steps.append(("No listing is marked as that furnishing, so I ignored the furnished filter.", dict(g)))
    if g.get("max_budget"):
        g["max_budget"] = int(g["max_budget"] * 1.2)
        steps.append((f"Nothing within your budget; these are up to 20% above it (max {pkr(g['max_budget'])}).", dict(g)))
    if g.get("bedrooms"):
        g["bedrooms"] = None
        steps.append(("No match with that bedroom count, so I dropped the bedroom filter.", dict(g)))
    for note, attempt in steps:
        results = _run(attempt)
        if results:
            return results, f"I couldn't find exact matches for {target}. {note}"

    area = f.get("area")
    if area:
        others = dict(f, area=None)
        candidates = _run(others)
        near = nearby_areas(area, candidates)
        if near:
            names = [n for n, _, _ in near]
            results = [c for c in candidates if c["area_name"] in names]
            results.sort(key=lambda c: names.index(c["area_name"]))
            listing = ", ".join(f"{n} (~{d} km away, {k} listing{'s' if k > 1 else ''})" for n, d, k in near)
            return results, (f"No {describe_filters(dict(f, area=None))} found in {area['name']}. "
                             f"Nearest areas with matches: {listing}.")
        in_area = _run({"area": area, "purpose": f.get("purpose")}) or _run({"area": area})
        if in_area:
            return in_area, (f"Nothing in {area['name']} matches {target}. Here is what is available "
                             f"in {area['name']} right now.")
    if f.get("near") and not f.get("area"):
        wide = _run(dict(f, radius_km=25, max_minutes=None, max_budget=None))
        if wide:
            return wide, (f"Nothing close to {f['near']['name']} matches {target}. These are the nearest "
                          f"matching listings (ignoring the budget).")
    if f.get("property_type"):
        relaxed = _run(dict(f, property_type=None, area=f.get("area")))
        if relaxed:
            return relaxed, f"No {f['property_type'].lower()} matches; here are other property types."
    return [], f"Sorry, there are no available listings matching {target} right now."


def annotate_travel(items: list[dict], dest: dict, mode: str, use_backend: bool = True) -> list[dict]:
    """Copy items and attach _travel (distance / minutes / cost to dest). Website API for the
    shown page (parallel, short timeout), local estimate otherwise."""
    out = [dict(i) for i in items]

    def one(item):
        place = property_place(item)
        if not place:
            return None
        return travel_between(place, dest, allow_backend=use_backend)

    ests = list(_pool.map(one, out)) if use_backend else [one(i) for i in out]
    for item, est in zip(out, ests):
        if not est:
            continue
        m = mode if mode in est["modes"] else ("car" if "car" in est["modes"] else next(iter(est["modes"])))
        item["_travel"] = {"to": dest["name"], "mode": m, "label": est["modes"][m]["label"],
                           "distance_km": est["distance_km"], "time_min": est["modes"][m]["time_min"],
                           "time_peak": est["modes"][m].get("time_peak"),
                           "cost": est["modes"][m]["one_way_pkr"], "source": est.get("source")}
    return out


# ---------------------------------------------------------------------------
# grounding check (money, km, minutes)
# ---------------------------------------------------------------------------
_ALLOWED_SMALL = 1000
_KM = re.compile(r"(\d+(?:\.\d+)?)\s*(?:-|–|to)?\s*(\d+(?:\.\d+)?)?\s*(?:km|kilomet)", re.I)
_MIN = re.compile(r"(\d+)\s*(?:-|–|to)?\s*(\d+)?\s*(?:min\b|mins\b|minutes?\b|minat)", re.I)
_SMALL_PKR = re.compile(r"(?:pkr|rs\.?)\s*~?\s*(\d{1,3})(?![\d,.])", re.I)


def _collect(data: Any) -> tuple[set[int], list[float]]:
    money: set[int] = set()
    nums: list[float] = []

    def walk(v):
        if isinstance(v, bool):
            return
        if isinstance(v, (int, float)):
            money.add(int(v))
            nums.append(float(v))
        elif isinstance(v, dict):
            for x in v.values():
                walk(x)
        elif isinstance(v, (list, tuple)):
            for x in v:
                walk(x)
        elif isinstance(v, str):
            for value, _, _ in _amounts(v):
                money.add(value)
            for n in re.findall(r"\d+(?:\.\d+)?", v):
                nums.append(float(n))
    walk(data)
    return money, nums


def _grounded(reply: str, data: dict[str, Any]) -> bool:
    """Reject LLM text that states money, distances or minutes not present in the data."""
    money, nums = _collect(data)
    for value, _, _ in _amounts(reply):
        if value < _ALLOWED_SMALL:
            continue
        if not any(abs(value - a) <= max(1, a * 0.02) for a in money if a):
            log.info("LLM reply rejected: amount %s not in data", value)
            return False

    def close(v: float, tol_abs: float, tol_rel: float) -> bool:
        return any(abs(v - n) <= max(tol_abs, n * tol_rel) for n in nums)

    for m in _SMALL_PKR.finditer(reply):
        v = float(m.group(1))
        if not close(v, 5, 0.05):
            log.info("LLM reply rejected: PKR %s not in data", v)
            return False
    for m in _KM.finditer(reply):
        for g in (m.group(1), m.group(2)):
            if g and not close(float(g), 0.3, 0.15):
                log.info("LLM reply rejected: %s km not in data", g)
                return False
    for m in _MIN.finditer(reply):
        lo, hi = m.group(1), m.group(2)
        for g in (lo, hi):
            if g and not close(float(g), 2, 0.2):
                log.info("LLM reply rejected: %s min not in data", g)
                return False
    return True


def llm_reply(session: dict, message: str, data: dict[str, Any], fallback: str,
              prompt: str = SYSTEM_PROMPT, max_tokens: int = 700) -> tuple[str, bool]:
    if not llm.enabled:
        return fallback, False
    history = session["history"][-2:]       # keep prompts small: free tiers limit tokens per minute
    messages = [{"role": "system", "content": prompt}]
    for turn in history:
        messages.append({"role": turn["role"], "content": turn["content"][:300]})
    messages.append({"role": "user", "content": (
        f"User message: {message}\n\nDATA (the only facts you may use):\n"
        f"{json.dumps(data, ensure_ascii=False, default=str, separators=(',', ':'))}")})
    text = llm.chat(messages, max_tokens=max_tokens)
    if text and _grounded(text, data):
        return text, True
    return fallback, False


# ---------------------------------------------------------------------------
# small talk
# ---------------------------------------------------------------------------
def _available_areas_hint(limit: int = 6) -> str:
    areas = sorted(areas_with_listings(), key=lambda a: -a["listing_count"])[:limit]
    return ", ".join(a["name"] for a in areas)


GREETING = {
    "english": ("Hello! I'm the RMS property assistant. Ask me anything about properties in Lahore, e.g. "
                "\"3 bed house for rent in Johar Town under 150k\", \"flats near UCP under 80k\", "
                "\"how far is this from LUMS?\" or \"average rent in Bahria Town\"."),
    "roman": ("Assalam o Alaikum! Main RMS property assistant hoon. Batayein kya chahiye, misal: "
              "\"Johar Town mein 3 bed ghar 150k tak\" ya \"UCP ke paas flat\". Main travel time aur "
              "kharcha bhi bata sakta hoon."),
}


def help_text() -> str:
    hint = _available_areas_hint()
    return ("I can help you with:\n"
            "- Searching listings anywhere in Lahore: area, type, rent or sale, budget, bedrooms, furnished\n"
            "- Near a place: \"flats near UCP under 80k\", \"houses within 15 minutes of LUMS by car\"\n"
            "- The property you're viewing: \"how far is this from LUMS?\", \"is it furnished?\", "
            "\"what's nearby?\", \"monthly commute to UCP by bike?\"\n"
            "- Follow-ups: \"only 4 bedrooms\", \"cheaper ones\", \"show more\", \"compare the first two\"\n"
            "- Areas: \"average rent in Johar Town\", \"which area is cheapest for a 3 bed house?\"\n"
            "- Travel estimates: \"DHA Phase 5 to LUMS by bike\"\n"
            "- \"start over\" clears your filters."
            + (f"\nAreas with listings right now: {hint}." if hint else ""))


def template_search_reply(lead: str, shown: list[dict], start: int, total: int, note: str) -> str:
    lines = []
    if note:
        lines.append(note)
    lines.append(lead)
    lines += [listing_line(start + i + 1, item) for i, item in enumerate(shown)]
    remaining = total - (start + len(shown))
    if remaining > 0:
        lines.append(f"There {'is' if remaining == 1 else 'are'} {remaining} more - say \"show more\". "
                     "Ask \"tell me about the first one\" or \"compare the first two\".")
    else:
        lines.append("Ask \"tell me about the first one\", \"compare the first two\", or refine with budget / bedrooms.")
    return "\n".join(lines)


def template_details(item: dict[str, Any], n: int | None) -> str:
    head = f"#{n} {item['title']}" if n else item["title"]
    lines = [head,
             f"- Price: {price_text(item)}" + (f" (deposit {pkr(item['deposit'])})" if item.get("deposit") else ""),
             f"- Type: {item['propertyType']} for {item['purpose'].lower()}",
             f"- Location: {', '.join(x for x in (item['address'] or '', item['area_name'], item['city']) if x)}",
             f"- Bedrooms / bathrooms: {item['bedrooms']} / {item['bathrooms']}",
             f"- Size: {size_text(item) or 'not listed'}",
             f"- Furnished: {item['furnished'] or 'not listed'}",
             f"- Parking: {item['parking'] if item.get('parking') else 'not listed'}",
             f"- Built: {item['year_built'] or 'not listed'}",
             f"- Amenities: {', '.join(item['amenities']) if item['amenities'] else 'not listed'}",
             f"- Status: {item['status']}"]
    if item.get("description"):
        lines.append(f"- About: {item['description'][:300]}")
    lines.append("Open the property card to see photos and to book a visit or contact the owner through RMS.")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# session helpers
# ---------------------------------------------------------------------------
def _merge_filters(session: dict, slots: dict[str, Any], intent: str, message: str) -> dict[str, Any]:
    old = dict(session["filters"])
    fresh = (intent in ("search_property", "property_with_travel", "price_inquiry", "near_search")
             and (slots.get("area") or slots.get("near")) and slots.get("property_type"))
    f = {} if fresh else old
    if slots.get("area"):
        f["area"], f["near"] = slots["area"], None
        f.pop("max_minutes", None)
    elif slots.get("near"):
        f["near"], f["area"] = slots["near"], None
    for key in ("property_type", "purpose", "furnished"):
        if slots.get(key):
            f[key] = slots[key]
    if slots.get("max_budget") is not None or slots.get("min_budget") is not None:
        f["max_budget"], f["min_budget"] = slots.get("max_budget"), slots.get("min_budget")
    if slots.get("bedrooms") is not None:
        f["bedrooms"], f["bedrooms_mode"] = slots["bedrooms"], slots.get("bedrooms_mode") or "exact"
    shown_amounts = [i["amount"] for i in session.get("shown") or [] if i.get("amount")]
    if slots.get("cheaper"):
        if shown_amounts and not slots.get("max_budget"):
            f["max_budget"] = int(sum(shown_amounts) / len(shown_amounts) // 1000 * 1000)
            f["min_budget"] = None
        f["sort"] = "price_asc"
    elif slots.get("pricier"):
        if shown_amounts and not slots.get("min_budget"):
            f["min_budget"] = int(sum(shown_amounts) / len(shown_amounts) // 1000 * 1000 + 1000)
            f["max_budget"] = None
        f["sort"] = "price_desc"
    return f


def _pick(session: dict, ordinal: int | None) -> tuple[dict | None, int]:
    shown = session.get("shown") or []
    if not shown:
        return None, 0
    if ordinal is None:
        return (shown[0], 1) if len(shown) == 1 else (None, 0)
    if ordinal < 0:
        idx = len(shown) + ordinal
        return (shown[idx], session["offset"] - len(shown) + idx + 1) if 0 <= idx < len(shown) else (None, 0)
    start = session["offset"] - len(shown)
    idx = ordinal - 1 - start if ordinal > start else ordinal - 1
    if 0 <= idx < len(shown):
        return shown[idx], start + idx + 1
    if 0 <= ordinal - 1 < len(session["results"]):
        return session["results"][ordinal - 1], ordinal
    return None, 0


def _set_current(session: dict, item: dict | None) -> None:
    if item:
        session["current"] = {k: v for k, v in item.items() if k != "_travel"}


def _sync_page_property(session: dict, property_id: str | None) -> None:
    """The property open on the website becomes the current property when the page changes."""
    if not property_id or property_id == session.get("page_property_id"):
        return
    item = get_property(property_id)
    session["page_property_id"] = property_id
    if item:
        _set_current(session, item)


def _context_property(session: dict, slots: dict[str, Any]) -> tuple[dict | None, int | None]:
    ordinal = slots.get("ordinal")
    if ordinal is not None and session["shown"]:
        item, n = _pick(session, ordinal)
        if item:
            _set_current(session, item)
            return item, n
    if session.get("current"):
        return session["current"], None
    if len(session["shown"]) == 1:
        _set_current(session, session["shown"][0])
        return session["shown"][0], 1
    return None, None


def _places_in(slots: dict[str, Any]) -> list[dict]:
    out = []
    for key in ("origin", "destination", "near", "area"):
        p = slots.get(key)
        if p and p.get("lat") is not None and all(p["name"] != q["name"] for q in out):
            out.append(p)
    return out


# ---------------------------------------------------------------------------
# travel
# ---------------------------------------------------------------------------
_DEFAULT_MODES = ("car", "bike", "rickshaw")


def travel_text(origin_name: str, dest_name: str, est: dict, mode: str | None,
                commute: dict | None = None) -> str:
    modes = [mode] if mode in est["modes"] else [m for m in _DEFAULT_MODES if m in est["modes"]]
    lines = [f"{origin_name[:1].upper()}{origin_name[1:]} to {dest_name}: about {est['distance_km']} km by road (estimate)."]
    for m in modes:
        info = est["modes"][m]
        cost = f", ~PKR {info['one_way_pkr']:,} one-way" if info["one_way_pkr"] else ""
        lines.append(f"- {info['label']}: ~{minutes_text(info)}{cost}")
    if not mode:
        extra = [m for m in ("ride_hailing", "metro", "bus") if m in est["modes"]]
        if extra:
            lines.append("Also: " + ", ".join(
                f"{est['modes'][m]['label'].lower()} ~{est['modes'][m]['time_min']} min" for m in extra[:2]) + ".")
    if commute:
        lines.append(f"Daily commute by {commute['label'].lower()}: ~PKR {commute['round_trip_pkr']:,} per round trip, "
                     f"about PKR {commute['monthly_pkr']:,} a month ({commute['days']} working days), "
                     f"~{commute['daily_minutes']} min on the road per day.")
    lines.append("Times range from normal to peak-hour traffic; costs are approximate."
                 + (" Same estimate as the website." if est.get("source") == "website" else ""))
    return "\n".join(lines)


def _resolve_travel(session: dict, slots: dict[str, Any], intent: str) -> tuple[dict | None, dict | None, str | None]:
    """Returns (origin, dest, problem). The current property is used when only one place is named."""
    places_ = [p for p in (slots.get("origin"), slots.get("destination")) if p and p.get("lat") is not None]
    if not places_ and slots.get("near"):
        places_ = [slots["near"]]
    current, _ = _context_property(session, slots) if (
        slots.get("this_ref") or slots.get("ordinal") is not None or len(places_) <= 1) else (None, None)
    if len(places_) >= 2 and not (slots.get("this_ref") and current):
        return places_[0], places_[1], None
    if len(places_) >= 1:
        target = places_[-1] if len(places_) > 1 else places_[0]
        if current and property_place(current):
            p = property_place(current)
            p["name"] = p["short"]
            return p, target, None
        if session["filters"].get("area"):
            return session["filters"]["area"], target, None
        if session["shown"] and session["shown"][0]["lat"] is not None:
            first = session["shown"][0]
            return {"name": first["area_name"], "lat": first["lat"], "lng": first["lng"]}, target, None
        return None, target, "origin"
    last = session.get("last_travel")
    if last and (slots.get("transport") or slots.get("commute")):
        return last["origin"], last["dest"], None
    return None, None, "both"


def handle_travel(session: dict, slots: dict, intent: str) -> dict[str, Any]:
    origin, dest, problem = _resolve_travel(session, slots, intent)
    if problem == "origin":
        return {"reply": f"From where? Open a property or tell me the starting area, e.g. "
                         f"\"DHA Phase 5 to {dest['name']}\"."}
    if problem:
        return {"reply": "Please tell me both places, e.g. \"Johar Town to UCP by bike\", or open a property "
                         "and ask \"how far is this from LUMS?\"."}
    est = travel_between(origin, dest)
    if not est:
        return {"reply": "I don't have coordinates for that place yet, sorry."}
    mode = slots.get("transport") or (session.get("last_travel") or {}).get("mode") if not (
        slots.get("origin") or slots.get("destination")) else slots.get("transport")
    commute = monthly_commute(est, mode if mode in est["modes"] else "bike" if "bike" in est["modes"] else "car") \
        if slots.get("commute") else None
    session["last_travel"] = {"origin": origin, "dest": dest, "mode": mode}
    return {"reply": travel_text(origin["name"], dest["name"], est, mode, commute),
            "travel": public_travel(origin["name"], dest["name"], est, mode), "est": est, "commute": commute,
            "origin": origin, "dest": dest, "mode": mode}


# ---------------------------------------------------------------------------
# nearby places
# ---------------------------------------------------------------------------
_CATEGORY_KIND = {"university": ("university",), "school": ("school",), "hospital": ("hospital",),
                  "mosque": ("mosque",),
                  "mall": ("mall",), "market": ("market", "mall"), "park": ("park",),
                  "transport": ("transport",)}


def _backend_nearby(property_id: str | None) -> list[dict] | None:
    if not property_id:
        return None
    data = backend_api.get_json(f"/api/properties/{property_id}/nearby")
    if isinstance(data, dict):
        for key in ("nearby", "places", "landmarks", "results", "items"):
            value = data.get(key)
            if isinstance(value, dict):          # {"nearby": {"mall": [...], "hospital": [...]}}
                data = [dict(p, category=p.get("category") or cat) for cat, ps in value.items()
                        if isinstance(ps, list) for p in ps if isinstance(p, dict)]
                break
            if isinstance(value, list):
                data = value
                break
    if not isinstance(data, list):
        return None
    out = []
    for p in data:
        if not isinstance(p, dict) or not p.get("name"):
            continue
        km = p.get("distanceKm", p.get("distance_km", p.get("distance")))
        minutes = p.get("carMinutes") or p.get("minutes") or p.get("travelMinutes") or p.get("driveMinutes")
        out.append({"name": p["name"], "category": str(p.get("category") or p.get("type") or "place").lower(),
                    "distance_km": round(float(km), 1) if km is not None else None,
                    "car_minutes": int(minutes) if minutes else None})
    return out or None


def nearby_places(origin: dict, category: str | None = None, limit: int = 6,
                  property_id: str | None = None) -> list[dict]:
    rows = _backend_nearby(property_id)
    if rows:
        if category:
            rows = [r for r in rows if any(k in r["category"] for k in _CATEGORY_KIND.get(category, (category,)))] or []
        for r in rows:
            if r["distance_km"] is None or r["car_minutes"] is None:
                p = next((q for q in all_places() if q["name"] == r["name"]), None)
                if p:
                    est = travel_estimate(origin["lat"], origin["lng"], p["lat"], p["lng"])
                    r["distance_km"] = r["distance_km"] if r["distance_km"] is not None else est["distance_km"]
                    r["car_minutes"] = r["car_minutes"] or est["modes"]["car"]["time_min"]
        rows = [r for r in rows if r["distance_km"] is not None]
        if rows:
            rows.sort(key=lambda r: r["distance_km"])
            return rows[:limit]
    cands = []
    for p in all_places():
        if p["kind"] == "area":
            continue
        cat = p.get("category") or p["kind"]
        if category and cat not in _CATEGORY_KIND.get(category, (category,)):
            continue
        d = haversine_km(origin["lat"], origin["lng"], p["lat"], p["lng"])
        cands.append((d, p))
    cands.sort(key=lambda x: x[0])
    radius = 4.0
    chosen = [c for c in cands if c[0] <= radius]
    if len(chosen) < 3:
        chosen = cands[:max(3, min(limit, 4))]
    out = []
    for d, p in chosen[:limit]:
        est = travel_estimate(origin["lat"], origin["lng"], p["lat"], p["lng"])
        out.append({"name": p["name"], "category": p.get("category") or p["kind"], "distance_km": est["distance_km"],
                    "car_minutes": est["modes"]["car"]["time_min"]})
    return out


def nearby_text(where: str, rows: list[dict], category: str | None) -> str:
    if not rows:
        return f"I don't know any {category or 'landmark'}s near {where} yet."
    what = f"{category}s" if category else "places"
    lines = [f"Nearest {what} to {where} (road distance, normal traffic, estimates):"]
    for i, r in enumerate(rows, 1):
        lines.append(f"{i}. {r['name']} ({r['category']}) - ~{r['distance_km']} km, ~{r['car_minutes']} min by car")
    lines.append("Ask \"how far is this from <place>\" for bike / rickshaw times and costs.")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# property questions
# ---------------------------------------------------------------------------
_AMENITY_WORDS = {
    "parking": ("parking", "car porch", "garage"), "gas": ("gas",),
    "backup": ("generator", "backup", "ups", "solar"), "water": ("water", "boring", "tank"),
    "security": ("security", "guard", "gated", "cctv"), "lift": ("lift", "elevator"),
    "internet": ("internet", "wifi", "fiber", "broadband"), "kitchen": ("kitchen",),
    "garden": ("lawn", "garden"), "ac": ("air condition", " ac", "a/c", "split"), "pets": ("pet",),
}


def _amenity_hits(item: dict, feature: str) -> list[str]:
    words = _AMENITY_WORDS.get(feature, (feature,))
    hits = [a for a in item.get("amenities") or [] if any(w.strip() in f" {a.casefold()}" for w in words)]
    desc = item.get("description", "").casefold()
    if not hits and any(re.search(rf"\b{re.escape(w.strip())}\b", desc) for w in words):
        hits.append("mentioned in the description")
    return hits


def feature_answer(item: dict, feature: str) -> str:
    if feature == "furnished":
        return f"Furnishing: {item['furnished']}." if item.get("furnished") else "Furnishing is not listed."
    if feature == "deposit":
        return f"Deposit: {pkr(item['deposit'])}." if item.get("deposit") else "The deposit is not listed."
    if feature == "charges":
        return (f"Other monthly charges: {pkr(item['other_charges'])}." if item.get("other_charges")
                else "Maintenance / other charges are not listed.")
    if feature == "age":
        y = item.get("year_built")
        return f"Built in {y} (about {datetime.now().year - y} years old)." if y else "The construction year is not listed."
    if feature == "price":
        return f"Price: {price_text(item)}."
    if feature == "bedrooms":
        return f"{item['bedrooms']} bedrooms." if item.get("bedrooms") else "Bedrooms are not listed."
    if feature == "bathrooms":
        return f"{item['bathrooms']} bathrooms." if item.get("bathrooms") else "Bathrooms are not listed."
    if feature == "size":
        return f"Size: {size_text(item)}." if size_text(item) else "The size is not listed."
    if feature == "floor":
        if item.get("total_floors"):
            return f"Floor {item.get('floor') or 'ground'} of {item['total_floors']}."
        return "The floor is not listed."
    if feature == "availability":
        return f"Status: {item['status']}."
    if feature == "parking" and item.get("parking"):
        return f"Parking: {item['parking']} space{'s' if item['parking'] != 1 else ''}."
    hits = _amenity_hits(item, feature)
    name = {"backup": "power backup", "ac": "air conditioning"}.get(feature, feature)
    if hits:
        return f"{name.capitalize()}: yes - " + ", ".join(hits[:3]) + "."
    return f"{name.capitalize()} is not listed for this property - please confirm with the owner via the listing page."


def handle_property_question(session: dict, slots: dict, message: str, item: dict, n: int | None,
                             intent: str) -> dict[str, Any]:
    features = [f for f in slots.get("features") or [] if f != "nearby"]
    place = property_place(item)
    data: dict[str, Any] = {"task": "Answer the user's question about this one property.",
                            "property": full_property(item), "asked_about": features or None}
    out: dict[str, Any] = {}
    lines: list[str] = []
    # travel to a named place
    target = next((p for p in (slots.get("destination"), slots.get("origin"), slots.get("near"))
                   if p and p.get("lat") is not None), None)
    if target and place:
        est = travel_between(place, target)
        if est:
            mode = slots.get("transport")
            commute = monthly_commute(est, mode if mode in est["modes"] else "bike") if slots.get("commute") else None
            data["travel"] = {"to": target["name"], "distance_km": est["distance_km"],
                              "modes": {k: {"label": v["label"], "minutes": v["time_min"], "peak_minutes": v.get("time_peak"),
                                            "one_way_cost_pkr": v["one_way_pkr"]} for k, v in est["modes"].items()},
                              "asked_mode": mode, "source": est.get("source")}
            if commute:
                data["monthly_commute"] = commute
            out["travel"] = public_travel(place["short"], target["name"], est, mode)
            session["last_travel"] = {"origin": dict(place, name=place["short"]), "dest": target, "mode": mode}
            lines.append(travel_text(place["short"], target["name"], est, mode, commute))
    # nearby / suitability context
    category = slots.get("nearby_category")
    wants_nearby = intent == "nearby_places" or "nearby" in (slots.get("features") or []) or category
    if place and (wants_nearby or "family" in features or "students" in features):
        cat = category or ("school" if "family" in features else "university" if "students" in features else None)
        rows = nearby_places(place, cat, property_id=place.get("property_id"))
        data["nearby"] = rows
        if wants_nearby or not target:
            lines.append(nearby_text(place["short"], rows, cat))
        if "family" in features or "students" in features:
            data["hospitals_nearby"] = nearby_places(place, "hospital", limit=2)
    for f in features:
        if f in ("family", "students"):
            who = "a family" if f == "family" else "students"
            lines.insert(0, f"For {who}: {item['propertyType'].lower()} with {item['bedrooms'] or 'unlisted'} bedrooms, "
                            f"{size_text(item) or 'size not listed'}, {item['furnished'] or 'furnishing not listed'}, "
                            f"{price_text(item)}.")
        elif not (target and f == "price"):
            lines.insert(0, feature_answer(item, f))
    if not lines:
        lines.append(template_details(item, n))
    fallback = "\n".join(lines)
    if not target and not wants_nearby and features and all(f not in ("family", "students") for f in features):
        fallback += f"\n(Property: {item['title']}, {location_text(item)}.)"
    reply, used = llm_reply(session, message, data, fallback, prompt=GROUNDED_PROMPT, max_tokens=600)
    out.update(reply=reply, llm_used=used)
    return out


# ---------------------------------------------------------------------------
# compare
# ---------------------------------------------------------------------------
def _compare_items(session: dict, slots: dict) -> list[tuple[str, dict]]:
    items: list[tuple[str, dict]] = []
    ords = list(slots.get("ordinals") or [])
    if slots.get("this_ref") and session.get("current"):
        items.append(("this property", session["current"]))
    if not ords and len(items) < 2:
        ords = [1, 2] if not items else [1]
    for o in ords:
        item, n = _pick(session, o)
        if item and all(item["_id"] != x["_id"] for _, x in items):
            items.append((f"#{n}", item))
    return items[:3]


def handle_compare(session: dict, slots: dict, message: str) -> dict[str, Any]:
    items = _compare_items(session, slots)
    if len(items) < 2:
        return {"reply": "I need at least two listings to compare - search first, then say e.g. "
                         "\"compare the first two\" or \"compare 1 and 3\"."}
    target = next((p for p in (slots.get("destination"), slots.get("near"), slots.get("origin"))
                   if p and p.get("lat") is not None), None)
    mode = slots.get("transport") or "car"
    if target:
        annotated = annotate_travel([x for _, x in items], target, mode)
        items = [(lbl, a) for (lbl, _), a in zip(items, annotated)]

    def row(name, fn):
        return f"{name}: " + " | ".join(fn(x) for _, x in items)

    lines = ["Comparison (" + " vs ".join(f"{lbl} {x['title'][:40]}" for lbl, x in items) + "):",
             row("Price", price_text),
             row("Location", location_text),
             row("Type", lambda x: f"{x['propertyType']} for {x['purpose'].lower()}"),
             row("Bedrooms / baths", lambda x: f"{x['bedrooms']} / {x['bathrooms']}"),
             row("Size", lambda x: size_text(x) or "not listed"),
             row("Furnished", lambda x: x["furnished"] or "not listed"),
             row("Parking", lambda x: str(x["parking"]) if x.get("parking") else "not listed"),
             row("Deposit", lambda x: pkr(x["deposit"]) if x.get("deposit") else "not listed"),
             row("Built", lambda x: str(x["year_built"]) if x.get("year_built") else "not listed")]
    if target:
        lines.append(row(f"To {target['name']} ({mode_label(mode).lower()})",
                         lambda x: f"~{x['_travel']['distance_km']} km, ~{x['_travel']['time_min']} min"
                         if x.get("_travel") else "n/a"))
    # short verdict from facts
    priced = [(lbl, x) for lbl, x in items if x.get("amount")]
    verdict = []
    if len(priced) >= 2 and len({x["purpose"] for _, x in priced}) == 1:
        lo = min(priced, key=lambda t: t[1]["amount"])
        hi = max(priced, key=lambda t: t[1]["amount"])
        if lo[1]["amount"] != hi[1]["amount"]:
            verdict.append(f"{lo[0]} is cheaper by {pkr(hi[1]['amount'] - lo[1]['amount'])}")
    beds = sorted(items, key=lambda t: -t[1]["bedrooms"])
    if beds[0][1]["bedrooms"] > beds[-1][1]["bedrooms"]:
        verdict.append(f"{beds[0][0]} has more bedrooms")
    if target and all(x.get("_travel") for _, x in items):
        near = min(items, key=lambda t: t[1]["_travel"]["distance_km"])
        verdict.append(f"{near[0]} is closer to {target['name']}")
    if verdict:
        lines.append("In short: " + "; ".join(verdict) + ".")
    fallback = "\n".join(lines)
    data = {"task": "Compare these properties side by side (one line per attribute, values separated by ' | '), "
                    "then give a one-sentence recommendation based only on these facts.",
            "labels": [lbl for lbl, _ in items],
            "properties": [dict(full_property(x), label=lbl, **({"travel": llm_property(x)["travel"]}
                                                                 if x.get("_travel") else {}))
                           for lbl, x in items]}
    reply, used = llm_reply(session, message, data, fallback, prompt=GROUNDED_PROMPT, max_tokens=700)
    return {"reply": reply, "llm_used": used, "properties": [x for _, x in items]}


# ---------------------------------------------------------------------------
# area questions
# ---------------------------------------------------------------------------
def _stats(items: list[dict]) -> dict[str, Any]:
    amounts = sorted(i["amount"] for i in items if i.get("amount"))
    if not amounts:
        return {"count": len(items)}
    return {"count": len(items), "min": amounts[0], "max": amounts[-1],
            "average": int(round(sum(amounts) / len(amounts), -3)),
            "median": amounts[len(amounts) // 2]}


def _backend_area(area: dict) -> dict | None:
    slug = area.get("slug") or norm(area["name"]).replace(" ", "-")
    data = backend_api.get_json(f"/api/areas/{slug}")
    if isinstance(data, dict) and data:
        area_obj = data.get("area") if isinstance(data.get("area"), dict) else data
        keep = {k: v for k, v in area_obj.items() if k in (
            "name", "description", "stats", "avgRent", "averageRent", "avgSalePrice", "listingCount",
            "minRent", "maxRent", "highlights", "landmarks", "rentByType", "byType", "tier")
            and v not in (None, "", [])}
        if isinstance(data.get("stats"), dict):
            keep["stats"] = data["stats"]
        return keep or None
    return None


def area_listing_stats(area: dict, purpose: str | None, ptype: str | None) -> dict[str, Any]:
    items = [i for i in load_listings() if listing_in_area(i, area)]
    out: dict[str, Any] = {"listings_total": len(items)}
    for purp in ("Rent", "Sale"):
        if purpose and purp != purpose:
            continue
        sub = [i for i in items if i["purpose"] == purp and type_matches(i["propertyType"], ptype)]
        if not sub:
            continue
        by_type: dict[str, list[dict]] = {}
        for i in sub:
            by_type.setdefault(i["propertyType"], []).append(i)
        out[purp.lower()] = {"all": _stats(sub), "by_type": {t: _stats(v) for t, v in by_type.items()}}
    return out


def handle_area_info(session: dict, slots: dict, message: str) -> dict[str, Any]:
    area = slots.get("area") or (slots.get("near") if (slots.get("near") or {}).get("kind") == "area" else None)
    ptype, purpose = slots.get("property_type"), slots.get("purpose")
    if not area:
        # "which area is cheapest for a 3 bed house"
        purpose = purpose or "Rent"
        items = search_properties(property_type=ptype, purpose=purpose, bedrooms=slots.get("bedrooms"),
                                  bedrooms_mode=slots.get("bedrooms_mode") or "exact",
                                  furnished=slots.get("furnished"))
        if not items and slots.get("bedrooms"):
            items = search_properties(property_type=ptype, purpose=purpose, bedrooms=slots["bedrooms"],
                                      bedrooms_mode="min")
        groups: dict[str, list[dict]] = {}
        for i in items:
            groups.setdefault(i["area_name"], []).append(i)
        ranked = sorted(((a, _stats(v)) for a, v in groups.items() if _stats(v).get("average")),
                        key=lambda t: t[1]["average"])
        what = describe_filters({"property_type": ptype, "purpose": purpose, "bedrooms": slots.get("bedrooms"),
                                 "bedrooms_mode": slots.get("bedrooms_mode")})
        if not ranked:
            return {"reply": f"I don't have enough listings of {what} to rank areas right now."}
        per = "/month" if purpose == "Rent" else ""
        lines = [f"Areas ranked by average price for {what} (from current RMS listings):"]
        for k, (a, s) in enumerate(ranked[:6], 1):
            lines.append(f"{k}. {a} - average {pkr(s['average'])}{per} ({s['count']} listing{'s' if s['count'] != 1 else ''}, "
                         f"from {pkr(s['min'])}{per})")
        lines.append(f"Cheapest right now: {ranked[0][0]}. Based only on listings currently on RMS.")
        fallback = "\n".join(lines)
        cheapest = sorted(groups[ranked[0][0]], key=lambda i: i["amount"])[:PAGE]
        data = {"task": "Tell the user which areas are cheapest for what they asked, using the ranking. "
                        "Mention it is based on current RMS listings only.",
                "what": what, "ranking": [{"area": a, **s} for a, s in ranked[:6]]}
        reply, used = llm_reply(session, message, data, fallback, prompt=GROUNDED_PROMPT)
        return {"reply": reply, "llm_used": used, "properties": cheapest}

    stats = area_listing_stats(area, purpose, ptype)
    backend = _backend_area(area)
    landmarks = nearby_places(area, None, limit=5) if area.get("lat") is not None else []
    lines = []
    name = area["name"]
    if stats["listings_total"] == 0:
        lines.append(f"There are no available listings in {name} on RMS right now.")
        hint = _available_areas_hint()
        if hint:
            lines.append(f"Areas with listings: {hint}.")
    else:
        lines.append(f"{name}: {stats['listings_total']} available listing{'s' if stats['listings_total'] != 1 else ''} on RMS.")
        for purp, per in (("rent", "/month"), ("sale", "")):
            if purp not in stats:
                continue
            s = stats[purp]["all"]
            if s.get("average"):
                lines.append(f"- {'Rent' if purp == 'rent' else 'Sale'}"
                             f"{' (' + ptype.lower() + 's)' if ptype else ''}: average {pkr(s['average'])}{per}, "
                             f"range {pkr(s['min'])} - {pkr(s['max'])}{per} ({s['count']} listings)")
            for t, ts in list(stats[purp]["by_type"].items())[:4]:
                if ts.get("average") and len(stats[purp]["by_type"]) > 1:
                    lines.append(f"  - {t}: average {pkr(ts['average'])}{per} ({ts['count']})")
    if landmarks:
        lines.append("Nearby: " + ", ".join(f"{r['name']} (~{r['distance_km']} km)" for r in landmarks[:4]) + ".")
    lines.append(f"Say \"show {(ptype or 'house').lower()}s in {name}\" to see the listings.")
    fallback = "\n".join(lines)
    data = {"task": "Describe this Lahore area for someone looking to rent or buy. Use the listing statistics "
                    "(from current RMS listings) and nearby landmarks. You may add at most one sentence of "
                    "widely known general description of the area, without numbers.",
            "area": name, "listing_stats": stats, "nearby_landmarks": landmarks}
    if backend:
        data["website_area_info"] = backend
    reply, used = llm_reply(session, message, data, fallback, prompt=GROUNDED_PROMPT)
    props = sorted([i for i in load_listings() if listing_in_area(i, area)
                    and (not purpose or i["purpose"] == purpose)
                    and type_matches(i["propertyType"], ptype)], key=lambda i: i["amount"] or 10**12)[:PAGE]
    if props:
        session["results"], session["shown"], session["offset"] = props, props, len(props)
    return {"reply": reply, "llm_used": used, "properties": props}


# ---------------------------------------------------------------------------
# search (incl. near-place search)
# ---------------------------------------------------------------------------
def handle_search(session: dict, slots: dict, intent: str, message: str) -> dict[str, Any]:
    if "similar" in message.casefold() and session.get("current"):
        cur = session["current"]
        slots = dict(slots)
        slots["property_type"] = slots.get("property_type") or cur["propertyType"]
        slots["purpose"] = slots.get("purpose") or cur["purpose"]
    near_target = None
    if intent in ("near_search", "property_with_travel") or slots.get("near"):
        near_target = slots.get("near") or slots.get("destination")
        if near_target and near_target.get("kind") == "area" and not slots.get("area") and intent != "property_with_travel":
            slots = dict(slots, area=near_target, near=None)
            near_target = None
        elif near_target and intent == "near_search":
            slots = dict(slots, near=near_target)
    f = _merge_filters(session, slots, intent, message)
    mode = slots.get("transport") or "car"
    if f.get("near"):
        if slots.get("duration_min"):
            f["max_minutes"], f["mode"] = slots["duration_min"], mode
        elif slots.get("distance_km"):
            f["radius_km"] = slots["distance_km"] / 1.35
            f.pop("max_minutes", None)
    session["filters"] = f
    results, note = search_with_relaxation(f)
    dest = near_target or (slots.get("destination") if intent == "property_with_travel" else None)
    if not dest and f.get("near"):
        dest = f["near"]
    travel_info = None
    if dest and dest.get("lat") is not None and results:
        tmode = slots.get("transport") or ("bike" if intent == "property_with_travel" else "car")
        ranked = annotate_travel(results, dest, tmode, use_backend=False)
        ranked.sort(key=lambda i: i.get("_travel", {}).get("distance_km", 1e9))
        # website numbers for the page that is shown (consistent with the property pages)
        ranked[:PAGE] = annotate_travel(ranked[:PAGE], dest, tmode, use_backend=True)
        results = ranked
        travel_info = {"to": dest["name"], "mode": tmode}
    session["results"], session["note"] = results, note
    shown = results[:PAGE]
    session["offset"], session["shown"] = len(shown), shown
    if intent == "price_inquiry" and results:
        amounts = [i["amount"] for i in results if i["amount"]]
        per = "/month" if all(i["purpose"] == "Rent" for i in results) else ""
        lead = (f"Prices for {describe_filters(f)} ({len(amounts)} listings): from {pkr(min(amounts))}{per} "
                f"to {pkr(max(amounts))}{per}, average {pkr(round(sum(amounts) / len(amounts), -3))}{per}. "
                f"Cheapest options:") if amounts else "Here are the listings:"
    elif results:
        lead = f"I found {len(results)} listing{'s' if len(results) != 1 else ''} for {describe_filters(f)}" + \
               (f" (closest to {dest['name']} first)" if dest else "") + ":" if not note else "Here are the closest options:"
    else:
        lead = ""
    if results:
        fallback = template_search_reply(lead, shown, 0, len(results), note)
        if intent == "book_property":
            fallback += "\nTo book, open a property card and use the Book / Rent Now option (login required)."
    else:
        hint = _available_areas_hint()
        fallback = note + (f" Areas with listings right now: {hint}." if hint else "") + \
            " Try a different area, a higher budget or fewer filters."
    data = {"intent": intent, "filters": filters_for_response(f), "note": note,
            "total_matches": len(results), "properties": [llm_property(i) for i in shown]}
    if dest:
        data["distances_to"] = dest["name"]
    reply, used = llm_reply(session, message, data, fallback) if results else (fallback, False)
    return {"reply": reply, "llm_used": used, "properties": shown, "travel_info": travel_info}


# ---------------------------------------------------------------------------
# main entry
# ---------------------------------------------------------------------------
PROPERTY_CONTEXT_INTENTS = {"property_question", "nearby_places"}


def handle_message(message: str, session_id: str, property_id: str | None = None) -> dict[str, Any]:
    message = (message or "").strip()
    session = get_session(session_id or "default")
    _sync_page_property(session, property_id)
    nlu = parse_message(message)
    intent, slots, lang = nlu["intent"], nlu["slots"], nlu["language"]
    properties: list[dict] = []
    reply = ""
    used_llm = False
    travel = None

    # travel question with a single place while a property is in context -> about that property
    one_place = len(_places_in(slots)) == 1
    if (nlu["intent_group"] == "travel" or intent == "distance") and one_place and slots.get("this_ref") \
            and _context_property(session, slots)[0]:
        intent = "property_question"
    if intent in ("refine_search", "unknown", "property_details") and slots.get("features") and \
            not any(slots.get(k) for k in ("area", "property_type", "max_budget", "bedrooms", "near")) and \
            slots.get("ordinal") is None and _context_property(session, slots)[0] and \
            [f for f in slots["features"] if f not in ("price",)]:
        intent = "property_question"

    if intent == "reset":
        keep = session.get("page_property_id")
        session.update(_new_session())
        session["page_property_id"] = keep
        reply = "Done - all filters cleared. What are you looking for now?"
    elif intent == "greeting":
        reply = GREETING[lang]
    elif intent == "thanks":
        reply = "You're welcome! Ask me anytime if you want to see more properties." if lang == "english" \
            else "Khushi hui madad karke! Aur kuch chahiye to batayein."
    elif intent == "help":
        reply = help_text()
    elif intent == "show_more":
        results, offset = session["results"], session["offset"]
        if not results:
            reply = "There is no previous search yet. Tell me an area, type or budget to start."
        elif offset >= len(results):
            reply = "That's all the matching listings I have. Try another area or a different budget."
        else:
            shown = results[offset:offset + PAGE]
            dest = (session["filters"].get("near") if shown and shown[0].get("_travel") else None)
            if dest:
                shown = annotate_travel(shown, dest, shown[0]["_travel"]["mode"])
            session["offset"] = offset + len(shown)
            session["shown"] = shown
            properties = shown
            fallback = template_search_reply(f"Here are {len(shown)} more:", shown, offset, len(results), "")
            reply, used_llm = llm_reply(session, message, {"intent": "show_more", "properties":
                                        [llm_property(i) for i in shown]}, fallback)
    elif intent == "compare":
        out = handle_compare(session, slots, message)
        reply, used_llm, properties = out["reply"], out.get("llm_used", False), out.get("properties", [])
    elif intent == "area_info":
        out = handle_area_info(session, slots, message)
        reply, used_llm, properties = out["reply"], out.get("llm_used", False), out.get("properties", [])
    elif intent in PROPERTY_CONTEXT_INTENTS or (
            intent in ("property_details", "book_property") and (slots.get("ordinal") is not None or
                                                                 (intent == "property_details" and
                                                                  (session["shown"] or session.get("current"))))):
        item, n = _context_property(session, slots)
        if not item and intent == "nearby_places" and (slots.get("area") or slots.get("near")):
            where = slots.get("area") or slots.get("near")
            rows = nearby_places(where, slots.get("nearby_category"))
            reply = nearby_text(where["name"], rows, slots.get("nearby_category"))
        elif not item:
            n_shown = len(session["shown"])
            reply = (f"Which property do you mean? I have {n_shown} listing{'s' if n_shown != 1 else ''} on screen - "
                     f"say e.g. \"the first one\"." if n_shown
                     else "Open a property on the website, or search first (e.g. \"flats in Johar Town\"), "
                          "then ask me about it.")
        else:
            properties = [item]
            if intent == "book_property":
                reply = (f"To book \"{item['title']}\" ({price_text(item)}, {location_text(item)}), open its "
                         "property card on the RMS website and use the Book / Rent Now button, or send a "
                         "request to the owner from the listing page. You'll need to be logged in.")
            elif intent == "property_details" and not slots.get("features") and not (
                    slots.get("destination") or slots.get("origin")):
                reply, used_llm = llm_reply(session, message, {"intent": intent, "properties": [llm_property(item)]},
                                            template_details(item, n))
            else:
                out = handle_property_question(session, slots, message, item, n, intent)
                reply, used_llm, travel = out["reply"], out.get("llm_used", False), out.get("travel")
    elif nlu["intent_group"] == "travel":
        out = handle_travel(session, slots, intent)
        reply, travel = out["reply"], out.get("travel")
    else:
        has_slots = any(slots.get(k) not in (None, False, "") for k in
                        ("area", "near", "property_type", "purpose", "max_budget", "min_budget",
                         "bedrooms", "furnished", "cheaper", "pricier"))
        if intent == "unknown" and not has_slots:
            log_unanswered_query(message, session_id)
            reply = ("Sorry, I didn't quite get that. I can search properties anywhere in Lahore, answer questions "
                     "about the property you're viewing, compare listings, or estimate travel time/cost. "
                     "Type \"help\" for examples.")
        elif intent == "refine_search" and not session["filters"] and not has_slots:
            reply = "Tell me what to search first, e.g. \"flats for rent in Gulberg under 80k\"."
        else:
            out = handle_search(session, slots, intent, message)
            reply, used_llm, properties = out["reply"], out["llm_used"], out["properties"]

    if properties and intent in ("compare", "property_question", "property_details", "nearby_places") \
            and len(properties) == 1:
        _set_current(session, properties[0])
    session["history"].append({"role": "user", "content": message})
    session["history"].append({"role": "assistant", "content": reply})
    session["history"] = session["history"][-12:]
    current = session.get("current")
    return {
        "reply": reply,
        "properties": [public_property(p) for p in properties[:PAGE]],
        "intent": intent,
        "entities": nlu["entities"],
        "filters": filters_for_response(session["filters"]),
        "has_more": session["offset"] < len(session["results"]),
        "travel": travel,
        "context_property_id": current["_id"] if current else None,
        "nlu": {"source": nlu["source"], "confidence": nlu["confidence"], "model_intent": nlu["model_intent"]},
        "llm_used": used_llm,
    }
