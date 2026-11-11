"""Natural-language understanding: trained spaCy model first, rules as fallback.

parse_message(text) -> {
    "intent": "search_property", "confidence": 0.98, "source": "model",
    "entities": {"AREA": ["DHA Phase 5"], ...},          # what was recognised (for the UI / debugging)
    "slots": {... normalised values used for the database search ...},
}
"""
from __future__ import annotations

import logging
import re
from typing import Any

from app.services.property_catalog import (
    canonical_furnished,
    canonical_purpose,
    canonical_type,
    find_area_mentions,
    norm,
    normalize_area_name,
    TYPE_SYNONYMS,
)
from app.services.travel import TRANSPORT_ALIASES, canonical_transport
from nlp import nlp_parser

log = logging.getLogger("rms.nlu")

MODEL_MIN_CONFIDENCE = 0.55
TRAVEL_INTENTS = {"travel_time", "distance", "travel_cost", "travel_time_cost"}
SMALL_TALK = {"greeting", "thanks", "help", "reset"}

_WORD_NUM = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7,
             "eight": 8, "nine": 9, "ten": 10, "ek": 1, "do": 2, "teen": 3, "char": 4, "paanch": 5}
_ORDINALS = {"first": 1, "1st": 1, "second": 2, "2nd": 2, "third": 3, "3rd": 3, "fourth": 4,
             "4th": 4, "fifth": 5, "5th": 5, "sixth": 6, "6th": 6, "seventh": 7, "7th": 7,
             "last": -1, "pehla": 1, "pehli": 1, "pehle": 1, "dusra": 2, "doosra": 2, "dusri": 2,
             "doosri": 2, "teesra": 3, "teesri": 3}
_ROMAN_WORDS = {"mujhe", "chahiye", "chahye", "chaiye", "kiraya", "kiraye", "ghar", "makan",
                "paas", "qareeb", "kitna", "kitni", "kharcha", "hai", "mein", "hazar", "lakh",
                "dikhao", "batao", "btao", "gari", "wala", "wali", "kya", "koi", "sasta", "aur",
                "karo", "kar", "do", "tak", "se", "ka", "ki", "ke", "liye", "bhai", "shukriya"}


# ---------------------------------------------------------------------------
# value parsers (also used on spans found by the model)
# ---------------------------------------------------------------------------
_AMOUNT = re.compile(
    r"(?:rs\.?|pkr)?\s*(\d+(?:\.\d+)?)\s*(crore|cr|karor|lakh|lakhs|lac|lacs|lak|"
    r"k|thousand|hazar|hazaar|hajar|million|m)\b"
    r"|(?:rs\.?|pkr)\s*(\d{1,3}(?:,\d{3})+|\d{4,9})"
    r"|\b(\d{1,3}(?:,\d{3})+|\d{5,9})\b",
    re.I,
)
_MULT = {"crore": 10_000_000, "cr": 10_000_000, "karor": 10_000_000, "lakh": 100_000,
         "lakhs": 100_000, "lac": 100_000, "lacs": 100_000, "lak": 100_000, "k": 1_000,
         "thousand": 1_000, "hazar": 1_000, "hazaar": 1_000, "hajar": 1_000,
         "million": 1_000_000, "m": 1_000_000}


def _amounts(text: str) -> list[tuple[int, int, int]]:
    """All money amounts in text as (value, start, end)."""
    out = []
    for m in _AMOUNT.finditer(text):
        if m.group(1):
            value = float(m.group(1)) * _MULT[m.group(2).lower()]
        else:
            raw = (m.group(3) or m.group(4)).replace(",", "")
            value = float(raw)
        if value >= 1000:
            out.append((int(round(value)), m.start(), m.end()))
    return out


def parse_amount(text: str) -> int | None:
    found = _amounts(text or "")
    return found[0][0] if found else None


def parse_budget(text: str) -> tuple[int | None, int | None]:
    """(min_budget, max_budget) understanding under / above / between / around."""
    low = text.casefold()
    found = _amounts(text)
    if not found:
        return None, None
    if len(found) >= 2 and re.search(r"\b(between|from|se)\b|\bto\b|-", low):
        a, b = sorted([found[0][0], found[1][0]])
        return a, b
    value, start, _ = found[0]
    before = low[max(0, start - 25):start]
    if re.search(r"(above|over|more than|at least|minimum|min|starting|se zyada|se upar)\s*$", before):
        return value, None
    if re.search(r"(around|about|approx\w*|near|lagbhag|taqreeban)\s*$", before):
        return int(value * 0.8), int(value * 1.15)
    return None, value


