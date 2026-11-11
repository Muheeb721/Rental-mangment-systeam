"""FastAPI service for the RMS property chatbot.

Run:  uvicorn app.main:app --host 127.0.0.1 --port 8000      (from the AI_Modal folder)
"""
from __future__ import annotations

import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app import config
from app.engine import handle_message
from app.services.gazetteer import all_places, backend_place_count
from app.services.llm import llm
from app.services.property_catalog import db_status
from nlp import nlp_parser

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("rms.api")

app = FastAPI(title="RMS Property Chatbot", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "POST"], allow_headers=["*"])


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    session_id: str = Field(default="default", max_length=200)
    property_id: str | None = Field(default=None, max_length=64)


@app.on_event("startup")
def warm_up() -> None:
    nlp_parser.load()
    status = db_status()
    log.info("MongoDB: %s active listings (ok=%s)", status["listings"], status["ok"])
    log.info("LLM: %s (model=%s, base_url=%s)", llm.status, config.LLM_MODEL, config.LLM_BASE_URL)
    log.info("Places: %d known (%d from the website dataset)", len(all_places()), backend_place_count())


@app.get("/health")
def health() -> dict:
    db = db_status()
    return {
        "status": "ok",
        "model_loaded": nlp_parser.is_loaded(),
        "model_dir": str(nlp_parser.MODEL_DIR),
        "database": {"ok": db["ok"], "active_listings": db["listings"]},
        "places": {"total": len(all_places()), "from_website": backend_place_count()},
        "llm": {"enabled": llm.enabled, "status": llm.status, "model": config.LLM_MODEL,
                "base_url": config.LLM_BASE_URL},
    }


@app.post("/chat")
def chat(req: ChatRequest) -> JSONResponse:
    started = time.time()
    message = req.message.strip()
    if not message:
        return JSONResponse({"reply": "Please type a question.", "properties": [], "intent": "empty",
                             "entities": {}})
    try:
        result = handle_message(message, req.session_id.strip() or "default",
                                (req.property_id or "").strip() or None)
    except Exception:
        log.exception("chat failed")
        return JSONResponse(status_code=500, content={
            "reply": "Sorry, something went wrong on my side. Please try again.",
            "properties": [], "intent": "error", "entities": {}})
    log.info("chat session=%s pid=%s intent=%s props=%d llm=%s %.0fms", req.session_id[:40], req.property_id, result["intent"],
             len(result["properties"]), result["llm_used"], (time.time() - started) * 1000)
    return JSONResponse(result)


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception) -> JSONResponse:
    log.exception("unhandled error: %s", exc)
    return JSONResponse(status_code=500, content={"reply": "Sorry, something went wrong.", "properties": [],
                                                  "intent": "error", "entities": {}})
