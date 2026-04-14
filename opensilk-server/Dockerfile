FROM rust:1-slim AS builder
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY migrations ./migrations/
COPY src ./src/
COPY .sqlx ./.sqlx/

ENV SQLX_OFFLINE=true
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates libssl3 curl && rm -rf /var/lib/apt/lists/
COPY --from=builder /app/target/release/opensilk-server /usr/local/bin/
EXPOSE 8080
CMD ["opensilk-server"]
