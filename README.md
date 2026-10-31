# CSP Lab Manager

Self-hosted console for receiving, filtering, and inspecting Content Security Policy `report-uri` reports.

Each endpoint is an app name with a slug and an API key. Browsers post reports to `POST /endpoint/<slug>?apiKey=<key>`. Admins and superadmins manage endpoints and users. Viewers only see endpoints they are assigned to.

## Run

1. Copy `.env.example` to `.env`. Set `BETTER_AUTH_SECRET` (32+ characters) and `SEED_ADMIN_PASSWORD` (8+ characters).
2. `docker compose up -d` starts PostgreSQL and Valkey. The Next.js service in `compose.yaml` is commented out.
3. `pnpm db:migrate`
4. `pnpm db:seed` creates one superadmin when none exists. The username is `SEED_ADMIN_USERNAME` (default `superadmin`), stored lowercase.
5. `pnpm dev`

Sign in at `/admin/login`. `/` redirects to `/admin`, which redirects to `/admin/endpoints`.

`GET /api/health` returns `{ "status": "ok" }`.

## Ingest

```http
POST /endpoint/<slug>?apiKey=<key>
Content-Type: application/csp-report
```

`application/json` is also accepted. The body must be a `csp-report` object. A stored report responds `204`. Wrong or missing keys respond `401`. A bad body responds `400`. Any other content type responds `415`.

The limiter allows 100 requests per 10 seconds per client IP and slug. It uses Valkey when `REDIS_URL` is set, and process memory otherwise. Memory only holds for one app process. If `REDIS_URL` is set and Valkey is down, ingest responds `503`. On ECS, set `connection_limit` on `DATABASE_URL` so the task count times that limit stays under `max_connections`, and point every task at the same `REDIS_URL`.

## Console

- **Endpoints.** Cards show the stored report total, capped at `99+`. A green dot means a report arrived in the last hour. Sort by name or report count.
- **Report explorer.** Default window is `now-15m` to `now`, with presets for 15 minutes, 1 hour, 24 hours, and 7 days. Filter by violated directive, blocked domain, and disposition (`enforce` or `report`). Sort newest, oldest, or domain. Refresh is off by default, or 5s through 1h. The list shows up to 20 rows (1–1000). **Unique only** keeps one row per document, directive, blocked URI, and disposition.
- **Endpoint controls** (admin and superadmin). Copy the report URL, regenerate the key, assign viewers, clear reports, or delete the endpoint. Clear and delete require typing the slug. Admins and superadmins stay assigned to every endpoint.
- **Users** (admin and superadmin). Create `VIEWER` accounts. Only a superadmin can create or assign `ADMIN`. There is one superadmin, created by the seed. Nobody can delete themselves, and an admin cannot delete the superadmin.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Next.js dev server |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm lint` | ESLint |
| `pnpm test` | `node:test` for `lib/*.test.ts` |
| `pnpm db:migrate` | Prisma migrate dev |
| `pnpm db:seed` | Seed the superadmin |
