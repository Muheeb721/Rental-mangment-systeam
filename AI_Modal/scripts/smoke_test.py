"""End-to-end demo: send scripted conversations to the chatbot and print the answers.

Run (from AI_Modal, with the service running):
    python scripts/smoke_test.py                                  # through the Node backend (port 5000)
    python scripts/smoke_test.py --url http://127.0.0.1:8000/chat # straight to the AI service
    python scripts/smoke_test.py --only property                  # just the property-page conversation

The "property" conversation simulates a user viewing a DHA Phase 5 listing on the website
(the backend forwards its id as property_id). Messages are spaced out (--delay, default 4 s)
because free LLM tiers allow only a few requests per minute.
"""
import argparse
import json
import sys
import time
import uuid

import httpx

SEARCH_CONVERSATION = [
    "hello",
    "3 bed house for rent in DHA",
    "only 4 bedrooms",
    "cheaper ones",
    "tell me about the first one",
    "show more",
    "flats for sale in Bahria Town",
    "how far is LUMS from DHA Phase 8 by bike?",
    "Johar Town se UCP rickshaw ka kharcha kitna hai?",
    "Gulberg mein 2 bed flat chahiye 70 hazar tak",
    "thanks!",
]
PROPERTY_CONVERSATION = [
    "how far is this from LUMS",
    "and from UCP by rickshaw?",
    "is it furnished?",
    "does it have parking and a generator?",
    "what's nearby?",
    "show me similar flats near FAST under 1 lakh",
    "compare the first two",
    "average rent in Johar Town?",
    "houses within 15 minutes of LUMS by car",
    "which area is cheapest for a 3 bed house",
]


def find_property(base: str, area: str = "DHA Phase 5") -> str | None:
    """Pick a listing in `area` from the backend's public list API (falls back to the AI DB)."""
    try:
        r = httpx.get(f"{base}/api/properties", params={"limit": 200}, timeout=10).json()
        items = r.get("data") or r.get("properties") or r if isinstance(r, (dict, list)) else []
        if isinstance(items, dict):
            items = items.get("properties") or items.get("items") or []
        for p in items:
            text = " ".join(str(p.get(k, "")) for k in ("location", "phase", "address", "title"))
            if area.lower() in text.lower():
                return str(p.get("_id"))
    except (httpx.HTTPError, ValueError, AttributeError):
        pass
    sys.path.insert(0, ".")
    from app.services.property_catalog import load_listings
    return next((i["_id"] for i in load_listings() if i["area_name"] == area), None)


def run(url: str, session: str, messages: list[str], property_id: str | None, delay: float, raw: bool):
    for msg in messages:
        body = {"message": msg, "session_id": session}
        if property_id:
            body["property_id"] = property_id
        try:
            r = httpx.post(url, json=body, timeout=40)
        except httpx.HTTPError as e:
            sys.exit(f"cannot reach {url}: {e}")
        data = r.json()
        print("=" * 90)
        print(f"YOU : {msg}")
        print(f"[{r.status_code}] intent={data.get('intent')} properties={len(data.get('properties', []))}"
              + (f" context={data.get('context_property_id')}" if "context_property_id" in data else ""))
        if raw:
            print(json.dumps({k: v for k, v in data.items() if k != "reply"}, indent=1)[:1500])
        print(f"BOT : {data.get('reply')}")
        for p in data.get("properties", []):
            extra = f" | {p['distanceKm']} km, {p['travelMinutes']} min" if p.get("distanceKm") is not None else ""
            print(f"      - {p['title'][:60]} | {p['purpose']} | {p['price']} | {p['bedrooms']} bed{extra}")
        time.sleep(delay)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:5000/api/chatbot/message")
    ap.add_argument("--backend", default="http://127.0.0.1:5000")
    ap.add_argument("--session", default=f"smoke-{uuid.uuid4().hex[:8]}")
    ap.add_argument("--only", choices=["search", "property"], default=None)
    ap.add_argument("--delay", type=float, default=4.0)
    ap.add_argument("--json", action="store_true", help="print raw JSON")
    args = ap.parse_args()
    if args.only in (None, "search"):
        run(args.url, args.session + "-s", SEARCH_CONVERSATION, None, args.delay, args.json)
    if args.only in (None, "property"):
        pid = find_property(args.backend)
        print(f"\n### viewing property {pid} (DHA Phase 5)")
        run(args.url, args.session + "-p", PROPERTY_CONVERSATION, pid, args.delay, args.json)


if __name__ == "__main__":
    main()
