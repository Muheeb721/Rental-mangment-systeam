"""Loads OUR trained spaCy model (intent + entities) for the chatbot.

analyze(text) returns
    {"intent": "search_property", "confidence": 0.97,
     "entities": {"AREA": ["DHA Phase 5"], "BUDGET": ["150k"], ...},
     "spans": [{"text": "DHA Phase 5", "label": "AREA", "start": 24, "end": 35}, ...]}
or None when the model is switched off, spaCy is not installed, or the model
folder does not exist. In that case the chatbot uses its rule-based parser only,
so nothing breaks before you train the model.

Model folder (default): AI_Modal/models/rental_nlp_model
Env vars:  NLP_MODEL_DIR=...   USE_NLP_MODEL=0 (switch off)
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

log = logging.getLogger("rms.nlp")

MODEL_DIR = Path(
    os.getenv("NLP_MODEL_DIR")
    or Path(__file__).resolve().parents[1] / "models" / "rental_nlp_model"
)
ENABLED = os.getenv("USE_NLP_MODEL", "1") != "0"

_nlp = None
_load_attempted = False


def load():
    global _nlp, _load_attempted
    if _load_attempted:
        return _nlp
    _load_attempted = True
    if not ENABLED:
        log.info("trained NLP model switched off (USE_NLP_MODEL=0); rules only")
        return None
    if not (MODEL_DIR / "meta.json").exists():
        log.warning("trained model not found at %s; using rule-based parser only "
                    "(run: python nlp/train_spacy.py)", MODEL_DIR)
        return None
    try:
        import spacy

        _nlp = spacy.load(MODEL_DIR)
        log.info("trained NLP model loaded from %s", MODEL_DIR)
    except Exception as error:  # spaCy missing, wrong version, broken model...
        log.warning("could not load trained model (%s); using rule-based parser only", error)
        _nlp = None
    return _nlp


def is_loaded() -> bool:
    return load() is not None


def analyze(text: str) -> dict[str, Any] | None:
    nlp = load()
    if nlp is None or not text.strip():
        return None
    doc = nlp(text)
    if not doc.cats:
        return None
    intent = max(doc.cats, key=doc.cats.get)
    entities: dict[str, list[str]] = {}
    spans = []
    for ent in doc.ents:
        entities.setdefault(ent.label_, []).append(ent.text)
        spans.append({"text": ent.text, "label": ent.label_,
                      "start": ent.start_char, "end": ent.end_char})
    return {
        "intent": intent,
        "confidence": round(float(doc.cats[intent]), 3),
        "entities": entities,
        "spans": spans,
    }