def parse_bedrooms(text: str) -> tuple[int | None, str]:
    low = norm(text).replace("-", " ")
    m = re.search(r"\b(\d{1,2}|one|two|three|four|five|six|seven|eight)\s*(\+|plus)?\s*"
                  r"(?:bed(?:room)?s?|bhk|br|kamr[ae]y?|kamron|kamre|room house)\b", low)
    if not m:
        m2 = re.search(r"(\d{1,2})\s*\+\s*(?:bed|bedroom)", text.casefold())
        if not m2:
            return None, "exact"
        return int(m2.group(1)), "min"
    raw = m.group(1)
    value = int(raw) if raw.isdigit() else _WORD_NUM.get(raw)
    mode = "min" if (m.group(2) or "+" in text[m.start():m.end() + 2]
                     or re.search(r"(at least|minimum|or more|ya zyada|\+)", low)) else "exact"
    return value, mode


def parse_type(text: str) -> str | None:
    low = f" {norm(text)} "
    best = None
    for canon, words in TYPE_SYNONYMS.items():
        for w in words:
            idx = low.find(f" {w} ")
            if idx >= 0 and (best is None or idx < best[0] or (idx == best[0] and len(w) > best[2])):
                best = (idx, canon, len(w))
    if best:
        return best[1]
    return _fuzzy_type(low)


def _fuzzy_type(low: str) -> str | None:
    """Typo tolerance for type words, e.g. "apartmnt" -> Apartment, "hosue" -> House."""
    from rapidfuzz import fuzz

    for token in low.split():
        if len(token) < 4:
            continue
        for canon, words in TYPE_SYNONYMS.items():
            for w in words:
                if " " in w or len(w) < 4:
                    continue
                if sorted(token) == sorted(w) or (len(token) >= 5 and fuzz.ratio(token, w) >= 85):
                    return canon
    return None


def parse_furnished(text: str) -> str | None:
    m = re.search(r"\b(fully furnished|semi[- ]?furnished|unfurnished|non[- ]furnished|furnished)\b",
                  text, re.I)
    return canonical_furnished(m.group(1)) if m else None


def parse_ordinal(text: str) -> int | None:
    low = norm(text)
    for word in low.split():
        if word in _ORDINALS:
            return _ORDINALS[word]
    m = re.search(r"(?:number|no|option|property|listing|#)\s*(\d{1,2})\b", text.casefold())
    if m:
        return int(m.group(1))
    m = re.fullmatch(r"\s*#?(\d)\s*", text)
    return int(m.group(1)) if m else None


def parse_transport(text: str) -> str | None:
    low = f" {norm(text)} "
    for alias in sorted(TRANSPORT_ALIASES, key=len, reverse=True):
        if f" {alias} " in low:
            return TRANSPORT_ALIASES[alias]
    return None


_DURATION = re.compile(
    r"\b(\d{1,3})\s*(?:-|to)?\s*(?:\d{1,3}\s*)?(min|mins|minute|minutes|minat|mint|hour|hours|hr|hrs|ghanta|ghante)\b"
    r"|\b(half an hour|aadha ghanta|adha ghanta|an hour|one hour|quarter of an hour)\b", re.I)
_DISTANCE = re.compile(r"\b(\d{1,3}(?:\.\d+)?)\s*(km|kms|kilometers?|kilometres?)\b", re.I)


def parse_duration(text: str) -> int | None:
    """'15 minutes' -> 15, 'half an hour' -> 30, '1 hour' -> 60."""
    m = _DURATION.search(text or "")
    if not m:
        return None
    if m.group(3):
        word = m.group(3).casefold()
        return 30 if ("half" in word or "aadha" in word or "adha" in word) else 15 if "quarter" in word else 60
    value = int(m.group(1))
    return value * 60 if m.group(2).casefold().startswith(("hour", "hr", "ghant")) else value


