# InsightFlow AI

AI-powered data analysis and visualization platform with natural language querying.

## Project Structure

```
insightflow-ai/
├── backend/              # Python FastAPI backend
│   ├── app/
│   │   ├── ai/           # AI/ML integrations (Gemini)
│   │   ├── models/       # Data models
│   │   ├── routers/      # API routes
│   │   ├── services/     # Business logic
│   │   ├── config.py     # Configuration
│   │   └── main.py       # FastAPI app entry
│   ├── data/             # Data storage
│   └── requirements.txt
├── frontend/             # React + Vite + TypeScript
│   ├── src/
│   │   ├── app/          # Routing and layout
│   │   ├── features/     # Feature modules (chat, dashboard, upload)
│   │   ├── shared/       # Reusable hooks, services, types
│   │   ├── components/   # UI components (shadcn)
│   │   └── ...
│   └── ...
├── docs/                 # Documentation
│   ├── fixes/            # Fix summaries
│   └── ...
├── .env.example
└── README.md
```

## Quick Start

### Backend (Python)
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend (React)
```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

**Backend:**
- `PORT` - Server port (default: 8000)
- `GEMINI_API_KEY` - Google Gemini API key for AI features
- `GEMINI_MODEL` - Gemini model name

**Frontend:**
- `VITE_API_BASE_URL` - Backend API URL

## API Routes

- `GET /health` - Health check
- `POST /api/datasets` - Upload dataset
- `GET /api/datasets/current` - Get current dataset
- `DELETE /api/datasets/current` - Clear dataset
- `POST /api/chat` - Chat with AI about data

## Features

- CSV/Excel dataset upload and analysis
- Natural language data querying
- AI-powered insights via Google Gemini
- Interactive visualizations and dashboards
