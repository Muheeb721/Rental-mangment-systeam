from app.engine import handle_message
from app.services import property_catalog
from app.services.property_catalog import normalize_area_name, search_properties

CONTRACT = {"_id", "title", "purpose", "propertyType", "price", "rent", "city", "location", "society",
            "bedrooms", "bathrooms", "area", "areaUnit", "image"}


def test_normalisation_reads_legacy_fields():
    by_id = {i["_id"]: i for i in property_catalog.load_listings()}
    assert "a5" not in by_id                          # rented -> hidden
    assert by_id["a1"]["area_name"] == "DHA Phase 5"  # bare "Phase 5" -> DHA Phase 5
    assert by_id["a2"]["propertyType"] == "House" and by_id["a2"]["purpose"] == "Rent"
    assert by_id["a3"]["area_name"].startswith("Gulberg") and by_id["a3"]["furnished"] == "semi-furnished"
    assert by_id["a3"]["image"] == "https://x/y.jpg"
    assert by_id["a4"]["purpose"] == "Sale" and by_id["a4"]["amount"] == 25_000_000
    assert by_id["a1"]["image"] == "/uploads/a1.jpg"


def test_search_filters():
    dha5 = normalize_area_name("DHA Phase 5")
    ids = [i["_id"] for i in search_properties(area=dha5, property_type="House", max_budget=150_000)]
    assert ids == ["a6", "a1"]                        # cheapest first
    ids = [i["_id"] for i in search_properties(area=normalize_area_name("DHA"), bedrooms=4)]
    assert ids == ["a2"]
    assert [i["_id"] for i in search_properties(purpose="Sale")] == ["a4"]
    assert [i["_id"] for i in search_properties(furnished="furnished")] == ["a1"]
    gulberg = normalize_area_name("Gulberg")
    assert [i["_id"] for i in search_properties(area=gulberg)] == ["a3"]


def test_chat_contract_and_followups():
    r = handle_message("3 bed house for rent in DHA", "s1")
    assert r["intent"] == "search_property"
    assert [p["_id"] for p in r["properties"]] == ["a6", "a1"]
    assert all(set(p) == CONTRACT for p in r["properties"])
    assert "PKR 95,000/month" in r["reply"]

    r = handle_message("only 4 bedrooms", "s1")
    assert [p["_id"] for p in r["properties"]] == ["a2"]

    r = handle_message("tell me about the first one", "s1")
    assert r["intent"] == "property_details"
    assert r["properties"][0]["_id"] == "a2" and "Kanal" in r["reply"]


def test_cheaper_followup():
    handle_message("houses for rent in DHA", "s2")
    r = handle_message("cheaper ones", "s2")
    prices = [p["rent"] for p in r["properties"]]
    assert prices and max(prices) < 220_000


def test_no_results_relaxes():
    r = handle_message("4 bed house in DHA Phase 5 under 100k", "s3")
    assert r["properties"], "should suggest something instead of nothing"
    assert "exact" in r["reply"].lower() or "nearest" in r["reply"].lower()


def test_greeting_and_travel():
    assert handle_message("hi", "s4")["intent"] == "greeting"
    r = handle_message("how far is LUMS from Johar Town by car", "s4")
    assert "km" in r["reply"] and "estimate" in r["reply"].lower()
    assert r["properties"] == []