def parse_distance(text: str) -> float | None:
    m = _DISTANCE.search(text or "")
    return float(m.group(1)) if m else None


# current-property references: "this", "it", "here", "is ghar", "iska" ...
_THIS = re.compile(r"\b(this|it|its|it's|here|that one|that house|that flat|the property|this property|"
                   r"this house|this flat|this apartment|this place|ye|yeh|is ghar|is property|iska|iski|"
                   r"is ka|is ki|is ke|is makan|wahan|yahan)\b", re.I)

# FEATURE words -> canonical feature key
FEATURES: dict[str, tuple[str, ...]] = {
    "furnished": ("furnished", "furniture", "furnish", "unfurnished"),
    "parking": ("parking", "car porch", "garage", "park my car", "park a car"),
    "gas": ("gas", "sui gas", "gas connection"),
    "backup": ("backup", "back up", "generator", "ups", "solar", "load shedding", "loadshedding", "electricity",
               "bijli", "power backup"),
    "water": ("water", "pani", "water supply"),
    "deposit": ("deposit", "security deposit", "advance", "advance payment"),
    "age": ("how old", "year built", "built in", "construction year", "when was it built", "new or old",
            "age of", "brand new", "kitna purana", "purana"),
    "security": ("security", "guard", "gated", "cctv", "safe area", "safety"),
    "lift": ("lift", "elevator"),
    "internet": ("internet", "wifi", "wi-fi", "fiber", "broadband"),
    "floor": ("which floor", "floor", "manzil", "ground floor"),
    "size": ("size", "how big", "covered area", "square feet", "sq ft"),
    "bedrooms": ("bedrooms", "bedroom", "how many rooms", "kitne kamre", "kamray"),
    "bathrooms": ("bathroom", "bathrooms", "washroom", "washrooms"),
    "price": ("rent", "price", "kiraya", "how much is it", "how much does it cost", "monthly rent"),
    "charges": ("maintenance", "other charges", "service charges", "bills", "utility"),
    "pets": ("pets", "pet", "dog", "cat"),
    "family": ("family", "families", "kids", "children", "bachon"),
    "students": ("student", "students", "bachelor", "bachelors"),
    "kitchen": ("kitchen",),
    "garden": ("lawn", "garden"),
    "ac": ("ac", "air conditioner", "air conditioning"),
    "availability": ("available", "availability", "still available", "khali"),
    "nearby": ("nearby", "near it", "near this", "around it", "around here", "aas paas", "surroundings",
               "what's near", "whats near", "what is near", "close by"),
}
NEARBY_CATEGORIES: dict[str, tuple[str, ...]] = {
    "school": ("school", "schools"),
    "hospital": ("hospital", "hospitals", "clinic", "clinics", "doctor", "medical"),
    "mall": ("mall", "malls", "shopping"),
    "market": ("market", "markets", "bazaar", "grocery", "shops"),
    "university": ("university", "universities", "uni", "college", "colleges"),
    "park": ("park", "parks"),
    "mosque": ("mosque", "mosques", "masjid"),
    "transport": ("metro", "bus stop", "station", "transport", "orange line", "airport"),
}
_FEATURE_INDEX = sorted(((w, k) for k, ws in FEATURES.items() for w in ws), key=lambda x: -len(x[0]))


def parse_features(text: str) -> list[str]:
    low = f" {norm(text)} "
    raw = f" {text.casefold()} "
    found: list[str] = []
    for word, key in _FEATURE_INDEX:
        w = norm(word)
        if (f" {w} " in low or f" {word} " in raw) and key not in found:
            found.append(key)
    return found


def parse_nearby_category(text: str) -> str | None:
    low = f" {norm(text)} "
    for cat, words in NEARBY_CATEGORIES.items():
        if any(f" {w} " in low for w in words):
            return cat
    return None


