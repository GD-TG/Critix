FROM python:3.12-slim AS base
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY pyproject.toml ./
COPY requirements.lock ./
RUN --mount=type=cache,target=/root/.cache/pip pip install --timeout 120 --retries 5 -r requirements.lock
COPY app ./app
RUN --mount=type=cache,target=/root/.cache/pip pip install --timeout 120 --no-deps . && pip check && useradd --create-home critix
COPY alembic.ini ./
COPY migrations ./migrations
USER critix
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --no-proxy-headers"]

FROM base AS test
USER root
RUN --mount=type=cache,target=/root/.cache/pip pip install --timeout 120 pytest==9.1.1
COPY tests ./tests
USER critix
CMD ["sh", "-c", "alembic upgrade head && pytest -q -p no:cacheprovider"]

FROM base AS production
