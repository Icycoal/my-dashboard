# Stage 1: Build
FROM swift:5.9-jammy AS build
WORKDIR /app
COPY Package.swift Package.resolved ./
RUN swift package resolve
COPY Sources ./Sources
COPY Tests ./Tests
RUN swift build -c release --static-swift-stdlib

# Stage 2: Runtime
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y libsqlite3-0 ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/.build/release/App ./App

ENV DATABASE_PATH=/app/data/db.sqlite
EXPOSE 8080

CMD ["./App", "serve", "--hostname", "0.0.0.0", "--port", "8080"]
