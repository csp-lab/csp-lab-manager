# CSP Lab Manager

Self-hosted console for receiving, parsing, filtering, and inspecting Content Security Policy violation reports (`report-uri`). This document describes the app as it runs now.

## 1. Stack

* **Framework:** Next.js 16 (App Router, `proxy.ts`, Server Actions). `cacheComponents` and `partialPrefetching` are on. `/` redirects to `/admin`.
* **Package manager:** `pnpm`
* **Authentication:** Better Auth with the username plugin, credential passwords, and the HTTP-only session cookie from `nextCookies`.
* **Database:** PostgreSQL 16 and Prisma. Report totals live on the endpoint row and move in the same transaction as report inserts and deletes.
* **Data fetching:** Server Components for the first paint. TanStack Query v5 polls the report explorer through the `queryReports` Server Action.
* **Validation:** Zod 4 for forms, report queries, and CSP bodies.
* **Rate limiting:** Valkey sliding window through `ioredis` when `REDIS_URL` is set. Otherwise an in-process window.
* **UI:** Tailwind CSS v4, Radix dialog and select, Sonner toasts, Lucide icons. Inter and JetBrains Mono.

Local Compose runs Postgres and Valkey. The app container in `compose.yaml` is commented out; the app runs with `pnpm dev` or `pnpm start`.

## 2. Routes

```
proxy.ts                                 # protects /admin and /admin/:path*
app/
├── layout.tsx
├── admin/
│   ├── page.tsx                         # redirect → /admin/endpoints
│   ├── login/page.tsx
│   └── (console)/
│       ├── layout.tsx                   # sidebar shell, session required
│       ├── endpoints/page.tsx
│       ├── endpoints/new/page.tsx
│       ├── endpoints/[app-name-slug]/page.tsx
│       ├── users/page.tsx
│       └── users/new/page.tsx
├── api/
│   ├── auth/[...all]/route.ts
│   └── health/route.ts                  # GET { status: "ok" }
└── endpoint/[app-name-slug]/route.ts    # public POST ingest
```

`proxy.ts` sends anonymous visitors to `/admin/login?next=<path>`, sends a signed-in visitor away from the login page, and bounces viewers off `/admin/users` and `/admin/endpoints/new`. Server Actions call `requireUser()` and check the role again.

## 3. Database

Better Auth owns `users`, `sessions`, `accounts`, and `verifications`. Passwords live on `accounts.password`, not on `users`. A provisioned user gets a synthetic email `{username}@users.csp.local`, `emailVerified: true`, and a lowercased username. `users.role` is not writable from the auth client (`input: false`).

```prisma
enum Role {
  SUPERADMIN
  ADMIN
  VIEWER
}

model User {
  id            String    @id @default(cuid())
  name          String
  email         String    @unique
  emailVerified Boolean   @default(false)
  image         String?
  firstName     String
  lastName      String
  username      String?   @unique
  role          Role      @default(VIEWER)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  sessions      Session[]
  accounts      Account[]
  assignments   EndpointAccess[]
  @@map("users")
}

model Endpoint {
  id           String           @id @default(cuid())
  appName      String
  appNameSlug  String           @unique
  apiKey       String           @unique
  reportCount  Int              @default(0)
  lastReportAt DateTime?
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt
  reports      Report[]
  accessList   EndpointAccess[]
  @@map("endpoints")
}

model EndpointAccess {
  id         String   @id @default(cuid())
  userId     String
  endpointId String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  endpoint   Endpoint @relation(fields: [endpointId], references: [id], onDelete: Cascade)
  @@unique([userId, endpointId])
  @@index([endpointId])
  @@map("endpoint_access")
}

model Report {
  id                 String   @id @default(cuid())
  endpointId         String
  documentUri        String
  referrer           String?
  violatedDirective  String
  effectiveDirective String?
  originalPolicy     String?  @db.Text
  disposition        String
  blockedUri         String
  blockedDomain      String
  lineNumber         Int?
  columnNumber       Int?
  sourceFile         String?
  statusCode         Int?
  scriptSample       String?  @db.Text
  rawJson            Json
  createdAt          DateTime @default(now())
  endpoint           Endpoint @relation(fields: [endpointId], references: [id], onDelete: Cascade)

  @@index([endpointId, createdAt(sort: Desc)])
  @@index([endpointId, violatedDirective, createdAt(sort: Desc)])
  @@index([endpointId, blockedDomain, createdAt(sort: Desc)])
  @@index([endpointId, disposition, createdAt(sort: Desc)])
  @@map("reports")
}
```

`Session`, `Account`, and `Verification` follow the Better Auth Prisma adapter (session token, account password, verification identifier). See `prisma/schema.prisma`.

`reportCount` and `lastReportAt` update inside the report write. Clears delete reports in batches of 1000 and rewind the counter from the rows that remain.

## 4. Validation

