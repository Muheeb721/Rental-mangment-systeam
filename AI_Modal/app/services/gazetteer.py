"""Lahore places (areas + landmarks) with approximate coordinates.

Sources, merged at startup (and refreshed every PLACES_TTL_SECONDS):
  1. the website's dataset  RMS-Backend/public/data/lahore-places.json   (file, preferred)
  2. the website's API      GET {BACKEND_URL}/api/places                  (if the file is missing)
  3. the local list below   (always present; fills gaps and works offline)

Backend entries win when the same place exists in both (so distances agree with the
website). Coordinates are approximate centres (good to roughly 1 km) - enough for estimates.

Every place is a dict:
  {"name", "slug", "lat", "lng", "kind": area|university|landmark, "category", "parent",
   "aliases": [...], "source": "backend"|"local"}
"""
from __future__ import annotations

import json
import logging
import re
import threading
import time
from typing import Any

from app import config

log = logging.getLogger("rms.places")

# name, lat, lng, kind, category, parent, extra aliases
_LOCAL: list[tuple[str, float, float, str, str, str, tuple[str, ...]]] = [
    # ---- DHA Lahore
    ("DHA Phase 1", 31.4790, 74.3920, "area", "area", "DHA Lahore", ("dha 1", "dha ph 1")),
    ("DHA Phase 2", 31.4700, 74.4120, "area", "area", "DHA Lahore", ("dha 2",)),
    ("DHA Phase 3", 31.4740, 74.3800, "area", "area", "DHA Lahore", ("dha 3",)),
    ("DHA Phase 4", 31.4640, 74.3890, "area", "area", "DHA Lahore", ("dha 4",)),
    ("DHA Phase 5", 31.4630, 74.4100, "area", "area", "DHA Lahore", ("dha 5", "dha v")),
    ("DHA Phase 6", 31.4720, 74.4500, "area", "area", "DHA Lahore", ("dha 6", "dha vi")),
    ("DHA Phase 7", 31.4440, 74.4560, "area", "area", "DHA Lahore", ("dha 7",)),
    ("DHA Phase 8", 31.4990, 74.4280, "area", "area", "DHA Lahore", ("air avenue", "dha 8")),
    ("DHA Phase 9", 31.4810, 74.4880, "area", "area", "DHA Lahore", ("dha prism", "phase 9 prism", "dha 9")),
    ("DHA Phase 10", 31.4690, 74.5100, "area", "area", "DHA Lahore", ("dha 10",)),
    ("DHA Phase 11", 31.3960, 74.2650, "area", "area", "DHA Lahore", ("dha rahbar", "dha 11")),
    ("DHA Phase 12", 31.4120, 74.2450, "area", "area", "DHA Lahore", ("dha eme", "dha 12")),
    ("DHA Phase 13", 31.5300, 74.5350, "area", "area", "DHA Lahore", ("dha 13",)),
    ("DHA Raya", 31.4600, 74.4700, "area", "area", "DHA Lahore", ()),
    # ---- Askari
    ("Askari 10", 31.5110, 74.4000, "area", "area", "Askari", ("askari x",)),
    ("Askari 11", 31.4430, 74.3960, "area", "area", "Askari", ("askari xi",)),
    ("Askari 9", 31.5210, 74.3860, "area", "area", "Askari", ()),
    ("Askari 5", 31.5020, 74.3750, "area", "area", "Askari", ()),
    ("Askari 1", 31.5230, 74.3820, "area", "area", "Askari", ()),
    # ---- Bahria
    ("Bahria Town", 31.3680, 74.1820, "area", "area", "Bahria Town", ("bahria town lahore", "btl")),
    ("Bahria Orchard", 31.3480, 74.2190, "area", "area", "Bahria Town", ()),
    # ---- Gulberg
    ("Gulberg 2", 31.5260, 74.3500, "area", "area", "Gulberg", ("gulberg ii",)),
    ("Gulberg 3", 31.5130, 74.3470, "area", "area", "Gulberg", ("gulberg iii",)),
    ("Gulberg 5", 31.5280, 74.3560, "area", "area", "Gulberg", ("gulberg v",)),
    ("Gulberg", 31.5180, 74.3490, "area", "area", "Gulberg", ("gulberg lahore",)),
    # ---- other housing areas
    ("Johar Town", 31.4690, 74.2720, "area", "area", "", ("johar town lahore", "jt", "johar")),
    ("Model Town", 31.4840, 74.3240, "area", "area", "", ("model town lahore",)),
    ("Wapda Town", 31.4410, 74.2650, "area", "area", "", ()),
    ("Garden Town", 31.5020, 74.3230, "area", "area", "", ()),
    ("Faisal Town", 31.4790, 74.3050, "area", "area", "", ()),
    ("Allama Iqbal Town", 31.5110, 74.2860, "area", "area", "", ("iqbal town", "aiq town")),
    ("Township", 31.4520, 74.3080, "area", "area", "", ()),
    ("Green Town", 31.4400, 74.3050, "area", "area", "", ()),
    ("Cantt", 31.5200, 74.3800, "area", "area", "", ("lahore cantt", "cantonment", "cantt lahore")),
    ("Cavalry Ground", 31.5050, 74.3700, "area", "area", "", ()),
    ("Walton", 31.4980, 74.3550, "area", "area", "", ("walton road",)),
    ("Shadman", 31.5380, 74.3330, "area", "area", "", ()),
    ("Samanabad", 31.5320, 74.2950, "area", "area", "", ()),
    ("Valencia Town", 31.4040, 74.2420, "area", "area", "", ("valencia",)),
    ("Lake City", 31.3950, 74.2280, "area", "area", "", ()),
    ("Paragon City", 31.5520, 74.4560, "area", "area", "", ()),
    ("State Life Society", 31.4500, 74.2350, "area", "area", "", ("state life",)),
    ("Eden Gardens", 31.4390, 74.3140, "area", "area", "", ("eden society",)),
    ("Park View", 31.4330, 74.2440, "area", "area", "", ("park view city",)),
    ("Central Park", 31.3780, 74.2680, "area", "area", "", ()),
    ("Gulshan-e-Ravi", 31.5450, 74.2780, "area", "area", "", ("gulshan e ravi",)),
    ("Mall Road", 31.5600, 74.3270, "area", "area", "", ()),
    ("Thokar Niaz Baig", 31.4700, 74.2400, "area", "area", "", ("thokar",)),
    ("Lahore Smart City", 31.2860, 74.1700, "area", "area", "", ()),
    ("Al-Kabir Town", 31.3870, 74.1980, "area", "area", "", ("al kabir",)),
    ("Sabzazar", 31.5250, 74.2700, "area", "area", "", ()),
    ("Muslim Town", 31.5050, 74.3060, "area", "area", "", ()),
    ("Mughalpura", 31.5650, 74.3700, "area", "area", "", ()),
    ("Ichra", 31.5300, 74.3120, "area", "area", "", ()),
    ("Harbanspura", 31.5700, 74.4100, "area", "area", "", ()),
    ("Baghbanpura", 31.5850, 74.3800, "area", "area", "", ()),
    ("Shalimar Town", 31.5880, 74.3850, "area", "area", "", ()),
    ("Fazaia Housing Scheme", 31.4000, 74.3700, "area", "area", "", ("fazaia",)),
    ("Izmir Town", 31.4310, 74.2390, "area", "area", "", ("izmir",)),
    ("NFC Society", 31.4560, 74.2560, "area", "area", "", ("nfc",)),
    ("EME Society", 31.4310, 74.2250, "area", "area", "", ("eme",)),
    ("Nespak Society", 31.4230, 74.2330, "area", "area", "", ("nespak",)),
    ("PCSIR Housing", 31.4440, 74.2660, "area", "area", "", ("pcsir",)),
    ("Canal Gardens", 31.4040, 74.2770, "area", "area", "", ()),
    ("Sui Gas Society", 31.4380, 74.4180, "area", "area", "", ("sui gas",)),
    ("Bedian Road", 31.4200, 74.4500, "area", "area", "", ()),
    ("Barki Road", 31.4900, 74.4800, "area", "area", "", ()),
    ("Ferozepur Road", 31.4700, 74.3250, "area", "area", "", ()),
    ("Raiwind Road", 31.4100, 74.2300, "area", "area", "", ()),
    ("Multan Road", 31.5000, 74.2500, "area", "area", "", ()),
    ("Kot Lakhpat", 31.4650, 74.3330, "area", "area", "", ()),
    ("Garhi Shahu", 31.5590, 74.3480, "area", "area", "", ("ghari shahu",)),
    ("Krishan Nagar", 31.5560, 74.2980, "area", "area", "", ()),
    ("Islampura", 31.5600, 74.2950, "area", "area", "", ()),
    ("Shad Bagh", 31.5900, 74.3290, "area", "area", "", ()),
    ("Walled City", 31.5830, 74.3150, "area", "area", "", ("old lahore", "androon shehar")),
    ("Etihad Town", 31.4100, 74.2000, "area", "area", "", ()),
    ("Jubilee Town", 31.4550, 74.2400, "area", "area", "", ()),
    ("Sukh Chayn Gardens", 31.4020, 74.2210, "area", "area", "", ("sukh chain",)),
    ("Divine Gardens", 31.5300, 74.4100, "area", "area", "", ()),
    ("Tajpura", 31.5400, 74.4000, "area", "area", "", ()),
    ("Khayaban-e-Amin", 31.4180, 74.2470, "area", "area", "", ("khayaban e amin",)),
    ("LDA Avenue", 31.4120, 74.2560, "area", "area", "", ()),
    ("Punjab Cooperative Housing Society", 31.4870, 74.4020, "area", "area", "", ("pchs", "punjab society")),
    ("Bankers Town", 31.4540, 74.2910, "area", "area", "", ()),
    # ---- universities / colleges
    ("LUMS", 31.4707, 74.4097, "university", "university", "", ("lahore university of management sciences", "lums university")),
    ("UET Lahore", 31.5790, 74.3570, "university", "university", "", ("uet", "university of engineering and technology")),
    ("FAST NUCES Lahore", 31.4815, 74.3030, "university", "university", "", ("fast", "nuces", "fast nuces", "fast university")),
    ("Punjab University", 31.4970, 74.2980, "university", "university", "", ("pu", "punjab uni", "university of the punjab", "punjab university lahore", "pu new campus")),
    ("GC University Lahore", 31.5730, 74.3090, "university", "university", "", ("gcu", "gc university", "government college university")),
    ("UMT", 31.4480, 74.2690, "university", "university", "", ("university of management and technology",)),
    ("UCP", 31.4470, 74.2680, "university", "university", "", ("university of central punjab",)),
    ("Superior University", 31.4070, 74.2350, "university", "university", "", ("superior",)),
    ("NCA Lahore", 31.5690, 74.3110, "university", "university", "", ("nca", "national college of arts")),
    ("Forman Christian College", 31.5220, 74.3350, "university", "university", "", ("fcc", "fc college", "forman")),
    ("LCWU", 31.5310, 74.3190, "university", "university", "", ("lahore college for women university",)),
    ("King Edward Medical University", 31.5700, 74.3110, "university", "university", "", ("kemu", "king edward")),
    ("University of Lahore", 31.3900, 74.2400, "university", "university", "", ("uol",)),
    ("Beaconhouse National University", 31.4160, 74.2290, "university", "university", "", ("bnu",)),
    ("COMSATS Lahore", 31.4000, 74.2110, "university", "university", "", ("comsats",)),
    ("Kinnaird College", 31.5250, 74.3350, "university", "university", "", ("kinnaird",)),
    ("ITU Lahore", 31.4760, 74.3430, "university", "university", "", ("itu", "information technology university")),
    ("Lahore School of Economics", 31.4210, 74.3220, "university", "university", "", ("lse", "lahore school")),
    ("Lahore Garrison University", 31.4630, 74.4090, "university", "university", "", ("lgu",)),
    ("University of Education Lahore", 31.5190, 74.3330, "university", "university", "", ("ue lahore",)),
    ("UVAS Lahore", 31.5640, 74.3170, "university", "university", "", ("uvas",)),
    ("Minhaj University", 31.4560, 74.2760, "university", "university", "", ("minhaj",)),
    ("Riphah International University Lahore", 31.4610, 74.2390, "university", "university", "", ("riphah",)),
    ("Hajvery University", 31.5130, 74.3400, "university", "university", "", ("hajvery",)),
    ("Government College for Women Gulberg", 31.5160, 74.3460, "university", "university", "", ()),
    ("Aitchison College", 31.5470, 74.3360, "landmark", "school", "", ("aitchison",)),
    ("Lahore Grammar School DHA", 31.4790, 74.4060, "landmark", "school", "", ("lgs dha",)),
    ("Lahore Grammar School Johar Town", 31.4700, 74.2810, "landmark", "school", "", ("lgs johar town",)),
    ("Beaconhouse School Gulberg", 31.5150, 74.3480, "landmark", "school", "", ("beaconhouse gulberg",)),
    ("Beaconhouse School DHA", 31.4720, 74.4020, "landmark", "school", "", ("beaconhouse dha",)),
    ("The City School DHA", 31.4680, 74.3960, "landmark", "school", "", ("city school dha",)),
    ("Crescent Model School", 31.5400, 74.3300, "landmark", "school", "", ()),
    ("Divisional Public School Model Town", 31.4830, 74.3170, "landmark", "school", "", ("dps model town",)),
    ("Lahore American School", 31.5180, 74.3550, "landmark", "school", "", ()),
    ("Army Public School Cantt", 31.5180, 74.3760, "landmark", "school", "", ("aps cantt",)),
    # ---- hospitals
    ("Shaukat Khanum Hospital", 31.4500, 74.2660, "landmark", "hospital", "", ("shaukat khanum", "skmch")),
    ("Jinnah Hospital", 31.4830, 74.2980, "landmark", "hospital", "", ()),
    ("Services Hospital", 31.5390, 74.3390, "landmark", "hospital", "", ()),
    ("Mayo Hospital", 31.5720, 74.3150, "landmark", "hospital", "", ()),
    ("Sir Ganga Ram Hospital", 31.5530, 74.3240, "landmark", "hospital", "", ("ganga ram",)),
    ("Lahore General Hospital", 31.4710, 74.3330, "landmark", "hospital", "", ("general hospital",)),
    ("Ittefaq Hospital", 31.4880, 74.3260, "landmark", "hospital", "", ("ittefaq",)),
    ("Doctors Hospital", 31.4730, 74.2730, "landmark", "hospital", "", ()),
    ("Hameed Latif Hospital", 31.5240, 74.3540, "landmark", "hospital", "", ("hameed latif",)),
    ("National Hospital DHA", 31.4740, 74.3950, "landmark", "hospital", "", ("national hospital",)),
    ("CMH Lahore", 31.5150, 74.3690, "landmark", "hospital", "", ("cmh", "combined military hospital")),
    ("Children's Hospital", 31.4950, 74.3270, "landmark", "hospital", "", ("childrens hospital",)),
    ("Punjab Institute of Cardiology", 31.5290, 74.3500, "landmark", "hospital", "", ()),
    ("Farooq Hospital DHA", 31.4840, 74.3930, "landmark", "hospital", "", ("farooq hospital",)),
    ("Evercare Hospital", 31.4890, 74.2820, "landmark", "hospital", "", ("evercare",)),
    # ---- malls / markets
    ("Liberty Market", 31.5100, 74.3440, "landmark", "market", "", ("liberty",)),
    ("Emporium Mall", 31.4670, 74.2660, "landmark", "mall", "", ("emporium",)),
    ("Packages Mall", 31.4710, 74.3560, "landmark", "mall", "", ("packages",)),
    ("Mall of Lahore", 31.5040, 74.3720, "landmark", "mall", "", ()),
    ("Fortress Square", 31.5120, 74.3650, "landmark", "mall", "", ("fortress stadium", "fortress")),
    ("Amanah Mall", 31.4900, 74.3170, "landmark", "mall", "", ("amanah",)),
    ("Hafeez Centre", 31.5170, 74.3410, "landmark", "market", "", ("hafeez center",)),
    ("Y Block Market", 31.4740, 74.3890, "landmark", "market", "", ("y block",)),
    ("MM Alam Road", 31.5150, 74.3500, "landmark", "market", "", ("mm alam",)),
    ("Anarkali", 31.5680, 74.3110, "landmark", "market", "", ("anarkali bazaar",)),
    ("Moon Market", 31.5130, 74.2850, "landmark", "market", "", ()),
    ("Gulberg Main Boulevard", 31.5200, 74.3510, "landmark", "market", "", ("main boulevard gulberg",)),
    ("Xinhua Mall", 31.5110, 74.3510, "landmark", "mall", "", ()),
    ("Pace Shopping Mall", 31.5170, 74.3500, "landmark", "mall", "", ("pace",)),
    # ---- transport
    ("Lahore Airport", 31.5216, 74.4036, "landmark", "transport", "", ("allama iqbal international airport", "airport")),
    ("Lahore Railway Station", 31.5780, 74.3360, "landmark", "transport", "", ("railway station",)),
    ("Daewoo Terminal Thokar", 31.4700, 74.2430, "landmark", "transport", "", ("daewoo terminal", "daewoo")),
    ("Badami Bagh Bus Stand", 31.5870, 74.3170, "landmark", "transport", "", ("badami bagh",)),
    ("Kalma Chowk", 31.5040, 74.3320, "landmark", "transport", "", ("kalma chowk metro",)),
    ("Ali Town Station", 31.4580, 74.2450, "landmark", "transport", "", ("ali town",)),
    ("Model Town Metro Station", 31.4890, 74.3280, "landmark", "transport", "", ()),
    ("Chungi Amar Sidhu", 31.4800, 74.3380, "landmark", "transport", "", ()),
    # ---- parks / sights / other
    ("Minar-e-Pakistan", 31.5925, 74.3095, "landmark", "sight", "", ("minar e pakistan", "greater iqbal park")),
    ("Badshahi Mosque", 31.5880, 74.3100, "landmark", "sight", "", ("badshahi masjid",)),
    ("Lahore Fort", 31.5880, 74.3150, "landmark", "sight", "", ("shahi qila",)),
    ("Gaddafi Stadium", 31.5135, 74.3330, "landmark", "sport", "", ("gaddafi",)),
    ("Data Darbar", 31.5790, 74.3040, "landmark", "sight", "", ()),
    ("Jilani Park", 31.5470, 74.3380, "landmark", "park", "", ("racecourse park", "race course park")),
    ("Model Town Park", 31.4810, 74.3240, "landmark", "park", "", ()),
    ("Bagh-e-Jinnah", 31.5550, 74.3290, "landmark", "park", "", ("lawrence garden", "bagh e jinnah")),
    ("Jallo Park", 31.5800, 74.4700, "landmark", "park", "", ()),
    ("Gulshan-e-Iqbal Park", 31.5200, 74.2870, "landmark", "park", "", ("gulshan e iqbal park",)),
    ("Lahore Zoo", 31.5560, 74.3260, "landmark", "park", "", ("zoo",)),
    ("Arfa Software Technology Park", 31.4770, 74.3430, "landmark", "office", "", ("arfa tower", "arfa")),
    ("Expo Centre Lahore", 31.4660, 74.2700, "landmark", "office", "", ("expo centre", "expo center")),
    ("Punjab Civil Secretariat", 31.5660, 74.3200, "landmark", "office", "", ("civil secretariat",)),
    ("Lahore High Court", 31.5640, 74.3220, "landmark", "office", "", ("high court",)),
]

