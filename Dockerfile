# syntax=docker/dockerfile:1

# ---- Stage 1: build the React/Vite frontend -------------------------------
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ---- Stage 2: install backend deps with uv ---------------------------------
# WORKDIR matches the runtime stage's so uv's generated venv shebangs
# (e.g. /app/.venv/bin/uvicorn -> #!/app/.venv/bin/python) stay valid after
# the .venv directory is copied verbatim into the runtime image below.
FROM python:3.13-slim AS backend-build
WORKDIR /app

RUN pip install --no-cache-dir uv

COPY backend/pyproject.toml backend/uv.lock backend/README.md ./
RUN uv sync --frozen --no-dev --no-install-project

COPY backend/app ./app
RUN uv sync --frozen --no-dev

# ---- Stage 3: runtime image --------------------------------------------
FROM python:3.13-slim AS runtime
WORKDIR /app

RUN useradd --create-home --uid 1000 appuser

# Backend code + its virtualenv, built by uv in the previous stage.
COPY --from=backend-build /app/app ./app
COPY --from=backend-build /app/.venv ./.venv

# Built frontend assets, served by FastAPI's StaticFiles mount (see app/main.py).
COPY --from=frontend-build /app/frontend/dist ./static

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1

USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
