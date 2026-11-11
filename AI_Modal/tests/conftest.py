import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import property_catalog  # noqa: E402

DOCS = [
    {"_id": "a1", "title": "House for Rent - Phase 5", "propertyType": "House", "purpose": "Rent",
     "rent": 140000, "price": 140000, "location": "Phase 5", "phase": "Phase 5", "block": "K Block",
     "city": "Lahore", "bedrooms": 3, "bathrooms": 3, "area": 10, "areaUnit": "Marla",
     "furnished": "Furnished", "amenities": ["Parking", "Gas"], "status": "Available",
     "images": [{"url": "/uploads/a1.jpg"}], "latitude": 31.4629, "longitude": 74.4102, "deposit": 280000,
     "parking": 2, "yearBuilt": 2015},
    {"_id": "a2", "title": "House in DHA Phase 6", "type": "house", "transactionType": "Rent",
     "rent": 220000, "society": "DHA", "phase": "Phase 6", "city": "Lahore", "bedrooms": 4,
     "bathrooms": 4, "area": 1, "areaUnit": "Kanal", "status": "For Rent", "image": "/uploads/a2.jpg"},
    {"_id": "a3", "title": "Flat in Gulberg III", "category": "Flat", "listingType": "rent", "price": 75000,
     "location": "Gulberg 3", "city": "Lahore", "bedrooms": 2, "bathrooms": 2, "area": 1100,
     "furnished": "semi furnished", "status": "Available", "featuredImage": {"url": "https://x/y.jpg"}},
    {"_id": "a4", "title": "Apartment for sale Bahria", "propertyType": "Apartment", "purpose": "Sale",
     "salePrice": 25000000, "society": "Bahria Town", "city": "Lahore", "bedrooms": 2, "bathrooms": 2,
     "area": 950, "status": "Available"},
    {"_id": "a5", "title": "Sold house", "propertyType": "House", "purpose": "Rent", "rent": 90000,
     "location": "DHA Phase 5", "bedrooms": 3, "status": "Rented"},
    {"_id": "a7", "title": "2-Bed Flat near FAST", "propertyType": "Flat", "purpose": "Rent", "rent": 45000,
     "location": "Faisal Town", "city": "Lahore", "bedrooms": 2, "bathrooms": 1, "area": 700, "areaUnit": "Sq. Ft.",
     "status": "Available", "latitude": 31.4800, "longitude": 74.3050, "furnished": "Unfurnished"},
    {"_id": "a8", "title": "Studio Flat in Johar Town", "propertyType": "Flat", "purpose": "Rent", "rent": 30000,
     "location": "Johar Town", "city": "Lahore", "bedrooms": 1, "bathrooms": 1, "area": 450, "areaUnit": "Sq. Ft.",
     "status": "Available", "latitude": 31.4690, "longitude": 74.2780},
    {"_id": "a6", "title": "House for Rent Phase 5 small", "propertyType": "House", "purpose": "Rent",
     "rent": 95000, "location": "DHA Phase 5", "bedrooms": 3, "bathrooms": 2, "area": 5,
     "areaUnit": "Marla", "status": "Available"},
]


def _fake_listings():
    bad = re.compile(property_catalog._UNAVAILABLE, re.I)
    return [property_catalog.normalize_listing(d) for d in DOCS
            if not bad.search(str(d.get("status", "")))]


@pytest.fixture(autouse=True)
def fake_db(monkeypatch):
    from app import config
    monkeypatch.setattr(config, "USE_BACKEND_API", False)       # no network in tests
    """Tests never touch the real MongoDB: listings come from DOCS above."""
    listings = _fake_listings()
    monkeypatch.setattr(property_catalog, "load_listings", lambda force=False: listings)
    monkeypatch.setattr(property_catalog, "get_property",
                        lambda pid: next((i for i in listings if i["_id"] == pid), None))
    property_catalog._cache["catalog"] = None
    from app import engine
    monkeypatch.setattr(engine, "load_listings", lambda force=False: listings)
    monkeypatch.setattr(engine, "get_property", lambda pid: next((i for i in listings if i["_id"] == pid), None))
    engine.reset_sessions()
    monkeypatch.setattr(engine.llm, "enabled", False)
    yield
    property_catalog._cache["catalog"] = None