# Generic society names: a search for "DHA" covers every DHA phase, etc.
PARENTS = {
    "DHA Lahore": {"aliases": ("dha", "dha lahore", "defence", "defence housing authority"),
                   "lat": 31.4700, "lng": 74.4100},
    "Askari": {"aliases": ("askari", "askri"), "lat": 31.5100, "lng": 74.3900},
    "Bahria Town": {"aliases": ("bahria", "bahria town", "bahria town lahore", "behria"),
                    "lat": 31.3680, "lng": 74.1820},
    "Gulberg": {"aliases": ("gulberg", "gulberg lahore"), "lat": 31.5180, "lng": 74.3490},
}

# backend parent / area slugs -> our society parents
PARENT_BY_SLUG = {"dha-lahore": "DHA Lahore", "askari": "Askari", "gulberg": "Gulberg",
                  "bahria-town": "Bahria Town", "bahria-orchard": "Bahria Town"}
LOCAL_SNAPSHOT = config.ROOT / "data" / "lahore-places.json"

_UNI_WORDS = ("university", "college", "institute", "education", "school of", "campus")


def _norm(text: Any) -> str:
    text = str(text or "").casefold()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def slugify(name: str) -> str:
    return _norm(name).replace(" ", "-")


def _local_places() -> list[dict]:
    out = []
    for name, lat, lng, kind, category, parent, aliases in _LOCAL:
        out.append({"name": name, "slug": slugify(name), "lat": lat, "lng": lng, "kind": kind,
                    "category": category, "parent": parent, "aliases": [name.lower(), *aliases],
                    "source": "local"})
    return out


