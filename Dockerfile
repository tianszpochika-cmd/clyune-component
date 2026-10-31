# Multi-stage: build React dist + Rust release binary
FROM node:20-alpine AS fe
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM rust:1.85-bookworm AS be
WORKDIR /be
COPY backend/Cargo.toml ./
# cache deps
RUN mkdir src && echo 'fn main(){}' > src/main.rs && cargo build --release && rm -rf src
COPY backend/ ./
RUN touch src/main.rs && cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libssl3 \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=be /be/target/release/clyune-component /app/clyune-component
COPY --from=be /be/migrations /app/migrations
COPY --from=be /be/data /app/data
COPY --from=fe /fe/dist /app/frontend/dist
ENV REGISTRY_PATH=/app/data/registry.json
ENV STATIC_DIR=/app/frontend/dist
EXPOSE 8080
CMD ["/app/clyune-component"]
