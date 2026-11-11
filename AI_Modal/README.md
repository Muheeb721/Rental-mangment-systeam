# RMS AI Property Chatbot

A hybrid chatbot for the RMS rental/property system (Lahore, Pakistan). It answers
property questions in English and Roman Urdu using:

1. **Our own trained NLP model** (spaCy v3, trained from scratch on our labelled dataset):
   intent classification (20 intents) + named-entity recognition (15 entity types).
2. **Rules** as a safety net (budget/bedroom parsing, typo-tolerant area matching, follow-ups).
3. **Live MongoDB data**: only real, available listings from the `properties` collection.
4. **An LLM** (any OpenAI-compatible API) that rewrites the answer naturally, **grounded only
   in the listings returned from the database**. Without a working key the bot still answers
   fully with template replies.
5. **The Lahore places dataset + travel API of the website** (RMS-Backend): ~90 areas and ~115
   landmarks (universities, hospitals, schools, malls, transport...). Travel answers use the
   website's `GET /api/travel` so the chatbot and the property pages show the same numbers.

### What it can do (v3)

* **All of Lahore**: every area / landmark of the website dataset plus aliases and typos
  ("johar town", "JT", "gulberg 3", "bahria", "model twn", "cantt", "DHA 6", "punjab uni", "pu",
  "uet", "shaukat khanum").
* **Current property**: the backend forwards `property_id` (the listing the user is viewing). It,
  or the last listing discussed ("the second one"), becomes the *current property*:
  "how far is this from LUMS?", "and from UCP by rickshaw?", "is it furnished?", "does it have
  parking / gas / backup?", "what's the deposit?", "how old is it?", "what's nearby?", "schools near
  it", "is it good for a family / students?", "how much would I spend commuting daily to UCP by bike?"
  (monthly estimate = round trip x 22 working days).
* **Near-place search**: "flats near UCP under 80k", "houses within 15 minutes of LUMS by car",
  "2 bed apartment within 3 km of Shaukat Khanum" - every result carries `distanceKm` / `travelMinutes`.
* **Compare**: "compare the first two", "compare 1 and 3", "compare this with the second one"
  (+ commute to a named place).
* **Areas**: "average rent in Johar Town", "which area is cheapest for a 3 bed house",
  "tell me about Bahria Town" (statistics from current listings + `/api/areas/:slug` + nearby landmarks).
* The LLM answers property questions from the **full property record** plus computed travel /
  nearby data and must say "not listed" for missing fields. Its reply is rejected (template used
  instead) if it states any amount, distance (km) or time (min) not present in the data.

```
user message
   -> trained spaCy model (intent + entities)  --(low confidence / missing)-->  rules
   -> slots (area, type, rent/sale, budget, bedrooms, furnished, ordinal, origin/destination)
   -> session memory (follow-ups: "only 4 bedrooms", "cheaper ones", "show more", "the second one")
   -> current property (property_id / "the second one") + places dataset + website travel API
   -> MongoDB search (+ near-place / within-N-minutes search, relaxed search, nearby areas)
   -> LLM reply grounded in the results (numbers checked)  --(no LLM)-->  template reply
```

## Folder structure

