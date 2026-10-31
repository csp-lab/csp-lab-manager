# CSP Lab Manager

Self-hosted console for CSP `report-uri` ingestion.

## Run

1. Copy `.env.example` to `.env`. Set `BETTER_AUTH_SECRET` (32+ characters) and `SEED_ADMIN_PASSWORD` (8+ characters).
2. `docker compose up -d`
3. `pnpm db:migrate`
4. `pnpm db:seed`
5. `pnpm dev`

Sign in at `/admin/login` with `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD`.

Ingest with `POST /endpoint/<slug>?apiKey=<key>` and `Content-Type: application/csp-report` or `application/json`.

Rate limit uses Valkey through `REDIS_URL`. With no `REDIS_URL`, the limit stays in process memory, which only holds for one app process. On ECS, set `connection_limit` on `DATABASE_URL` so the task count times that limit stays under `max_connections`, and point every task at the same `REDIS_URL`.