# ---------------------------------------------------------------------------
# backend dataset (file or API), tolerant of the exact JSON shape
# ---------------------------------------------------------------------------
def _coords(item: dict) -> tuple[float | None, float | None]:
    for la, ln in (("lat", "lng"), ("latitude", "longitude"), ("lat", "lon")):
        if item.get(la) is not None and item.get(ln) is not None:
            try:
                return float(item[la]), float(item[ln])
            except (TypeError, ValueError):
                pass
    for key in ("coordinates", "coords", "location", "center", "centre"):
        c = item.get(key)
        if isinstance(c, dict):
            lat, lng = _coords(c)
            if lat is not None:
                return lat, lng
            if c.get("coordinates"):
                c = c["coordinates"]
        if isinstance(c, (list, tuple)) and len(c) == 2:
            a, b = float(c[0]), float(c[1])
            return (a, b) if 20 < a < 40 else (b, a)          # [lat,lng] or GeoJSON [lng,lat]
    return None, None


def _backend_kind(item: dict, hint: str) -> tuple[str, str]:
    t = _norm(" ".join(str(item.get(k) or "") for k in ("type", "kind", "placeType")) or hint)
    cat = _norm(item.get("category") or item.get("subType") or "")
    name = _norm(item.get("name"))
    if "area" in t or "society" in t or "neighbourhood" in t or "neighborhood" in t or hint == "area":
        return "area", "area"
    if cat in ("university", "universities", "college", "education") or (
            not cat and any(w in name for w in _UNI_WORDS)):
        return "university", "university"
    return "landmark", (cat.rstrip("s") if cat else "landmark")