```
AI_Modal/
  app/
    main.py                  FastAPI app: POST /chat, GET /health
    engine.py                conversation pipeline, session memory, relaxation, replies
    nlu.py                   trained model + rule fallback -> intent & slots
    config.py                env settings (.env)
    services/
      property_catalog.py    MongoDB (pymongo), listing normalisation, area catalog, search, haversine
      gazetteer.py           Lahore places: website dataset (file / API / local snapshot) + local extras
      travel.py              website /api/travel first, local estimate (same formula) as fallback
      backend_api.py         short-timeout client for the RMS website API (circuit breaker + cache)
      llm.py                 OpenAI-compatible client (env-configured, safe fallback)
  nlp/
    generate_dataset.py      builds the labelled dataset (English + Roman Urdu)
    train_spacy.py           trains the model, writes train/dev/test splits
    evaluate.py              accuracy, P/R/F1, confusion matrix -> models/metrics.json
    predict.py               try the model from the command line
    nlp_parser.py            loads the model for the app
  data/
    training_data_labeled.jsonl   13,010 labelled sentences
    handwritten_eval.jsonl        86 hand-written test sentences (not from the generator)
    lahore-places.json            snapshot of the website places dataset (offline fallback)
    splits/                       train / dev / test (created by train_spacy.py)
  models/
    rental_nlp_model/        the trained model
    metrics.json             evaluation results (show this to the teacher)
    confusion_matrix.csv
    training_history.jsonl   per-epoch loss / dev scores
  scripts/smoke_test.py      scripted end-to-end conversation
  tests/                     pytest suite (parsing + search, uses an in-memory fake DB)
  requirements.txt  .env.example
```

## Setup (Windows, from the `AI_Modal` folder)

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
copy .env.example .env      # then edit .env (MongoDB URI, LLM settings)
```

## Train and evaluate the model

```powershell
.venv\Scripts\python nlp\generate_dataset.py    # regenerate data\training_data_labeled.jsonl
.venv\Scripts\python nlp\train_spacy.py         # ~30-40 min on a laptop CPU (EPOCHS=15), keeps the best epoch
.venv\Scripts\python nlp\evaluate.py            # prints metrics, writes models\metrics.json
.venv\Scripts\python nlp\predict.py "3 bed house for rent in DHA Phase 5 under 150k"
```

Current results (`models/metrics.json`). v3 = 20 intents / 15 entities, 13,010 sentences. Training was
stopped early (deadline) and the best dev-score checkpoint saved so far is used.

| set | sentences | v2 model (15 intents) intent acc / entity F1 | v3 model intent acc / entity F1 |
|-----|-----------|-----------------------------------------------|---------------------------------|
| held-out test split (generated) | 923 (v2) / 1301 (v3) | 99.89 % / 0.984 | 99.54 % / 0.979 |
| hand-written, original 54 | 54 | 92.59 % / 0.980 | 92.59 % / 0.985 |
| hand-written, 32 new (property Q&A, near search, compare, areas) | 32 | 6.25 % / 0.583 | 96.88 % / 0.913 |
| hand-written, all | 86 | 60.47 % / 0.844 | 94.19 % / 0.960 |

(The v2 column for the new sentences is low because those intents/entities did not exist in v2.)

`evaluate.py` reports on two sets:
* **Held-out test split** - 10% of the generated data, never seen during training.
* **Hand-written set** - realistic questions typed by hand, not produced by the generator
  (harder, more honest).

## Run the service

```powershell
.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

* `GET  http://127.0.0.1:8000/health` - model / database / LLM status
* `POST http://127.0.0.1:8000/chat` body `{"message": "...", "session_id": "...", "property_id": "<optional listing id>"}`

Response:

```json
{
  "reply": "I found 3 listings for 3 bed houses for rent in DHA Lahore: ...",
  "properties": [{"_id": "...", "title": "...", "purpose": "Rent", "propertyType": "House",
                  "price": 95000, "rent": 95000, "city": "Lahore", "location": "DHA Phase 7",
                  "society": "DHA", "bedrooms": 4, "bathrooms": 3, "area": 10, "areaUnit": "Marla",
                  "image": "/uploads/..."}],
  "intent": "search_property",
  "entities": {"BEDROOMS": ["3 bed"], "PROPERTY_TYPE": ["house"], "PURPOSE": ["rent"], "AREA": ["DHA"]},
  "filters": {"area": "DHA Lahore", "property_type": "House", "purpose": "Rent", "bedrooms": 3},
  "has_more": false,
  "travel": null,
  "context_property_id": "6af36ea6a87a22bfe1d10cb8"
}
```

