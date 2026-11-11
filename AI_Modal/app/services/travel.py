"""Travel estimates inside Lahore (distance, time, one-way cost).

Source of truth: the website's GET /api/travel?from=&to= (so the chatbot and the property
page show the same numbers). If that API is unavailable the local estimate below is used:
road distance = straight-line distance x 1.35, average city speeds, typical fares.
All numbers are ESTIMATES, not live traffic.
"""
from __future__ import annotations

import logging
from typing import Any

from app import config
from app.services import backend_api
from app.services.property_catalog import haversine_km

log = logging.getLogger("rms.travel")
ROAD_FACTOR = 1.35


# Same model as the website (RMS-Backend/src/utils/travel.js) so numbers agree even offline.
# km/h by distance band [(up to km, speed)], peak multiplier, fixed overhead minutes
_BANDS = {
    "car": ([(3, 18), (10, 26), (25, 34), (1e9, 45)], 1.5, 3, "Car"),
    "bike": ([(3, 22), (10, 30), (25, 36), (1e9, 45)], 1.25, 1, "Motorbike"),
    "rickshaw": ([(3, 17), (10, 23), (25, 28), (1e9, 35)], 1.45, 6, "Rickshaw / InDrive"),
    "walk": ([(1e9, 4.5)], 1.0, 0, "Walking"),
}
CAR_KM_PER_LITRE, BIKE_KM_PER_LITRE = 12, 40
RICKSHAW_BASE, RICKSHAW_PER_KM, RICKSHAW_MIN = 100, 40, 150
METRO_FARE, ORANGE_FARE, BUS_FARE, STATION_WALK_KM = 30, 40, 60, 1.5
MODES = {k: (v[3],) for k, v in _BANDS.items()}
MODES["bus"] = ("Bus / Metro",)
# same mode mapping as the website (careem / uber / indrive -> rickshaw, metro -> bus)
TRANSPORT_ALIASES = {
    "bike": "bike", "motorbike": "bike", "motorcycle": "bike", "motor cycle": "bike", "scooty": "bike",
    "car": "car", "gari": "car", "gaari": "car", "drive": "car", "driving": "car",
    "taxi": "rickshaw", "careem": "rickshaw", "uber": "rickshaw", "indrive": "rickshaw",
    "yango": "rickshaw", "ride hailing": "rickshaw", "cab": "rickshaw",
    "rickshaw": "rickshaw", "riksha": "rickshaw", "auto": "rickshaw", "qingqi": "rickshaw",
    "bus": "bus", "wagon": "bus", "van": "bus", "public transport": "bus",
    "metro": "bus", "metro bus": "bus", "orange line": "bus", "orange line train": "bus",
    "train": "bus", "speedo": "bus", "transit": "bus",
    "walk": "walk", "walking": "walk", "on foot": "walk", "paidal": "walk",
}


def canonical_transport(text: str | None) -> str | None:
    if not text:
        return None
    t = text.casefold().strip()
    if t in TRANSPORT_ALIASES:
        return TRANSPORT_ALIASES[t]
    for alias in sorted(TRANSPORT_ALIASES, key=len, reverse=True):
        if alias in t:
            return TRANSPORT_ALIASES[alias]
    return None


def mode_label(mode: str, est: dict | None = None) -> str:
    if est and mode in est.get("modes", {}):
        return est["modes"][mode]["label"]
    return MODES[mode][0] if mode in MODES else mode.replace("_", " ").title()


def _speed(bands, km):
    return next(sp for up, sp in bands if km <= up)


def _round(v: float) -> int:
    return max(1, round(v))


def _round5(v: float) -> int:
    return int(round(v / 5) * 5)


def _stations(line: str) -> list[dict]:
    from app.services.gazetteer import all_places
    return [p for p in all_places() if p.get("sub") == line]


def _nearest_station(lat, lng, line):
    best = None
    for st in _stations(line):
        d = haversine_km(lat, lng, st["lat"], st["lng"])
        if best is None or d < best[1]:
            best = (st, d)
    return best


def _bus(lat1, lng1, lat2, lng2, km) -> dict:
    for line, label, fare in (("metro", "Metro Bus", METRO_FARE), ("orange-line", "Orange Line", ORANGE_FARE)):
        a, b = _nearest_station(lat1, lng1, line), _nearest_station(lat2, lng2, line)
        if a and b and a[0]["slug"] != b[0]["slug"] and a[1] <= STATION_WALK_KM and b[1] <= STATION_WALK_KM:
            ride = haversine_km(a[0]["lat"], a[0]["lng"], b[0]["lat"], b[0]["lng"]) * 1.15
            walk = (a[1] + b[1]) * 1.25 / 4.5 * 60
            return {"label": label, "time_min": _round(walk + 4 + ride / 27 * 60),
                    "time_peak": _round(walk + 8 + ride / 27 * 60 * 1.05), "one_way_pkr": fare}
    minutes = 8 + km / 14 * 60
    return {"label": "Local bus / wagon", "time_min": _round(minutes), "time_peak": _round(minutes * 1.2),
            "one_way_pkr": BUS_FARE}