def _parse_backend(payload: Any) -> list[dict]:
    items: list[tuple[dict, str]] = []

    def collect(obj: Any, hint: str = "") -> None:
        if isinstance(obj, list):
            for x in obj:
                if isinstance(x, dict) and x.get("name"):
                    items.append((x, hint))
        elif isinstance(obj, dict):
            for key in ("areas", "landmarks", "places", "data", "items", "results"):
                if key in obj:
                    collect(obj[key], "area" if key == "areas" else
                            ("landmark" if key == "landmarks" else hint))
    collect(payload)
    out = []
    for item, hint in items:
        lat, lng = _coords(item)
        if lat is None or not (30.5 < lat < 32.5 and 73.5 < lng < 75.5):
            continue
        kind, category = _backend_kind(item, hint)
        aliases = item.get("aliases") or item.get("alias") or []
        if isinstance(aliases, str):
            aliases = [a.strip() for a in aliases.split(",")]
        slug = str(item.get("slug") or item.get("id") or slugify(str(item["name"])))
        if kind == "area" and not item.get("parent") and slug in PARENT_BY_SLUG                 and PARENT_BY_SLUG[slug] != "Bahria Town":
            continue                                 # "DHA Lahore" itself is a parent, not an area
        parent = str(item.get("parent") or item.get("society") or item.get("zone") or "")
        parent = PARENT_BY_SLUG.get(parent, parent) or (PARENT_BY_SLUG.get(slug, "") if kind == "area" else "")
        name = str(item["name"]).strip()
        p = {"name": name, "slug": slug, "sub": str(item.get("subCategory") or ""),
             "lat": lat, "lng": lng, "kind": kind, "category": category,
             "parent": parent if parent in PARENTS else "",
             "aliases": [name.lower(), *[str(a).lower() for a in aliases if a]], "source": "backend"}
        for k in ("stats", "avgRent", "averageRent", "description", "listingCount", "tier"):
            if item.get(k) is not None:
                p[k] = item[k]
        out.append(p)
    return out


