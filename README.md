# CSP Lab Manager

Self-hosted console for receiving, filtering, and inspecting Content Security Policy `report-uri` reports.

Each endpoint is an app name with a slug and an API key. Browsers post reports to `POST /endpoint/<slug>?apiKey=<key>`. Admins and superadmin manage endpoints and users. Viewers only see endpoints they are assigned to.

## Run

Copy `.env.example` to `.env` and fill it in before you start Compose. Both compose files require `.env` and will not start without it.

The example already points `DATABASE_URL` at the `postgres` service and `REDIS_URL` at the `valkey` service. If you change a password, change it in both places: `DATABASE_URL` must match `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`, and `REDIS_URL` must match `VALKEY_PASSWORD`.

Set the blank values:

- `BETTER_AUTH_SECRET` — at least 32 characters
- `SEED_ADMIN_PASSWORD` — at least 8 characters
- `BETTER_AUTH_URL` — the URL you open in the browser (`http://localhost:3000` when the app is on the published port)

`SEED_ADMIN_USERNAME` defaults to `superadmin` (3–20 letters, numbers, or underscores, stored lowercase).

Pull the published image (`quay.io/csp-lab/csp-lab-manager`):

```bash
docker compose up -d
```

or build the image from this repo:

```bash
docker compose -f compose-dev.yaml up -d
```

Either command starts Postgres, Valkey, and the app. On startup the container rewrites `localhost` in `DATABASE_URL` to `postgres` and in `REDIS_URL` to `valkey`, applies migrations, and seeds one superadmin when none exists.

For local development without the app container, `docker compose up -d postgres valkey`, point `DATABASE_URL` and `REDIS_URL` at `localhost` (the host cannot resolve the Compose service names), then `pnpm db:migrate`, `pnpm db:seed`, and `pnpm dev`.

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
| `docker compose up -d` | Start Postgres, Valkey, and the published app image. Needs a filled-in `.env` |
| `docker compose -f compose-dev.yaml up -d` | Same stack, building the app image from this repo |
| `pnpm dev` | Next.js dev server |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm lint` | ESLint |
| `pnpm test` | `node:test` for `lib/*.test.ts` |
| `pnpm db:migrate` | Prisma migrate dev |
| `pnpm db:seed` | Seed the superadmin |
