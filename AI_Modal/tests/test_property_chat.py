"""Property-aware conversation: new intents, near-place search, current-property travel,
compare, area questions, grounding of distances/minutes and the website travel API."""
import pytest

from app import engine
from app.engine import _grounded, handle_message
from app.nlu import parse_distance, parse_duration, parse_features, parse_message, parse_ordinals
from app.services import travel
from app.services.property_catalog import normalize_area_name


# ---------------------------------------------------------------- parsing
@pytest.mark.parametrize("text,expected", [
    ("johar town", "Johar Town"), ("JT", "Johar Town"), ("gulberg 3", "Gulberg"),
    ("model twn", "Model Town"), ("cantt", "Cantt"), ("DHA 6", "DHA Phase 6"),
    ("punjab uni", "Punjab University"), ("pu", "Punjab University"), ("uet", "UET"),
    ("shaukat khanum", "Shaukat Khanum"), ("bahria", "Bahria Town"), ("lums", "LUMS"), ("ucp", "UCP"),
])
def test_lahore_aliases(text, expected):
    place = normalize_area_name(text)
    assert place is not None and expected in place["name"]


def test_value_parsers():
    assert parse_duration("houses within 15 minutes of LUMS") == 15
    assert parse_duration("half an hour away") == 30
    assert parse_distance("within 3 km of UCP") == 3.0
    assert parse_ordinals("compare the first two") == [1, 2]
    assert parse_ordinals("compare the first and third") == [1, 3]
    assert parse_ordinals("compare 1 and 3") == [1, 3]
    assert "parking" in parse_features("does it have parking?")
    assert "deposit" in parse_features("what's the deposit")


@pytest.mark.parametrize("text,intent", [
    ("how far is this from LUMS", {"property_question", "distance", "travel_time", "travel_cost", "travel_time_cost"}),
    ("is it furnished?", {"property_question"}),
    ("does it have parking?", {"property_question"}),
    ("what's nearby?", {"nearby_places"}),
    ("schools near it", {"nearby_places"}),
    ("flats near UCP under 80k", {"near_search"}),
    ("houses within 15 minutes of LUMS by car", {"near_search"}),
    ("compare the first two", {"compare"}),
    ("average rent in Johar Town?", {"area_info"}),
    ("which area is cheapest for a 3 bed house", {"area_info"}),
    ("tell me about Bahria Town", {"area_info"}),
])
def test_new_intents(text, intent):
    assert parse_message(text)["intent"] in intent


def test_near_search_slots():
    s = parse_message("flats near UCP under 80k")["slots"]
    assert "UCP" in s["near"]["name"] and s["max_budget"] == 80_000 and s["property_type"] == "Flat"
    s = parse_message("houses within 15 minutes of LUMS by car")["slots"]
    assert s["duration_min"] == 15 and s["transport"] == "car"


# ---------------------------------------------------------------- current property
def test_current_property_travel_and_followups():
    r = handle_message("how far is this from LUMS", "p1", "a1")
    assert r["context_property_id"] == "a1"
    assert r["travel"] and "LUMS" in r["travel"]["to"] and r["travel"]["distanceKm"] < 3
    assert "km" in r["reply"] and "min" in r["reply"]
    r = handle_message("and from UCP by rickshaw?", "p1", "a1")
    assert r["travel"] and "UCP" in r["travel"]["to"] and r["travel"]["mode"] == "rickshaw"
    assert "Rickshaw" in r["reply"] and "PKR" in r["reply"]
    r = handle_message("is it furnished?", "p1", "a1")
    assert "furnished" in r["reply"].lower() and r["context_property_id"] == "a1"
    r = handle_message("what's the deposit", "p1", "a1")
    assert "280,000" in r["reply"]
    r = handle_message("is there a lift?", "p1", "a1")
    assert "not listed" in r["reply"].lower()


def test_monthly_commute():
    r = handle_message("how much would I spend commuting daily to UCP by bike", "p2", "a1")
    assert "month" in r["reply"].lower() and r["travel"]["mode"] == "bike"


