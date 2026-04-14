FROM python:3.13-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

COPY . .
RUN uv sync --frozen --no-dev

FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

COPY --from=builder /app /app

RUN addgroup --system appgroup && adduser --system --ingroup appgroup --home /home/appuser appuser
RUN chown -R appuser:appgroup /app /home/appuser
USER appuser
ENV HOME=/home/appuser

CMD ["uv", "run", "main.py"]
