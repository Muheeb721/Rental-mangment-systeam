"""Settings loaded from environment variables / the AI_Modal/.env file."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017/rms")
MONGODB_DB = os.getenv("MONGODB_DB", "")            # empty -> database name from the URI
PROPERTY_COLLECTION = os.getenv("PROPERTY_COLLECTION", "properties")
CATALOG_TTL_SECONDS = _int("CATALOG_TTL_SECONDS", 60)

LLM_API_KEY = os.getenv("LLM_API_KEY", "").strip()
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").strip().rstrip("/")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini").strip()
LLM_TIMEOUT_SECONDS = float(os.getenv("LLM_TIMEOUT_SECONDS", "15"))
# "auto" -> "low" for reasoning models such as openai/gpt-oss-*; "none" -> never sent
LLM_REASONING_EFFORT = os.getenv("LLM_REASONING_EFFORT", "auto").strip().lower()
USE_LLM = os.getenv("USE_LLM", "1") != "0"

MAX_PROPERTIES = _int("MAX_PROPERTIES", 6)
SESSION_TTL_SECONDS = _int("SESSION_TTL_SECONDS", 2 * 60 * 60)
PETROL_PRICE_PKR = float(os.getenv("PETROL_PRICE_PKR", "265"))
PORT = _int("PORT", 8000)

# RMS website backend (Node, :5000): places dataset + travel API are the source of truth
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:5000").strip().rstrip("/")
BACKEND_TIMEOUT_SECONDS = float(os.getenv("BACKEND_TIMEOUT_SECONDS", "2.0"))
USE_BACKEND_API = os.getenv("USE_BACKEND_API", "1") != "0"
PLACES_JSON_PATH = Path(os.getenv("PLACES_JSON_PATH")
                        or ROOT.parent / "RMS-Backend" / "public" / "data" / "lahore-places.json")
PLACES_TTL_SECONDS = _int("PLACES_TTL_SECONDS", 600)
WORKING_DAYS_PER_MONTH = _int("WORKING_DAYS_PER_MONTH", 22)
