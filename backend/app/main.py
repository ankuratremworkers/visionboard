from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse

from app.routers.finnhub import router as finnhub_router

app = FastAPI(
    title="Vision Board Backend",
    description="Proxies Finnhub data; the API key is supplied per-request "
    "from the frontend's Settings box and is never persisted server-side.",
    version="0.1.0",
)

# Extra origins (comma-separated) can be supplied via env for deployments that
# serve the frontend from a different host than the API. Same-origin requests
# (frontend and API served from this same container) don't need CORS at all.
_extra_origins = [
    o.strip() for o in os.getenv("EXTRA_CORS_ORIGINS", "").split(",") if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        *_extra_origins,
    ],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["X-Finnhub-Token", "Content-Type"],
)

app.include_router(finnhub_router)

# In production the Docker image builds the Vite frontend into ./static and
# this backend serves it directly, so the whole app is a single deployable
# unit on one origin/port. In local dev this directory doesn't exist — Vite's
# dev server runs separately and proxies /api to this backend instead.
_static_dir = Path(__file__).resolve().parent.parent / "static"

if _static_dir.is_dir():
    app.mount(
        "/assets", StaticFiles(directory=_static_dir / "assets"), name="assets"
    )

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str) -> FileResponse:
        candidate = _static_dir / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_static_dir / "index.html")
else:

    @app.get("/")
    async def root() -> dict:
        return {"service": "vision-board-backend", "docs": "/docs"}