def parse_ordinals(text: str) -> list[int]:
    """All ordinals in order: 'compare the first and third' -> [1, 3]; 'first two' -> [1, 2]."""
    low = norm(text)
    m = re.search(r"\b(first|top|pehle|pehli)\s+(two|three|2|3|do|teen)\b", low)
    if m:
        n = {"two": 2, "2": 2, "do": 2, "three": 3, "3": 3, "teen": 3}[m.group(2)]
        return list(range(1, n + 1))
    if re.search(r"\blast\s+(two|2)\b", low):
        return [-2, -1]
    out = []
    for w in low.split():
        if w in _ORDINALS and _ORDINALS[w] not in out:
            out.append(_ORDINALS[w])
    for m in re.finditer(r"(?:number|no|option|property|listing|#)\s*(\d{1,2})\b", text.casefold()):
        if int(m.group(1)) not in out:
            out.append(int(m.group(1)))
    if not out and re.search(r"\b(compare|vs|versus)\b", low):
        out = list(dict.fromkeys(int(n) for n in re.findall(r"\b([1-9])\b", low)))
    return out


def travelish_text(text: str) -> bool:
    return bool(_TRAVEL_WORDS.search(norm(text)))


_TRAVEL_WORDS = re.compile(r"\b(how far|distance|far from|kitni door|fasla|how long|travel|commut\w*|time to reach|"
                           r"fuel|petrol|fare|by (bike|car|bus|metro|rickshaw)|km|spend\w* .*(going|getting|to))\b")


def language_of(text: str) -> str:
    words = set(norm(text).split())
    return "roman" if len(words & _ROMAN_WORDS) >= 2 else "english"


# ---------------------------------------------------------------------------
# rule-based intent (fallback when the model is missing / unsure)
# ---------------------------------------------------------------------------
_GREETING = re.compile(r"^(hi+|hello|hey+|salam|salaam|assalam\w*|aoa|asalam\w*|good (morning|evening|afternoon)|yo|hiya)\b")
_THANKS = re.compile(r"\b(thanks?|thank you|thx|shukriya|jazak\w*|appreciated)\b")
_HELP = re.compile(r"\b(help|madad|what can you do|how does this work|how do i|who are you|instructions|menu)\b")
_RESET = re.compile(r"\b(reset|start over|new search|clear (all )?filters|clear everything|naya search|nayi search|restart|dobara shuru)\b")
_MORE = re.compile(r"^(show )?(me )?(some )?more\b|\b(next( page| ones)?|load more|aur dikhao|mazeed|other options|what else|show the rest|kuch aur)\b")
_DETAILS = re.compile(r"\b(tell me (more )?about|details?|more info|describe|what about the|is the|amenities of|ki details)\b")
_PRICE = re.compile(r"\b(average|price range|rent range|how much (is|does|are)|prices? (of|in)|kitne ka|kiraya kitna|rent kitna|typical rent|how expensive)\b")
_BOOK = re.compile(r"\b(book|booking|reserve|schedule a visit|visit|contact the owner|rent now)\b")
_TRAVEL = re.compile(r"\b(how far|distance|far from|commut\w*|close to|kitni door|fasla|how long|travel|commute|time to reach|kitna time|kitni der|kitni dair|fuel|petrol|fare|kharcha|kiraya kitna|by (bike|car|bus|metro|rickshaw)|km)\b")
_COMPARE = re.compile(r"\b(compare|comparison|vs|versus|difference between|which is better|which one is better|muqabla|farq)\b")
_NEARBY = re.compile(r"\b(what s near|whats near|what is near|what s around|nearby|near it|near this|around it|"
                     r"around here|close by|aas paas|surroundings|"
                     r"(schools?|hospitals?|malls?|markets?|parks?|clinics?|colleges?|universities) "
                     r"(near|around|close to|nearby|ke paas)( it| this| here| the)?)\b")
_AREA_INFO = re.compile(r"\b(average (rent|price)|avg (rent|price)|tell me about|what is .+ like|how is .+ for living|"
                        r"which area|cheapest area|best area|areas? (for|with)|is .+ a good area|"
                        r"rent in .+ (kya|kitna)|area info|about the area|cheapest in|most affordable area)\b")
_NEAR = re.compile(r"\b(near|nearby|close to|walking distance|within|around|ke paas|ke qareeb|ke nazdeek|paas|qareeb)\b")
_CHEAPER = re.compile(r"\b(cheaper|cheapest|less expensive|lower price|sasta|sasti|budget friendly|affordable|kam qeemat)\b")
_PRICIER = re.compile(r"\b(more expensive|expensive ones|luxur\w*|premium|bigger|mehnga|mehngi|costlier)\b")