def _load_backend_places() -> list[dict]:
    path = config.PLACES_JSON_PATH
    try:
        if path.exists():
            with open(path, encoding="utf-8") as f:
                rows = _parse_backend(json.load(f))
            if rows:
                return rows
    except (OSError, ValueError) as error:
        log.warning("could not read %s (%s)", path, error)
    from app.services import backend_api           # local import: avoid a cycle
    data = backend_api.get_json("/api/places", timeout=2.5)
    rows = _parse_backend(data) if data else []
    if len(rows) >= 20:
        return rows
    try:                                           # last copy of the website dataset shipped with us
        with open(LOCAL_SNAPSHOT, encoding="utf-8") as f:
            return _parse_backend(json.load(f))
    except (OSError, ValueError):
        return rows


def _merge(backend: list[dict], local: list[dict]) -> list[dict]:
    merged = list(backend)
    taken = {}
    for p in backend:
        for a in p["aliases"]:
            taken[_norm(a)] = p
        taken[_norm(p["slug"]).replace(" ", "")] = p
    for p in local:
        twin = None
        for a in p["aliases"]:
            if _norm(a) in taken:
                twin = taken[_norm(a)]
                break
        if twin is None:
            twin = taken.get(_norm(p["slug"]).replace(" ", ""))
        if twin is not None:
            # keep backend coordinates, but add our extra aliases / parent / category
            for a in p["aliases"]:
                if a not in twin["aliases"]:
                    twin["aliases"].append(a)
            twin["parent"] = twin["parent"] or p["parent"]
            if twin["kind"] == "landmark" and p["kind"] == "university":
                twin["kind"] = twin["category"] = "university"
            if twin.get("category") in ("landmark", "") and p["category"]:
                twin["category"] = p["category"]
            continue
        merged.append(p)
    return merged


