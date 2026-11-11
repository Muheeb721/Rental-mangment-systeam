import pytest

from app.nlu import parse_bedrooms, parse_budget, parse_message, parse_ordinal, parse_type
from app.services.property_catalog import find_area_mentions, normalize_area_name


@pytest.mark.parametrize("text,expected", [
    ("under 150k", (None, 150_000)),
    ("budget 1.5 lakh", (None, 150_000)),
    ("below 2 crore", (None, 20_000_000)),
    ("Rs. 85,000 per month", (None, 85_000)),
    ("PKR 150000", (None, 150_000)),
    ("70 hazar tak", (None, 70_000)),
    ("between 50k and 80k", (50_000, 80_000)),
    ("above 1 lakh", (100_000, None)),
    ("3 bed house in DHA Phase 5", (None, None)),
])
def test_budget(text, expected):
    assert parse_budget(text) == expected


@pytest.mark.parametrize("text,expected", [
    ("3 bed house", (3, "exact")),
    ("only 4 bedrooms", (4, "exact")),
    ("2 bhk flat", (2, "exact")),
    ("3+ beds", (3, "min")),
    ("at least 3 bedrooms", (3, "min")),
    ("three bedrooms", (3, "exact")),
    ("house in DHA Phase 5", (None, "exact")),
])
def test_bedrooms(text, expected):
    assert parse_bedrooms(text) == expected


@pytest.mark.parametrize("text,expected", [
    ("show me furnished apartments", "Apartment"),
    ("flats for sale", "Flat"),
    ("3 bedroom house", "House"),
    ("ghar chahiye", "House"),
    ("anything available?", None),
])
def test_type(text, expected):
    assert parse_type(text) == expected


def test_ordinals():
    assert parse_ordinal("tell me about the second one") == 2
    assert parse_ordinal("details of number 3") == 3
    assert parse_ordinal("the last one") == -1


def test_area_names_and_typos():
    assert normalize_area_name("dha phase 5")["name"] == "DHA Phase 5"
    assert normalize_area_name("Phase 5")["name"] == "DHA Phase 5"
    assert normalize_area_name("DHA")["name"] == "DHA Lahore"
    assert normalize_area_name("Bahria Town")["kind"] == "parent"
    assert normalize_area_name("Johar Twon")["name"] == "Johar Town"
    names = [m[2]["name"] for m in find_area_mentions("from Gulberg to UET Lahore")]
    assert names[0] == "Gulberg" and "UET" in names[1]


def test_full_search_message():
    r = parse_message("3 bed house for rent in DHA Phase 5 under 150k")
    s = r["slots"]
    assert r["intent"] == "search_property"
    assert s["area"]["name"] == "DHA Phase 5"
    assert s["property_type"] == "House"
    assert s["purpose"] == "Rent"
    assert s["bedrooms"] == 3
    assert s["max_budget"] == 150_000


def test_sale_and_furnished():
    s = parse_message("flats for sale in Bahria Town")["slots"]
    assert s["purpose"] == "Sale" and s["property_type"] == "Flat" and s["area"]["name"] == "Bahria Town"
    s = parse_message("show me furnished apartments in Gulberg")["slots"]
    assert s["furnished"] == "furnished" and s["area"]["name"] == "Gulberg"


@pytest.mark.parametrize("text,intent", [
    ("hello", "greeting"),
    ("thanks a lot", "thanks"),
    ("start over", "reset"),
    ("show more", "show_more"),
    ("tell me about the second one", "property_details"),
])
def test_small_intents(text, intent):
    assert parse_message(text)["intent"] == intent


def test_travel_roles():
    r = parse_message("how far is LUMS from DHA Phase 5?")
    assert r["intent_group"] == "travel"
    assert r["slots"]["origin"]["name"] == "DHA Phase 5"
    assert "LUMS" in r["slots"]["destination"]["name"]
    r = parse_message("Johar Town to UCP by bike kitna time lagega")
    assert r["slots"]["origin"]["name"] == "Johar Town"
    assert "UCP" in r["slots"]["destination"]["name"]
    assert r["slots"]["transport"] == "bike"


def test_roman_urdu():
    r = parse_message("Gulberg mein 2 bed flat chahiye 70 hazar tak")
    s = r["slots"]
    assert s["area"]["name"] == "Gulberg" and s["bedrooms"] == 2 and s["max_budget"] == 70_000
    assert r["language"] == "roman"