def _rules_intent(text: str, slots: dict[str, Any]) -> str:
    low = norm(text)
    raw = text.casefold().strip()
    has_property_slot = any(slots.get(k) for k in ("area", "property_type", "max_budget", "min_budget",
                                                   "bedrooms", "purpose", "furnished"))
    if _RESET.search(low):
        return "reset"
    if _GREETING.search(raw) and len(low.split()) <= 5 and not has_property_slot:
        return "greeting"
    if _THANKS.search(low) and len(low.split()) <= 6:
        return "thanks"
    if _MORE.search(low) and len(low.split()) <= 5:
        return "show_more"
    if _COMPARE.search(low) and (len(slots.get("ordinals") or []) >= 1 or slots.get("this_ref")
                                 or re.search(r"\b(them|these|both|those|listings|options|properties|two)\b", low)):
        return "compare"
    place = slots.get("near") or slots.get("destination")
    if _NEARBY.search(low) and not (slots.get("property_type") and place):
        return "nearby_places"
    if (slots.get("property_type") and place and place.get("kind") != "area"
            and (_NEAR.search(low) or slots.get("duration_min") or slots.get("distance_km"))):
        return "near_search"
    if re.search(r"\b(which area|cheapest area|best area|most affordable area|areas? (for|with))\b", low):
        return "area_info"
    if _AREA_INFO.search(low) and slots.get("area") and slots.get("ordinal") is None \
            and not slots.get("this_ref") and not slots.get("bedrooms"):
        return "area_info"
    if slots.get("this_ref") and (slots.get("features") or _TRAVEL.search(low)
                                  or re.search(r"\b(good|suitable|ok|theek)\b", low)) \
            and not (slots.get("area") and slots.get("property_type")):
        return "property_question"
    asked = [f for f in (slots.get("features") or []) if f not in ("price", "availability")]
    if asked and not has_property_slot and not slots.get("area") and re.search(
            r"(\?|\b(is|does|do|has|have|what|whats|how|kya|hai|any|got)\b)", raw):
        return "property_question"
    if slots.get("ordinal") is not None and (_DETAILS.search(low) or len(low.split()) <= 6):
        return "book_property" if _BOOK.search(low) else "property_details"
    if (_TRAVEL.search(low) and (slots.get("origin") or slots.get("destination"))):
        if has_property_slot and slots.get("property_type"):
            return "property_with_travel"
        return "travel_time_cost"
    if _HELP.search(low) and not has_property_slot:
        return "help"
    if _PRICE.search(low):
        return "price_inquiry"
    if _BOOK.search(low):
        return "book_property"
    if slots.get("area") or slots.get("property_type") or slots.get("purpose"):
        if not slots.get("area") and not slots.get("property_type"):
            return "refine_search"
        return "search_property"
    if has_property_slot or _CHEAPER.search(low) or _PRICIER.search(low):
        return "refine_search"
    if re.search(r"\b(property|properties|listing|listings|rent|rental|kiraye|chahiye|find|search|show)\b", low):
        return "search_property"
    return "unknown"


# ---------------------------------------------------------------------------
# main entry
# ---------------------------------------------------------------------------
def _resolve_place(span_text: str) -> dict[str, Any] | None:
    return normalize_area_name(span_text) if span_text else None


def _travel_roles(text: str, mentions: list[tuple[int, int, dict]]) -> tuple[dict | None, dict | None]:
    """Origin/destination from word order: 'from A to B', 'A se B', 'how far is B from A'."""
    if not mentions:
        return None, None
    places_ = [m[2] for m in mentions]
    low = norm(text)
    if len(places_) == 1:
        return None, places_[0]
    first, second = places_[0], places_[1]
    if re.search(r"\b(how far is|how long to reach|time to reach|distance to)\b.+\bfrom\b", low):
        return second, first                      # "how far is LUMS from DHA" -> DHA -> LUMS
    return first, second


