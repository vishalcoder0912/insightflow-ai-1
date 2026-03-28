"""Legacy backend entrypoint.

This file intentionally delegates to the active FastAPI app in ``app.main`` so
older startup commands keep working without booting a stale API surface.
"""

from __future__ import annotations

import sys
import warnings
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.config import settings
from app.main import app

warnings.warn(
    "backend/main.py is deprecated. Start the backend with 'uvicorn app.main:app' instead.",
    DeprecationWarning,
    stacklevel=2,
)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=True,
    )