def travel_estimate(lat1: float, lng1: float, lat2: float, lng2: float) -> dict:
    """Local estimate (fallback) - same formula as the website's utils/travel.js."""
    straight = haversine_km(lat1, lng1, lat2, lng2)
    km = straight * ROAD_FACTOR
    petrol = config.PETROL_PRICE_PKR
    modes = {}
    for key in ("car", "bike", "rickshaw"):
        bands, peak, overhead, label = _BANDS[key]
        minutes = overhead + km / _speed(bands, km) * 60
        if key == "car":
            cost = _round5(km / CAR_KM_PER_LITRE * petrol)
        elif key == "bike":
            cost = _round5(km / BIKE_KM_PER_LITRE * petrol)
        else:
            cost = _round5(max(RICKSHAW_MIN, RICKSHAW_BASE + km * RICKSHAW_PER_KM))
        modes[key] = {"label": label, "time_min": _round(minutes), "time_peak": _round(minutes * peak),
                      "one_way_pkr": cost}
    modes["bus"] = _bus(lat1, lng1, lat2, lng2, km)
    if km <= 3:
        walk = _round(km / 4.5 * 60)
        modes["walk"] = {"label": "Walking", "time_min": walk, "time_peak": walk, "one_way_pkr": 0}
    return {"distance_km": round(km, 1), "straight_km": round(straight, 1), "modes": modes,
            "is_estimate": True, "source": "local"}


# ---------------------------------------------------------------------------
# website API
# ---------------------------------------------------------------------------
def _ref(place: dict[str, Any]) -> str | None:
    if place.get("property_id"):
        return str(place["property_id"])
    if place.get("source") == "backend" and place.get("slug"):
        return str(place["slug"])
    if place.get("lat") is not None:
        return f"{place['lat']:.5f},{place['lng']:.5f}"
    return None


def _from_backend(data: Any) -> dict | None:
    if not isinstance(data, dict):
        return None
    km = data.get("distanceKm", data.get("distance_km"))
    raw_modes = data.get("modes")
    if km is None or not raw_modes:
        return None
    if isinstance(raw_modes, dict):
        raw_modes = [dict(v, mode=k) for k, v in raw_modes.items()]
    modes = {}
    for m in raw_modes:
        name = str(m.get("mode") or m.get("key") or m.get("label") or "")
        key = canonical_transport(name) or canonical_transport(str(m.get("label") or "")) or name.lower()
        if not key or key in modes:
            continue
        minutes = m.get("minutes", m.get("time_min"))
        if minutes is None:
            continue
        modes[key] = {"label": str(m.get("label") or mode_label(key)),
                      "time_min": int(round(float(minutes))),
                      "time_peak": int(round(float(m.get("minutesPeak") or minutes))),
                      "one_way_pkr": int(round(float(m.get("costPkr") or m.get("cost") or 0)))}
    if not modes:
        return None
    return {"distance_km": round(float(km), 1), "modes": modes, "is_estimate": True,
            "source": "website", "note": data.get("estimate") if isinstance(data.get("estimate"), str) else None}


def travel_between(origin: dict[str, Any], dest: dict[str, Any], *, allow_backend: bool = True) -> dict | None:
    """Travel estimate between two places/properties: website API first, local fallback."""
    if allow_backend:
        a, b = _ref(origin), _ref(dest)
        if a and b:
            est = _from_backend(backend_api.get_json("/api/travel", {"from": a, "to": b}))
            if est:
                return est
    if origin.get("lat") is None or dest.get("lat") is None:
        return None
    return travel_estimate(origin["lat"], origin["lng"], dest["lat"], dest["lng"])


def monthly_commute(est: dict, mode: str, days: int | None = None) -> dict:
    days = days or config.WORKING_DAYS_PER_MONTH
    m = est["modes"][mode]
    return {"mode": mode, "label": m["label"], "days": days, "round_trip_pkr": m["one_way_pkr"] * 2,
            "monthly_pkr": m["one_way_pkr"] * 2 * days, "daily_minutes": m["time_min"] * 2}


def public_travel(origin_name: str, dest_name: str, est: dict, mode: str | None = None) -> dict:
    """Shape returned in the /chat response `travel` field (mirrors the website API)."""
    return {"from": origin_name, "to": dest_name, "distanceKm": est["distance_km"],
            "source": est.get("source", "local"), "estimate": True, "mode": mode,
            "modes": [{"mode": k, "label": v["label"], "minutes": v["time_min"],
                       "minutesPeak": v.get("time_peak", v["time_min"]), "costPkr": v["one_way_pkr"]}
                      for k, v in est["modes"].items()]}