def test_nearby_places_for_property():
    r = handle_message("schools near it", "p3", "a1")
    assert "school" in r["reply"].lower() and "km" in r["reply"]


def test_ordinal_becomes_current_property():
    handle_message("houses in DHA", "p4")
    r = handle_message("how far is the first one from LUMS", "p4")
    assert r["travel"] is not None and r["context_property_id"]


# ---------------------------------------------------------------- near search / compare / areas
def test_near_search_has_distance_and_time():
    r = handle_message("flats near FAST under 1 lakh", "n1")
    assert r["intent"] == "near_search" and r["properties"]
    first = r["properties"][0]
    assert first["_id"] == "a7" and first["distanceKm"] < 2 and first["travelMinutes"] >= 1


def test_within_minutes_search():
    r = handle_message("houses within 15 minutes of LUMS by car", "n2")
    ids = [p["_id"] for p in r["properties"]]
    assert "a1" in ids and all(p.get("travelMinutes") is not None for p in r["properties"])


def test_compare_first_two():
    handle_message("flats for rent in Lahore", "c1")
    handle_message("show me flats", "c1")
    r = handle_message("compare the first two", "c1")
    assert r["intent"] == "compare" and "|" in r["reply"] and len(r["properties"]) == 2


def test_area_info():
    r = handle_message("average rent in Johar Town?", "ar1")
    assert r["intent"] == "area_info" and "30,000" in r["reply"]
    r = handle_message("which area is cheapest for a 3 bed house", "ar2")
    assert "DHA Phase 5" in r["reply"]


# ---------------------------------------------------------------- grounding + website API
def test_grounding_checks_distances_and_minutes():
    data = {"travel": {"distance_km": 3.1, "modes": {"car": {"minutes": 9, "peak_minutes": 13}}}}
    assert _grounded("About 3.1 km, roughly 9-13 min by car (estimate).", data)
    assert not _grounded("About 7 km away.", data)
    assert not _grounded("Only 25 minutes by car.", data)


def test_llm_ungrounded_reply_falls_back(monkeypatch):
    monkeypatch.setattr(engine.llm, "enabled", True)
    monkeypatch.setattr(engine.llm, "chat", lambda *a, **k: "It is 42 km from LUMS, 95 minutes by car.")
    r = handle_message("how far is this from LUMS", "g1", "a1")
    assert "42 km" not in r["reply"] and r["llm_used"] is False


def test_website_travel_api_is_source_of_truth(monkeypatch):
    payload = {"distanceKm": 3.0, "estimate": True, "modes": [
        {"mode": "car", "label": "Car", "minutes": 8, "minutesPeak": 12, "costPkr": 65},
        {"mode": "motorbike", "label": "Motorbike", "minutes": 10, "minutesPeak": 12, "costPkr": 20},
        {"mode": "rickshaw", "label": "Rickshaw / InDrive", "minutes": 14, "minutesPeak": 20, "costPkr": 250}]}
    monkeypatch.setattr(travel.backend_api, "get_json", lambda *a, **k: payload)
    est = travel.travel_between({"name": "x", "lat": 31.46, "lng": 74.41, "property_id": "a1"},
                                {"name": "LUMS", "lat": 31.47, "lng": 74.41, "slug": "lums", "source": "backend"})
    assert est["source"] == "website" and est["modes"]["bike"]["time_min"] == 10
    assert est["modes"]["rickshaw"]["one_way_pkr"] == 250


def test_local_estimate_matches_website_formula():
    est = travel.travel_estimate(31.4640, 74.4090, 31.4706, 74.4111)
    # values produced by RMS-Backend/src/utils/travel.js estimateTravel() for the same points
    assert est["distance_km"] == 1.0
    assert (est["modes"]["car"]["time_min"], est["modes"]["car"]["time_peak"], est["modes"]["car"]["one_way_pkr"]) == (6, 10, 25)
    assert est["modes"]["rickshaw"]["one_way_pkr"] == 150
