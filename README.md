# InsightFlow AI

CSV analytics and data visualization platform with a React frontend and a Node.js backend.

## Stack

- Frontend: React, Vite, Tailwind CSS, Recharts
- Backend: Node.js ES modules
- Database: PostgreSQL
- AI: Gemini with fallback mode

## Project Structure

```text
insightflow-ai/
|- backend/
|  |- src/
|  |  |- config/
|  |  |- controllers/
|  |  |- http/
|  |  |- models/
|  |  |- routes/
|  |  |- services/
|  |  |- storage/
|  |  \- utils/
|- frontend/
|  \- src/
|     |- app/
|     |- features/
|     |- shared/
|     \- components/
|- docs/
|- .env.example
\- README.md
```

## Quick Start

1. Copy `.env.example` to `.env`
2. Fill in your local PostgreSQL credentials
3. Add a Gemini API key only if you want live Gemini responses

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

From the repo root you can also run:

```bash
npm run dev:backend
npm run dev:frontend
```

## Environment Variables

Use a local `.env` file for secrets. `.env` is ignored by Git and must not be committed.

Backend:

- `PORT` - backend port, default `3001`
- `DATABASE_URL` - PostgreSQL connection string
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` - database overrides
- `GEMINI_API_KEY` - optional Gemini API key
- `GEMINI_MODEL` - Gemini model name

Frontend:

- `VITE_API_BASE_URL` - optional backend base URL

## API Routes

- `GET /health`
- `POST /api/datasets`
- `GET /api/datasets/current`
- `DELETE /api/datasets/current`
- `POST /api/chat`

## Features

- CSV dataset upload and preview
- Interactive analyst dashboard with 5 chart types
- Natural language data querying
- PostgreSQL-backed dataset persistence
- Gemini integration with safe fallback responses

## Git Safety

- Keep real credentials only in `.env`
- Commit only `.env.example`
- Review `git diff` before pushing
- Do not commit local logs or generated build artifacts
