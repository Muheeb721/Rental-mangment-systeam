"""MongoDB property catalog: loading, normalising, area catalog and search.

Listings are read from the backend's `properties` collection (Mongoose model
RMS-Backend/src/models/Property.js). Every field is read defensively because
the schema has several legacy aliases (propertyType/type/category,
purpose/transactionType/listingType, price/rent/salePrice ...).
Only available / active listings are returned.
"""
from __future__ import annotations

import json
import logging
import math
import re
import threading
import time
from datetime import datetime, timezone
from typing import Any, Iterable

from rapidfuzz import fuzz, process

from app import config
from app.services.gazetteer import PARENTS, places, places_version

log = logging.getLogger("rms.catalog")

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
_UNAVAILABLE = (r"sold|rented|occupied|inactive|unavailable|not available|booked|deleted|"
                r"archived|draft|pending|rejected|hidden|disabled|leased|expired|blocked")


def norm(value: Any) -> str:
    """lower-case, strip punctuation, collapse spaces ("DHA Phase-5," -> "dha phase 5")."""
    text = str(value or "").casefold()
    text = re.sub(r"([a-z])\1{2,}", r"\1", text)
    text = re.sub(r"[^a-z0-9/]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _num(value: Any) -> float:
    if value is None or isinstance(value, bool):
        return 0.0
    if isinstance(value, (int, float)):
        return float(value) if math.isfinite(value) else 0.0
    match = re.search(r"\d+(?:\.\d+)?", str(value).replace(",", ""))
    return float(match.group(0)) if match else 0.0


def _str(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ("" if value is None else str(value))


# ---------------------------------------------------------------------------
# property type / purpose / furnished normalisation
# ---------------------------------------------------------------------------
TYPE_SYNONYMS = {
    "House": ("house", "houses", "home", "homes", "ghar", "ghr", "makan", "makaan", "kothi",
              "villa", "villas", "bungalow", "bungalows", "townhouse", "farmhouse"),
    "Flat": ("flat", "flats"),
    "Apartment": ("apartment", "apartments", "apt", "apts", "studio", "studio apartment",
                  "penthouse", "penthouses", "condo"),
    "Portion": ("portion", "portions", "upper portion", "lower portion"),
    "Room": ("room", "rooms", "hostel", "hostel room", "hostels", "kamra", "pg"),
    "Plot": ("plot", "plots", "land"),
    "Shop": ("shop", "shops", "dukan"),
    "Office": ("office", "offices"),
}
TYPE_FAMILY = {"Flat": "flat", "Apartment": "flat", "House": "house", "Portion": "house",
               "Room": "room", "Plot": "plot", "Shop": "commercial", "Office": "commercial"}


def canonical_type(value: Any) -> str | None:
    text = norm(value)
    if not text:
        return None
    for canon, words in TYPE_SYNONYMS.items():
        if text in words:
            return canon
    for canon, words in TYPE_SYNONYMS.items():
        if any(re.search(rf"\b{re.escape(w)}\b", text) for w in words):
            return canon
    return None


def canonical_purpose(value: Any) -> str | None:
    text = norm(value)
    if not text:
        return None
    if re.search(r"\b(sale|sell|buy|purchase|khareed\w*|bech\w*)\b", text):
        return "Sale"
    if re.search(r"\b(rent|rental|lease|kiraye?|kiraya|to let)\b", text):
        return "Rent"
    return None


def canonical_furnished(value: Any) -> str:
    if isinstance(value, bool):
        return "furnished" if value else "unfurnished"
    text = norm(value)
    if not text:
        return ""
    if "semi" in text:
        return "semi-furnished"
    if text.startswith(("un", "non", "not")) or text in {"no", "false"}:
        return "unfurnished"
    if "furnish" in text or text in {"yes", "true", "fully"}:
        return "furnished"
    return ""


# ---------------------------------------------------------------------------
# area catalog
# ---------------------------------------------------------------------------
_places_cache: dict[str, Any] = {"version": None, "places": [], "by_name": {}}


def _all_places() -> list[dict[str, Any]]:
    version = places_version()
    if _places_cache["version"] != version:
        ps = places()
        _places_cache.update(version=version, places=ps, by_name={p["name"].casefold(): p for p in ps})
        _cache["catalog"] = None
    return _places_cache["places"]


def place_by_name(name: str) -> dict[str, Any] | None:
    _all_places()
    return _places_cache["by_name"].get((name or "").casefold())


def _parent_entry(name: str) -> dict[str, Any]:
    info = PARENTS[name]
    return {"name": name, "lat": info["lat"], "lng": info["lng"], "kind": "parent",
            "parent": name, "aliases": list(info["aliases"])}


def _guess_area(text_fields: Iterable[str]) -> tuple[str, str]:
    """Return (area_name, parent) for a listing from its free-text location fields."""
    text = " " + " ".join(norm(t) for t in text_fields if t) + " "
    best = None
    for place in _all_places():
        if place["kind"] != "area":
            continue
        for alias in place["aliases"]:
            a = norm(alias)
            if a and f" {a} " in text and (best is None or len(a) > best[0]):
                best = (len(a), place)
    if best:
        place = best[1]
        # "Bahria Town Phase 8" must not become "DHA Phase 8"
        if place["parent"] == "DHA Lahore" and " bahria " in text:
            return "Bahria Town", "Bahria Town"
        return place["name"], place["parent"]
    m = re.search(r" phase (\d{1,2}) ", text)
    if m:
        if " bahria " in text:
            return "Bahria Town", "Bahria Town"
        return f"DHA Phase {int(m.group(1))}", "DHA Lahore"
    for parent, info in PARENTS.items():
        if any(f" {norm(a)} " in text for a in info["aliases"]):
            return parent, parent
    return "", ""


def _has_coords(doc: dict[str, Any]) -> bool:
    try:
        lat, lng = float(doc.get("latitude")), float(doc.get("longitude"))
        return math.isfinite(lat) and math.isfinite(lng) and not (lat == 0 and lng == 0)
    except (TypeError, ValueError):
        return False


def normalize_listing(doc: dict[str, Any]) -> dict[str, Any]:
    raw_type = doc.get("propertyType") or doc.get("type") or doc.get("category") or ""
    ptype = canonical_type(raw_type) or (_str(raw_type).title() or "Property")
    purpose = (canonical_purpose(doc.get("purpose")) or canonical_purpose(doc.get("transactionType"))
               or canonical_purpose(doc.get("listingType")) or canonical_purpose(doc.get("status"))
               or "Rent")
    rent = _num(doc.get("rent")) or _num(doc.get("monthlyRent"))
    sale_price = _num(doc.get("salePrice"))
    price = _num(doc.get("price"))
    if purpose == "Rent":
        amount = rent or price
    else:
        amount = sale_price or price
    location = _str(doc.get("location"))
    society = _str(doc.get("society"))
    phase = _str(doc.get("phase"))
    block = _str(doc.get("block"))
    address = _str(doc.get("address"))
    city = _str(doc.get("city")) or "Lahore"
    area_name, parent = _guess_area([society, phase, location, address, block, _str(doc.get("title"))])
    if not area_name:
        area_name = society or location or phase or city
    place = place_by_name(area_name)

    lat, lng = doc.get("latitude"), doc.get("longitude")
    try:
        lat, lng = float(lat), float(lng)
        if not (math.isfinite(lat) and math.isfinite(lng)) or (lat == 0 and lng == 0):
            raise ValueError
    except (TypeError, ValueError):
        if place:
            lat, lng = place["lat"], place["lng"]
        elif parent in PARENTS:
            lat, lng = PARENTS[parent]["lat"], PARENTS[parent]["lng"]
        else:
            lat = lng = None

    size = doc.get("area")
    size_value = _num(size)
    unit = _str(doc.get("areaUnit") or doc.get("area_unit") or doc.get("unit") or doc.get("sizeUnit"))
    if not unit and isinstance(size, str):
        m = re.search(r"(marla|kanal|sq\.? ?ft|sqft|square feet|sq\.? ?yd|sq yards?)", size, re.I)
        unit = m.group(1) if m else ""
    unit = unit or "sq ft"

    image = ""
    for item in doc.get("images") or []:
        url = item.get("url") if isinstance(item, dict) else item
        if isinstance(url, str) and url.strip():
            image = url.strip()
            break
    if not image:
        featured = doc.get("featuredImage")
        if isinstance(featured, dict) and isinstance(featured.get("url"), str):
            image = featured["url"].strip()
        elif isinstance(featured, str):
            image = featured.strip()
    if not image and isinstance(doc.get("image"), str):
        image = doc["image"].strip()

    amenities = doc.get("amenities") or []
    if isinstance(amenities, str):
        amenities = [a.strip() for a in amenities.split(",") if a.strip()]
    amenities = [str(a) for a in amenities if a][:30]

    title = _str(doc.get("title")) or f"{ptype} in {area_name}"
    return {
        "_id": str(doc.get("_id", "")),
        "title": title,
        "description": _str(doc.get("description"))[:1500],
        "purpose": purpose,
        "propertyType": ptype,
        "price": int(sale_price or price) if purpose == "Sale" else int(price or rent),
        "rent": int(rent or (price if purpose == "Rent" else 0)),
        "amount": int(amount),
        "city": city,
        "location": location or phase or society or area_name,
        "society": society,
        "phase": phase,
        "block": block,
        "address": address,
        "area_name": area_name,
        "parent_area": parent,
        "bedrooms": int(_num(doc.get("bedrooms"))),
        "bathrooms": int(_num(doc.get("bathrooms"))),
        "area": int(size_value) if size_value == int(size_value) else size_value,
        "areaUnit": unit,
        "furnished": canonical_furnished(doc.get("furnished")),
        "amenities": amenities,
        "deposit": int(_num(doc.get("deposit"))),
        "other_charges": int(_num(doc.get("otherCharges"))),
        "parking": int(_num(doc.get("parking"))),
        "floor": int(_num(doc.get("floor"))),
        "total_floors": int(_num(doc.get("totalFloors"))),
        "year_built": int(_num(doc.get("yearBuilt"))) or None,
        "listed_at": _str(doc.get("createdAt"))[:10],
        "has_coords": _has_coords(doc),
        "status": _str(doc.get("status")) or _str(doc.get("availability")) or "Available",
        "image": image,
        "lat": lat,
        "lng": lng,
    }


# ---------------------------------------------------------------------------
# MongoDB access with a small TTL cache
# ---------------------------------------------------------------------------
_client = None
_lock = threading.Lock()
_cache: dict[str, Any] = {"at": 0.0, "listings": [], "catalog": None, "error": None}


def _collection():
    global _client
    from pymongo import MongoClient

    if _client is None:
        _client = MongoClient(config.MONGODB_URI, serverSelectionTimeoutMS=3000,
                              connectTimeoutMS=3000, socketTimeoutMS=8000)
    db = _client[config.MONGODB_DB] if config.MONGODB_DB else _client.get_default_database("rms")
    return db[config.PROPERTY_COLLECTION]


def active_query() -> dict[str, Any]:
    bad = {"$regex": _UNAVAILABLE, "$options": "i"}
    return {"$nor": [
        {"status": bad}, {"availability": bad}, {"approvalStatus": bad},
        {"isDeleted": True}, {"deleted": True}, {"isActive": False}, {"active": False},
        {"isApproved": False}, {"approved": False}, {"isAvailable": False},
    ]}


def load_listings(force: bool = False) -> list[dict[str, Any]]:
    now = time.time()
    with _lock:
        if not force and _cache["listings"] and now - _cache["at"] < config.CATALOG_TTL_SECONDS:
            return _cache["listings"]
        try:
            projection = {"priceHistory": 0, "videos": 0, "media3d": 0, "offer": 0}
            docs = list(_collection().find(active_query(), projection).limit(5000))
            listings = [normalize_listing(d) for d in docs]
            _cache.update(at=now, listings=listings, catalog=None, error=None)
        except Exception as error:  # DB down: keep serving the last good copy
            if _cache["error"] is None:
                log.warning("MongoDB read failed (%s); using cached listings (%d)",
                            error.__class__.__name__, len(_cache["listings"]))
            _cache.update(at=now, error=str(error))
        return _cache["listings"]


def db_status() -> dict[str, Any]:
    listings = load_listings()
    return {"ok": _cache["error"] is None, "listings": len(listings), "error": _cache["error"]}


def cached_area_catalog() -> list[dict[str, Any]]:
    """All known areas: gazetteer places + society parents + area names found in listings."""
    listings = load_listings()
    _all_places()
    if _cache.get("catalog") is not None:
        return _cache["catalog"]
    counts: dict[str, int] = {}
    for item in listings:
        counts[item["area_name"].casefold()] = counts.get(item["area_name"].casefold(), 0) + 1
    catalog = [dict(p, listing_count=counts.get(p["name"].casefold(), 0)) for p in _all_places()]
    for parent in PARENTS:
        entry = _parent_entry(parent)
        entry["listing_count"] = sum(1 for i in listings if i["parent_area"] == parent)
        catalog.append(entry)
    known = {c["name"].casefold() for c in catalog}
    for item in listings:
        name = item["area_name"]
        if name and name.casefold() not in known:
            known.add(name.casefold())
            catalog.append({"name": name, "lat": item["lat"], "lng": item["lng"], "kind": "area",
                            "parent": item["parent_area"], "aliases": [name.lower()],
                            "listing_count": counts.get(name.casefold(), 0)})
    _cache["catalog"] = catalog
    return catalog


def _alias_index() -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for area in cached_area_catalog():
        for alias in area["aliases"]:
            key = norm(alias)
            if len(key) >= 2:
                # parents win over a same-named place (e.g. "gulberg"), places win over others
                if key not in index or area["kind"] == "parent":
                    index[key] = area
        m = re.fullmatch(r"dha phase (\d+)", norm(area["name"]))
        if m:
            index.setdefault(f"phase {m.group(1)}", area)
            index.setdefault(f"dha {m.group(1)}", area)
            index.setdefault(f"dha ph {m.group(1)}", area)
            index.setdefault(f"dha phase{m.group(1)}", area)
        m = re.fullmatch(r"(gulberg|askari) (\d+)", norm(area["name"]))
        if m:
            index.setdefault(f"{m.group(1)}{m.group(2)}", area)
    return index


_STOP = {"for", "in", "the", "and", "near", "rent", "sale", "with", "under", "flat", "house",
         "town", "city", "show", "me", "mein", "se", "tak", "ka", "ki", "ke", "par", "pe"}


# aliases that are also ordinary English words: only a place when the context says so
_AMBIGUOUS = {"fast", "superior", "pace", "liberty", "packages", "fortress", "general hospital",
              "airport", "zoo", "auto", "expo centre", "high court", "johar", "forman"}
_CUE_BEFORE = r"(near|to|from|at|reach|reaching|se|ke|paas|qareeb|and|vs|of|around|by|than|is)"
_CUE_AFTER = r"(university|uni|campus|nuces|mall|market|town|se|ke|tak|ka|ki|paas|qareeb|to|from)"


def _place_cue(text: str, alias: str) -> bool:
    words = r"\s+".join(re.escape(w) for w in alias.split())
    if re.search(rf"\b{words.upper()}\b", text):         # written in capitals: FAST, PACE
        return True
    low = text.casefold()
    return bool(re.search(rf"\b{_CUE_BEFORE}\s+(the\s+)?{words}\b", low)
                or re.search(rf"\b{words}\s*{_CUE_AFTER}", low))


def find_area_mentions(text: str) -> list[tuple[int, int, dict[str, Any]]]:
    """Find area/place names in a sentence (exact aliases first, then typo-tolerant)."""
    normalized = norm(text)
    if not normalized:
        return []
    index = _alias_index()
    found: list[tuple[int, int, int, dict[str, Any]]] = []
    for alias, area in index.items():
        if alias in _AMBIGUOUS and not _place_cue(text, alias):
            continue
        for m in re.finditer(rf"(?<![a-z0-9]){re.escape(alias)}(?![a-z0-9])", normalized):
            found.append((m.start(), m.end(), 100 + len(alias), area))
    words = normalized.split()
    choices = [a for a in index if len(a) >= 5]
    offsets, pos = [], 0
    for w in words:
        offsets.append(pos)
        pos += len(w) + 1
    for size in range(min(4, len(words)), 0, -1):
        for i in range(len(words) - size + 1):
            window = words[i:i + size]
            phrase = " ".join(window)
            if len(phrase) < 5 or all(w in _STOP for w in window) or window[0] in _STOP:
                continue
            best = process.extractOne(phrase, choices, scorer=fuzz.ratio, score_cutoff=88)
            if best:
                found.append((offsets[i], offsets[i] + len(phrase), int(best[1]), index[best[0]]))
    found.sort(key=lambda f: (-(f[1] - f[0]), -f[2]))
    selected: list[tuple[int, int, dict[str, Any]]] = []
    for start, end, _, area in found:
        if any(start < e and end > s for s, e, _ in selected):
            continue
        selected.append((start, end, area))
    selected.sort(key=lambda s: s[0])
    return selected


def normalize_area_name(name: str) -> dict[str, Any] | None:
    if not name:
        return None
    index = _alias_index()
    key = norm(name)
    if key in index:
        return index[key]
    mentions = find_area_mentions(name)
    if mentions:
        return max(mentions, key=lambda m: m[1] - m[0])[2]
    best = process.extractOne(key, list(index), scorer=fuzz.WRatio, score_cutoff=86)
    return index[best[0]] if best else None


def areas_with_listings() -> list[dict[str, Any]]:
    return [a for a in cached_area_catalog() if a.get("listing_count") and a["kind"] != "parent"]


# ---------------------------------------------------------------------------
# search
# ---------------------------------------------------------------------------
def listing_in_area(item: dict[str, Any], area: dict[str, Any] | None) -> bool:
    if not area:
        return True
    name = area["name"].casefold()
    if area.get("kind") == "parent":
        return item["parent_area"].casefold() == name or item["area_name"].casefold() == name
    if item["area_name"].casefold() == name:
        return True
    hay = norm(" ".join([item["location"], item["society"], item["phase"], item["address"]]))
    return f" {norm(area['name'])} " in f" {hay} "


def type_matches(item_type: str, wanted: str | None, strict: bool = False) -> bool:
    if not wanted:
        return True
    if item_type == wanted:
        return True
    if strict:
        return False
    family = TYPE_FAMILY.get(wanted)
    return family is not None and TYPE_FAMILY.get(item_type) == family


def search_properties(
    *,
    area: dict[str, Any] | None = None,
    property_type: str | None = None,
    purpose: str | None = None,
    max_budget: int | None = None,
    min_budget: int | None = None,
    bedrooms: int | None = None,
    bedrooms_mode: str = "exact",       # "exact" | "min"
    furnished: str | None = None,
    near: tuple[float, float] | None = None,
    radius_km: float | None = None,
    sort: str = "price_asc",
    exclude_ids: set[str] | None = None,
) -> list[dict[str, Any]]:
    results = []
    for item in load_listings():
        if exclude_ids and item["_id"] in exclude_ids:
            continue
        if not listing_in_area(item, area):
            continue
        if not type_matches(item["propertyType"], property_type):
            continue
        if purpose and item["purpose"] != purpose:
            continue
        if max_budget is not None and item["amount"] and item["amount"] > max_budget:
            continue
        if min_budget is not None and item["amount"] < min_budget:
            continue
        if bedrooms is not None:
            if bedrooms_mode == "min" and item["bedrooms"] < bedrooms:
                continue
            if bedrooms_mode == "exact" and item["bedrooms"] != bedrooms:
                continue
        if furnished and item["furnished"] != furnished:
            continue
        if near and radius_km is not None:
            if item["lat"] is None or haversine_km(near[0], near[1], item["lat"], item["lng"]) > radius_km:
                continue
        results.append(item)

    def exact_type_first(i):
        return 0 if (not property_type or i["propertyType"] == property_type) else 1

    if sort == "price_desc":
        results.sort(key=lambda i: (exact_type_first(i), -i["amount"]))
    elif sort == "distance" and near:
        results.sort(key=lambda i: haversine_km(near[0], near[1], i["lat"], i["lng"])
                     if i["lat"] is not None else 1e9)
    else:
        results.sort(key=lambda i: (exact_type_first(i), i["amount"] or 10**12))
    return results


def nearby_areas(area: dict[str, Any], candidates: list[dict[str, Any]], limit: int = 3
                 ) -> list[tuple[str, float, int]]:
    """Areas (other than `area`) that have matching listings, nearest first."""
    if area.get("lat") is None:
        return []
    by_area: dict[str, tuple[float, int]] = {}
    for item in candidates:
        if item["lat"] is None or listing_in_area(item, area):
            continue
        d = haversine_km(area["lat"], area["lng"], item["lat"], item["lng"])
        prev = by_area.get(item["area_name"])
        by_area[item["area_name"]] = (min(d, prev[0]) if prev else d, (prev[1] if prev else 0) + 1)
    ranked = sorted(by_area.items(), key=lambda kv: kv[1][0])[:limit]
    return [(name, round(d, 1), n) for name, (d, n) in ranked]


def log_unanswered_query(message: str, session_id: str | None) -> None:
    try:
        path = config.ROOT / "logs" / "unanswered.jsonl"
        path.parent.mkdir(exist_ok=True)
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                                "session_id": session_id, "message": message[:500]}) + "\n")
    except OSError:
        pass


def get_property(property_id: str | None) -> dict[str, Any] | None:
    """A listing by id: active cache first, then a direct DB lookup (any status)."""
    if not property_id:
        return None
    pid = str(property_id).strip()
    for item in load_listings():
        if item["_id"] == pid:
            return item
    try:
        from bson import ObjectId

        query = {"_id": ObjectId(pid)} if ObjectId.is_valid(pid) else {"_id": pid}
        doc = _collection().find_one(query, {"priceHistory": 0, "videos": 0, "media3d": 0, "offer": 0})
        return normalize_listing(doc) if doc else None
    except Exception as error:
        log.info("get_property(%s) failed: %s", pid, error.__class__.__name__)
        return None