def parse_message(text: str) -> dict[str, Any]:
    text = (text or "").strip()
    analysis = None
    try:
        analysis = nlp_parser.analyze(text)
    except Exception as error:  # the optional model must never break the bot
        log.warning("model inference failed: %s", error)
    ents: dict[str, list[str]] = dict(analysis["entities"]) if analysis else {}

    mentions = find_area_mentions(text)
    min_b, max_b = parse_budget(text)
    bedrooms, bed_mode = parse_bedrooms(text)
    slots: dict[str, Any] = {
        "area": None,
        "near": None,
        "property_type": parse_type(text),
        "purpose": None,
        "min_budget": min_b,
        "max_budget": max_b,
        "bedrooms": bedrooms,
        "bedrooms_mode": bed_mode,
        "furnished": parse_furnished(text),
        "origin": None,
        "destination": None,
        "transport": parse_transport(text),
        "ordinal": parse_ordinal(text),
        "cheaper": bool(_CHEAPER.search(text.casefold())),
        "duration_min": parse_duration(text),
        "distance_km": parse_distance(text),
        "this_ref": bool(_THIS.search(text)),
        "features": parse_features(text),
        "nearby_category": parse_nearby_category(text),
        "ordinals": parse_ordinals(text),
        "commute": bool(re.search(r"\b(daily|every day|everyday|monthly|per month|a month|month|mahana|mahine|roz|"
                                  r"rozana|commut\w*|spend|aana jaana|aane jaane)\b", text.casefold())),
        "pricier": bool(_PRICIER.search(text.casefold())),
    }

    # ---- model entities fill / correct the rule slots
    if ents.get("PROPERTY_TYPE") and not slots["property_type"]:
        slots["property_type"] = canonical_type(ents["PROPERTY_TYPE"][0])
    if ents.get("BUDGET") and slots["max_budget"] is None and slots["min_budget"] is None:
        slots["max_budget"] = parse_amount(ents["BUDGET"][0])
    if ents.get("BEDROOMS") and slots["bedrooms"] is None:
        slots["bedrooms"], slots["bedrooms_mode"] = parse_bedrooms(ents["BEDROOMS"][0])
    if ents.get("FURNISHED") and not slots["furnished"]:
        slots["furnished"] = canonical_furnished(ents["FURNISHED"][0]) or None
    if ents.get("ORDINAL") and slots["ordinal"] is None:
        o = ents["ORDINAL"][0].casefold()
        slots["ordinal"] = _ORDINALS.get(o) or (int(o) if o.isdigit() else None)
    if ents.get("TRANSPORT") and not slots["transport"]:
        slots["transport"] = canonical_transport(ents["TRANSPORT"][0])
    if ents.get("DURATION") and not slots["duration_min"]:
        slots["duration_min"] = parse_duration(ents["DURATION"][0])
    if ents.get("DISTANCE") and not slots["distance_km"]:
        slots["distance_km"] = parse_distance(ents["DISTANCE"][0])
    for feature_text in ents.get("FEATURE", []):
        for key in parse_features(feature_text):
            if key not in slots["features"]:
                slots["features"].append(key)
    if slots["features"] == ["price"] and travelish_text(text):
        slots["features"] = []                     # "how much would I spend commuting" is travel cost

    intent = analysis["intent"] if analysis else None
    confidence = analysis["confidence"] if analysis else 0.0
    travelish = intent in TRAVEL_INTENTS or intent == "property_with_travel" or bool(_TRAVEL.search(norm(text)))

    purpose_text = (ents.get("PURPOSE") or [None])[0]
    if purpose_text:
        slots["purpose"] = canonical_purpose(purpose_text)
    elif not travelish:
        slots["purpose"] = canonical_purpose(text)
    elif re.search(r"\b(for rent|for sale|to buy|to rent)\b", text.casefold()):
        slots["purpose"] = canonical_purpose(text)

    # places: model roles first, then word order
    origin = _resolve_place(ents["ORIGIN"][0]) if ents.get("ORIGIN") else None
    destination = _resolve_place(ents["DESTINATION"][0]) if ents.get("DESTINATION") else None
    area = _resolve_place(ents["AREA"][0]) if ents.get("AREA") else None
    landmark = _resolve_place(ents["LANDMARK"][0]) if ents.get("LANDMARK") else None
    used = {p["name"] for p in (origin, destination, area, landmark) if p}
    rest = [m for m in mentions if m[2]["name"] not in used]
    if travelish and intent != "property_with_travel":
        if not origin and not destination:
            origin, destination = _travel_roles(text, mentions)
        elif not origin and rest and destination:
            origin = rest[0][2]
        elif not destination and rest and origin:
            destination = rest[0][2]
    else:
        if not area:
            area_like = [m[2] for m in rest if m[2]["kind"] in ("area", "parent")]
            if area_like:
                area = area_like[0]
            elif rest and not destination:
                destination = rest[0][2]          # "flat near UET" -> search near a place
        if intent == "property_with_travel" and not destination:
            others = [m[2] for m in rest if not area or m[2]["name"] != area["name"]]
            destination = others[0] if others else None
    if landmark and not destination and not (origin and origin["name"] == landmark["name"]):
        destination = landmark
    if area and area["kind"] in ("university", "landmark"):
        destination, area = destination or area, None
    slots["area"], slots["origin"], slots["destination"] = area, origin, destination
    if not area and destination and not travelish:
        slots["near"] = destination

    # ---- intent decision: model if confident, rules otherwise
    rule_intent = _rules_intent(text, slots)
    source = "model"
    has_property_slot = any(slots.get(k) for k in ("area", "property_type", "max_budget", "bedrooms", "near"))
    if not analysis or confidence < MODEL_MIN_CONFIDENCE:
        intent, source = rule_intent, "rules"
    elif intent in SMALL_TALK and has_property_slot and len(text.split()) > 3:
        intent, source = rule_intent, "model+rules"          # "hi, I need a flat in DHA"
    elif intent in TRAVEL_INTENTS and not (slots["origin"] or slots["destination"]):
        intent, source = rule_intent, "model+rules"
    elif intent == "property_details" and slots["ordinal"] is None and rule_intent != "unknown":
        intent, source = rule_intent, "model+rules"
    elif (intent in ("price_inquiry", "search_property", "refine_search") and ents.get("ORIGIN")
          and ents.get("DESTINATION") and not ents.get("PROPERTY_TYPE")):
        intent, source = "travel_cost", "model+rules"        # "how much does a rickshaw cost from A to B"
    elif (intent in TRAVEL_INTENTS and slots["property_type"] and slots["destination"]
          and (slots["area"] or slots["origin"])
          and re.match(r"\s*(i need |need |show |find |any )?(a |an )?\w*\s*(house|flat|apartment|room|portion)",
                       text.casefold())):
        # "house in Johar Town and how long to reach UCP" -> search there + travel to UCP
        slots["area"] = slots["area"] or slots["origin"]
        slots["origin"] = None
        intent, source = "property_with_travel", "model+rules"
    elif intent == "search_property" and rule_intent == "help" and not has_property_slot:
        intent, source = "help", "model+rules"
    elif intent in ("search_property", "refine_search", "property_details", "price_inquiry", "greeting", "thanks",
                    "help", "show_more") and rule_intent in (
            "compare", "nearby_places", "property_question", "near_search", "area_info"):
        intent, source = rule_intent, "model+rules"
    elif intent == "near_search" and not (slots["near"] or slots["destination"] or slots["area"]):
        intent, source = rule_intent, "model+rules"
    elif intent == "compare" and not _COMPARE.search(norm(text)) and rule_intent != "unknown":
        intent, source = rule_intent, "model+rules"
    elif intent in ("search_property", "refine_search") and slots["property_type"] and slots["near"] \
            and slots["near"].get("kind") != "area":
        intent, source = "near_search", "model+rules"
    if intent in TRAVEL_INTENTS:
        intent_group = "travel"
    else:
        intent_group = intent

    # entities for the response (human readable)
    entities = {k: v for k, v in ents.items()}
    if slots["duration_min"] and "DURATION" not in entities:
        entities["DURATION"] = [f"{slots['duration_min']} min"]
    if slots["features"] and "FEATURE" not in entities:
        entities["FEATURE"] = list(slots["features"])
    for key, label in (("area", "AREA"), ("origin", "ORIGIN"), ("destination", "DESTINATION")):
        if slots[key] and label not in entities:
            entities[label] = [slots[key]["name"]]
    return {
        "intent": intent,
        "intent_group": intent_group,
        "confidence": confidence if source == "model" else None,
        "source": source,
        "model_intent": analysis["intent"] if analysis else None,
        "entities": entities,
        "slots": slots,
        "language": language_of(text),
    }
