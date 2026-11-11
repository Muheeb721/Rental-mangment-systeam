"""OpenAI-compatible chat-completions client configured only through env vars.

LLM_API_KEY   secret key (never logged)
LLM_BASE_URL  e.g. https://api.openai.com/v1, https://api.groq.com/openai/v1,
              https://api.x.ai/v1, https://openrouter.ai/api/v1, http://localhost:11434/v1
LLM_MODEL     model name for that provider

If the key is missing or rejected, the LLM is switched off with ONE warning and
the chatbot keeps answering with its template replies.
"""
from __future__ import annotations

import logging
import re
import threading
import time

import httpx

from app import config

log = logging.getLogger("rms.llm")

SYSTEM_PROMPT = """You are the property assistant of RMS, a rental & property website for Lahore, Pakistan.
Write the reply the user will see in the chat widget.

STRICT RULES
- Use ONLY the facts in the DATA block. Never invent listings, prices, addresses, phone numbers,
  emails, owner names, amenities or availability. If a detail is missing or "not listed", simply
  leave it out (only the details page may say "not listed").
- Mention every property in DATA.properties in the same order, numbered 1., 2., 3. ...
  For each give: title, price in PKR (rent per month or sale price), location (area / phase / block),
  bedrooms and bathrooms, size with unit, furnished status (if known) and up to 4 key amenities.
- Write money like "PKR 95,000/month" or "PKR 2.5 crore".
- If DATA.note explains that filters were relaxed or nothing matched, say that honestly first.
- Travel numbers are estimates; say so.
- For booking or contact, tell the user to open the property card / listing page on the RMS website
  and use its booking or contact option. Do not give contact details.
- Plain text only: NO markdown (no **bold**, no # headings, no tables). Use "1." numbering and
  " - " separators. Keep it friendly and concise (under ~180 words).
- Reply in the user's language style (English, or Roman Urdu if the user wrote Roman Urdu).
- If a property has distance_km / travel_minutes, mention them as estimates (e.g. "~3.1 km, ~10 min by car").
- End with one short helpful follow-up suggestion (e.g. filter by bedrooms, budget, "show more")."""

# Used for questions about ONE property, comparisons, area questions and nearby places.
GROUNDED_PROMPT = """You are the property assistant of RMS, a rental & property website for Lahore, Pakistan.
You answer like a helpful, knowledgeable local agent, but ONLY from the DATA block.

STRICT RULES
- DATA.task says what to do. Use ONLY facts in DATA. Never invent features, amenities, prices,
  distances, times, ages, owner details or availability.
- If the user asks about a detail that is missing, empty, 0 or "not listed" in DATA, say clearly that it
  is "not listed" on this listing and suggest asking the owner through the listing page. Never guess.
- A feature counts as present only if it appears in the property fields, amenities or description.
- Distances, minutes and costs: copy them from DATA (travel, monthly_commute, nearby, per-property
  travel). Write times as a range "min-peak min" when both are given. Always say they are estimates.
- Monthly commute = DATA.monthly_commute (round trips x working days); state the assumption.
- Suitability (family / students): reason only from listed facts (bedrooms, size, furnished, price,
  nearby schools / universities / hospitals in DATA) and say what is not listed.
- Money like "PKR 95,000/month" or "PKR 2.5 crore". Never give phone numbers or emails; for contact or
  booking point to the listing page on the RMS website.
- Plain text only: NO markdown (no **bold**, no # headings). For comparisons use one line per attribute:
  "Price: PKR 95,000/month | PKR 140,000/month". Lists use "1." or "- ".
- Keep it concise (under ~150 words). Reply in the user's style (English or Roman Urdu)."""


class LLMClient:
    def __init__(self) -> None:
        self.enabled = bool(config.USE_LLM and config.LLM_API_KEY and config.LLM_BASE_URL and config.LLM_MODEL)
        self.status = "ready" if self.enabled else "disabled: LLM_API_KEY not set" if config.USE_LLM else "disabled: USE_LLM=0"
        self._warned = False
        self._lock = threading.Lock()
        self._last_transient_warning = 0.0
        self._cooldown_until = 0.0
        if not self.enabled and config.USE_LLM:
            log.warning("LLM disabled (LLM_API_KEY is empty); using template replies.")
            self._warned = True

    def _disable(self, reason: str) -> None:
        with self._lock:
            self.enabled = False
            self.status = f"disabled: {reason}"
            if not self._warned:
                self._warned = True
                log.warning("LLM disabled: %s. Falling back to template replies. "
                            "Check LLM_API_KEY / LLM_BASE_URL / LLM_MODEL in AI_Modal/.env", reason)

    def chat(self, messages: list[dict], temperature: float = 0.3, max_tokens: int = 700) -> str | None:
        if not self.enabled or time.time() < self._cooldown_until:
            return None
        url = f"{config.LLM_BASE_URL}/chat/completions"
        headers = {"Authorization": f"Bearer {config.LLM_API_KEY}", "Content-Type": "application/json"}
        body = {"model": config.LLM_MODEL, "messages": messages,
                "temperature": temperature, "max_tokens": max_tokens}
        effort = config.LLM_REASONING_EFFORT
        if effort == "auto":
            effort = "low" if "gpt-oss" in config.LLM_MODEL.lower() else ""
        if effort and effort != "none":
            body["reasoning_effort"] = effort
        try:
            resp = httpx.post(url, headers=headers, json=body, timeout=config.LLM_TIMEOUT_SECONDS)
        except httpx.HTTPError as error:
            self._transient(f"network error ({error.__class__.__name__})")
            return None
        if resp.status_code in (401, 403):
            self._disable(f"provider rejected the API key (HTTP {resp.status_code}) at {config.LLM_BASE_URL}")
            return None
        if resp.status_code == 404:
            self._disable(f"endpoint or model '{config.LLM_MODEL}' not found (HTTP 404) at {config.LLM_BASE_URL}")
            return None
        if resp.status_code == 400 and "model" in resp.text.lower():
            self._disable(f"model '{config.LLM_MODEL}' not accepted (HTTP 400)")
            return None
        if resp.status_code == 429:
            try:
                wait = float(resp.headers.get("retry-after", "20"))
            except ValueError:
                wait = 20.0
            self._cooldown_until = time.time() + min(max(wait, 5.0), 60.0)
            self._transient(f"rate limited (HTTP 429), pausing LLM for {wait:.0f}s")
            return None
        if resp.status_code >= 400:
            self._transient(f"HTTP {resp.status_code}")
            return None
        try:
            text = resp.json()["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError):
            self._transient("unexpected response format")
            return None
        self.status = "ok"
        text = re.sub(r"\*\*|__|^#+\s*", "", text or "", flags=re.M)   # widget shows plain text
        return text.strip() or None

    def _transient(self, reason: str) -> None:
        self.status = f"last call failed: {reason}"
        now = time.time()
        if now - self._last_transient_warning > 300:
            self._last_transient_warning = now
            log.warning("LLM call failed (%s); using template reply for this message.", reason)


llm = LLMClient()