_lock = threading.Lock()
_state: dict[str, Any] = {"at": 0.0, "places": None, "backend_count": 0}


def all_places(force: bool = False) -> list[dict]:
    now = time.time()
    with _lock:
        if (_state["places"] is not None and not force
                and now - _state["at"] < config.PLACES_TTL_SECONDS):
            return _state["places"]
        backend = []
        try:
            backend = _load_backend_places()
        except Exception as error:  # never break the bot because of the dataset
            log.warning("backend places unavailable (%s); using local gazetteer", error)
        merged = _merge(backend, _local_places())
        if backend and _state["backend_count"] != len(backend):
            log.info("places: %d from website dataset + local = %d total", len(backend), len(merged))
        _state.update(at=now, places=merged, backend_count=len(backend))
        return merged


def places() -> list[dict]:
    """Backwards-compatible accessor (copies so callers may annotate freely)."""
    return [dict(p, aliases=list(p["aliases"])) for p in all_places()]


def places_version() -> float:
    all_places()
    return _state["at"]


def backend_place_count() -> int:
    all_places()
    return _state["backend_count"]


def find_by_name(name: str) -> dict | None:
    key = _norm(name)
    for p in all_places():
        if _norm(p["name"]) == key or key in (_norm(a) for a in p["aliases"]):
            return p
    return None