CSP ingest (`lib/validations/csp.ts`) expects `{ "csp-report": { ... } }`. `document-uri` and `violated-directive` are non-empty strings. `blocked-uri` may be empty. `disposition` defaults to `enforce` and is stored as given. Optional fields match the usual report-uri set: referrer, effective directive, original policy, line, column, source file, status code, script sample.

Forms (`lib/validations/forms.ts`):

* **Endpoint.** App name is 2–50 characters, letters, numbers, and spaces. The slug is `trim().toLowerCase()` with spaces turned into hyphens. The API key is at least 16 characters. The create form generates a URL-safe key from 24 random bytes; regenerate on the detail page replaces it server-side.
* **Login.** Username at least 3 characters. The form schema asks for 6; Better Auth and the seed require 8.
* **Create user.** First and last name, username 3–20 (`[a-zA-Z0-9_]+`, stored lowercase), password at least 8, role `ADMIN` or `VIEWER`.
* **Report query.** Optional from, to, directive, and domain. Disposition is `enforce` or `report`. Sort is `newest` (default), `oldest`, or `domain`. `unique` is optional. Limit is 1–1000, default 20.

## 5. Ingest

`POST /endpoint/<slug>?apiKey=<key>`

1. Content type must be `application/csp-report` or `application/json`, ignoring parameters. Otherwise `415`.
2. Sliding window of 100 requests / 10 seconds, keyed by client IP and slug. IP is the first `x-forwarded-for` hop, else `x-real-ip`, else `unknown`. Valkey key prefix is `csp-ingest:`. Over the limit returns `429` with `Retry-After: 10`. If `REDIS_URL` is set and Valkey cannot be reached, the route returns `503` and does not fall back to memory.
3. Missing slug or a key that fails a SHA-256 timing-safe compare returns `401` with the same body, so a missing endpoint and a bad key look the same.
4. Invalid JSON or a body that fails the CSP schema returns `400`.
5. `blockedDomain` is the hostname. Bare tokens (`inline`, `eval`, `self`, `none`, `wasm-eval`, `about`) stay as-is. `data:` and `blob:` become `data` and `blob`. An empty URI becomes `unknown`. Anything else is kept and cut at 253 characters.
6. The report row and the endpoint counter commit together. Success is `204` with an empty body. `rawJson` stores the original body.

## 6. Access

| Action | SUPERADMIN | ADMIN | VIEWER |
| --- | --- | --- | --- |
| View assigned endpoints and their reports | all endpoints | all endpoints | assigned only |
| See the API key and report URL | yes | yes | no |
| Create an endpoint | yes | yes | no |
| Regenerate a key, clear reports, delete an endpoint | yes | yes | no |
| Remove one report, or a unique group | yes | yes | no |
| Assign viewers to an endpoint | yes | yes | no |
| Open `/admin/users` and create a user | yes | yes | no |
| Create or assign the `ADMIN` role | yes | no | no |
| Change a user's role | yes | no | no |
| Delete a user | yes, not self | yes, not self or a superadmin | no |

Seed creates the only superadmin. Provisioning refuses a second one. The role control cannot promote someone to superadmin, and the current superadmin cannot demote or delete themselves. Clearing reports and deleting an endpoint require the slug typed into the confirm dialog.

Creating an endpoint assigns the creator. Saving members always keeps every admin and superadmin on the access list. Viewers are the people who can be checked or unchecked. A viewer with no assignment sees an empty endpoint list, and a direct visit to someone else's slug is a 404.

## 7. Console

Sidebar brand links to `/admin/endpoints`. **Create Endpoint** shows for admins and superadmins. **Users** shows for the same roles. The footer shows the signed-in name, username, and role, and signs out through Better Auth.

**Endpoints** is a card grid. Each card shows the app name, slug, and `reportCount`, displayed as `99+` past 99. A live dot means `lastReportAt` is within the last hour. Sort toggles name A–Z / Z–A and most / fewest reports.

**Report explorer** loads `now-15m` through `now`. From and To accept that relative form (`now`, then `+` or `-` with `s`, `m`, `h`, `d`, `w`, `M`, `y`) or an absolute timestamp, including the datetime picker. Presets are 15m, 1h, 24h, and 7d. Directive and blocked-domain menus list values seen inside the time window. Disposition is all, `enforce`, or `report`. **Unique only** picks one row per `documentUri`, `violatedDirective`, `blockedUri`, and `disposition`; removing that row deletes the whole group. Sort is newest, oldest, or domain A–Z. The limit defaults to 20. Auto-refresh choices are Off, 5s, 10s, 30s, 1m, 5m, 15m, 30m, and 1h. Each row shows the blocked URI, directive, disposition, and `YYYY-MM-DDTHH:MM:SSZ`. Opening a row shows `rawJson` in the JSON tree.

**Users** lists name, username, role, and created date. A superadmin can switch a non-self user between admin and viewer. Delete confirms in a dialog.

## 8. What is in place

The console, ingest path, rate limiter, and role checks above are implemented. Tests cover report-field helpers and the in-memory rate-limit window (`pnpm test`).