New optional fields:
* `travel` - the computed trip for travel answers, same shape as the website API:
  `{"from", "to", "distanceKm", "source": "website"|"local", "mode", "modes": [{"mode","label","minutes","minutesPeak","costPkr"}]}`
* `context_property_id` - the current property the bot is talking about (or null).
* each item in `properties` may carry `distanceKm`, `travelMinutes`, `travelMode`, `travelTo`
  for near-place searches / comparisons.

At most 6 properties are returned per reply ("show more" pages through the rest).
The Node backend proxies it at `POST http://localhost:5000/api/chatbot/message`
(`RMS-Backend/src/controllers/chatbotController.js`, env `AI_MODAL_URL`, default `http://127.0.0.1:8000`).

## Tests

```powershell
.venv\Scripts\python -m pytest -q
.venv\Scripts\python scripts\smoke_test.py      # search + property-page conversations through the backend
.venv\Scripts\python scripts\smoke_test.py --only property   # viewing a DHA Phase 5 listing (sends property_id)
```

## Environment variables

| name | default | meaning |
|------|---------|---------|
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/rms` | database with the `properties` collection |
| `PROPERTY_COLLECTION` | `properties` | collection name |
| `CATALOG_TTL_SECONDS` | `60` | how long listings are cached |
| `LLM_API_KEY` | *(empty)* | key for an OpenAI-compatible API; empty = template replies |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | e.g. Groq `https://api.groq.com/openai/v1`, xAI `https://api.x.ai/v1`, OpenRouter `https://openrouter.ai/api/v1`, Ollama `http://localhost:11434/v1` |
| `LLM_MODEL` | `gpt-4o-mini` | model name at that provider |
| `USE_LLM` | `1` | `0` switches the LLM off |
| `USE_NLP_MODEL` | `1` | `0` = rules only (to compare with / without the trained model) |
| `NLP_MODEL_DIR` | `models/rental_nlp_model` | model folder |
| `MAX_PROPERTIES` | `6` | properties per reply |
| `PETROL_PRICE_PKR` | `265` | used in travel cost estimates |
| `PORT` | `8000` | documented port for uvicorn |
| `BACKEND_URL` | `http://127.0.0.1:5000` | RMS website API (places, areas, travel, nearby) |
| `BACKEND_TIMEOUT_SECONDS` | `2.0` | timeout per website API call (then local fallback) |
| `USE_BACKEND_API` | `1` | `0` = never call the website API (local estimates only) |
| `PLACES_JSON_PATH` | `../RMS-Backend/public/data/lahore-places.json` | website places dataset file |
| `PLACES_TTL_SECONDS` | `600` | how often the places dataset is reloaded |
| `WORKING_DAYS_PER_MONTH` | `22` | used for monthly commute estimates |

The LLM key, base URL and model must belong to the **same provider**. If the provider rejects
the key (HTTP 401/403) or the model (404), the service logs one warning, switches the LLM off
and keeps answering with templates. `GET /health` shows the LLM status.

## Notes / limits

* Travel times and costs are **estimates**, not live traffic. Source of truth is the website's
  `GET /api/travel` (2 s timeout); if it is unavailable the local copy of the same formula is used
  (`travel.py` mirrors `RMS-Backend/src/utils/travel.js`: road km = straight line x 1.35, speed bands,
  peak multipliers, petrol / rickshaw fares), so numbers stay consistent.
* Places are loaded from `RMS-Backend/public/data/lahore-places.json`, else `GET /api/places`, else
  the snapshot `data/lahore-places.json`, and merged with the extra places / aliases in `gazetteer.py`.
* Nearby places use `GET /api/properties/:id/nearby` when available, else the places dataset.
* Area statistics are computed from the live listings (the same data the website uses);
  `/api/areas/:slug` details are added to the LLM context when available.
* Area coordinates come from `gazetteer.py` when a listing has no latitude/longitude.
* The dataset is template-generated, so scores on the generated test split are very high; the
  hand-written set is the more realistic number.
