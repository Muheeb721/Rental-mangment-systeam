# RMS — Residential Rental Management System (Lahore)

A full-stack property rental portal for Lahore with an admin panel, REST API and a trained AI property assistant.

| Folder | What it is | Stack | Dev port |
|---|---|---|---|
| [`RMS-USER`](RMS-USER) | Public website: search all Lahore areas, property pages with gallery, nearby places & commute planner, area guides, tenant dashboard (applications, rent, maintenance), AI chat | React 19, Vite, Ant Design, Framer Motion, Lenis, Leaflet | 5175 |
| [`RMS-ADMIN`](RMS-ADMIN) | Admin panel: full CRUD for properties (multi-photo upload, map pin), bookings, applications, rent & payments, maintenance, users, reviews, site content, analytics | React 19, Vite, Leaflet | 5174 |
| [`RMS-Backend`](RMS-Backend) | REST API + real-time notifications, JWT auth, rent automation, Lahore places & travel-time engine | Node.js, Express, MongoDB (Mongoose), Socket.IO | 5000 |
| [`AI_Modal`](AI_Modal) | AI assistant: self-trained spaCy NLU model (intents + entities) + MongoDB search + LLM answers grounded on real listings, property-aware travel questions | Python, FastAPI, spaCy, Groq (OpenAI-compatible) | 8000 |

## Architecture
```
 RMS-USER (5175) ─┐
                  ├─► RMS-Backend (5000) ─► MongoDB
 RMS-ADMIN (5174) ┘         └─► AI_Modal (8000) ─► LLM (Groq)
```

## Run locally
1. **Backend**: `cd RMS-Backend && npm install && cp .env.example .env` (set `MONGODB_URI`, `JWT_SECRET` ≥ 32 chars) `&& npm run dev`
2. **AI service**: `cd AI_Modal && python -m venv .venv && .venv\Scripts\pip install -r requirements.txt && copy .env.example .env` (set `LLM_API_KEY`, `MONGODB_URI`) `&& .venv\Scripts\python -m uvicorn app.main:app --port 8000`
3. **Website**: `cd RMS-USER && npm install --legacy-peer-deps && npm run dev`
4. **Admin**: `cd RMS-ADMIN && npm install --legacy-peer-deps && npm run dev`

Create the first admin with `node RMS-Backend/scripts/createAdmin.js`. See each folder's README for details; the AI model training & evaluation steps are in [`AI_Modal/README.md`](AI_Modal/README.md).

## Branches
Each component was developed on its own branch and merged into `main`: `feature/user-website`, `feature/admin-panel`, `feature/backend-api`, `feature/ai-model`.
