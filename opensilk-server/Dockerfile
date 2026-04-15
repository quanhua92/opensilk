# Multi-stage production Docker build for opensilk-server
# Uses cargo-chef for dependency caching and BuildKit cache mounts

# Stage 1: Build planner for cargo-chef
FROM rust:1-alpine AS chef
USER root

RUN apk add --no-cache \
    musl-dev \
    ca-certificates \
    gcc \
    g++ \
    make \
    openssl-dev \
    openssl-libs-static

RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    cargo install cargo-chef --locked
WORKDIR /app

FROM chef AS planner
WORKDIR /app

COPY Cargo.toml Cargo.lock ./
RUN mkdir -p src && echo "fn main() {}" > src/main.rs
RUN cargo chef prepare --recipe-path recipe.json

# Stage 2: Cache dependencies
FROM chef AS cacher
WORKDIR /app

COPY --from=planner /app/recipe.json recipe.json

RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    cargo chef cook --release --recipe-path recipe.json

# Stage 3: Build the application
FROM chef AS builder
WORKDIR /app

COPY --from=cacher /app/target target
COPY Cargo.lock Cargo.toml ./
COPY src/ src/
COPY migrations/ migrations/
COPY .sqlx/ .sqlx/

ENV SQLX_OFFLINE=true

RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    cargo build --release && \
    cp target/release/opensilk-server /app/opensilk-server-bin

# Stage 4: Minimal production image
FROM alpine:3.23.3 AS final
WORKDIR /app

RUN apk add --no-cache ca-certificates

RUN addgroup -S appgroup && adduser -S -G appgroup appuser

ENV RUST_LOG="info"
ENV PORT=8080

COPY --from=builder /app/opensilk-server-bin ./opensilk-server

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget -q --spider http://localhost:${PORT:-8080}/health || exit 1

CMD ["./opensilk-server"]
