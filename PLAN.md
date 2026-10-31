# PLAN.md: CSP Lab Manager Architecture & Implementation Specification

## 1. Executive Summary & Tech Stack

**CSP Lab Manager** is a self-hosted dashboard and ingestion platform for receiving, parsing, filtering, and analyzing Content Security Policy (CSP) violation reports (`report-uri`).

### Technical Core

* **Framework:** Next.js 16 (App Router with `proxy.ts` / Server Actions)
* **Package Manager:** `pnpm`
* **Authentication:** `Better-Auth` with HTTP-only session management & role-based middleware/proxy access control.
* **Database & ORM:** PostgreSQL + Prisma ORM
* **State Management & Data Fetching:** TanStack Query v5 (React Query)
* **Validation & Schemas:** Zod (for forms, API payload parsing, and CSP report validation)
* **Rate Limiting:** Valkey-backed sliding window rate limiter (`REDIS_URL`, `ioredis`)
* **UI Components & Styling:** Tailwind CSS v4 + `shadcn/ui` (Radix UI primitives)
* **Icons:** Lucide React

---

## 2. System Architecture & Routing Structure

```
├── app/
│   ├── (auth)/
│   │   └── admin/
│   │       └── login/
│   │           └── page.tsx            # Admin Login Form (Zod validated)
│   ├── admin/
│   │   ├── layout.tsx                  # Sidebar & Authenticated Shell Layout
│   │   ├── endpoints/
│   │   │   ├── page.tsx                # Endpoint Overview Grid/List with 99+ Badges
│   │   │   ├── new/
│   │   │   │   └── page.tsx            # Create Endpoint Side Panel/View
│   │   │   └── [app-name-slug]/
│   │   │       └── page.tsx            # Detailed CSP Report Explorer (Grafana-style filters/auto-refresh)
│   │   └── users/
│   │       ├── page.tsx                # User Management View (Role Badges, Actions)
│   │       └── new/
│   │           └── page.tsx            # Create User View
│   ├── api/
│   │   └── auth/
│   │       └── [...all]/route.tsx      # Better-Auth Handler
│   ├── endpoint/
│   │   └── [app-name-slug]/
│   │       └── route.ts                # Public CSP Ingestion Endpoint
│   └── proxy.ts                        # Route protection proxy layer for /admin/*

```

---

## 3. Database Schema (`prisma/schema.prisma`)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  SUPERADMIN
  ADMIN
  VIEWER
}

model User {
  id            String           @id @default(cuid())
  firstName     String
  lastName      String
  username      String           @unique
  passwordHash  String
  role          Role             @default(VIEWER)
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
  
  // Better-Auth Relations
  sessions      Session[]
  accounts      Account[]
  
  // RBAC Relations
  assignments   EndpointAccess[]

  @@map("users")
}

model Session {
  id           String   @id @default(cuid())
  userId       String
  token        String   @unique
  expiresAt    DateTime
  ipAddress    String?
  userAgent    String?
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}

model Account {
  id                    String    @id @default(cuid())
  userId                String
  accountId             String
  providerId            String
  accessToken           String?
  refreshToken          String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  idToken               String?
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("accounts")
}

model Endpoint {
  id           String           @id @default(cuid())
  appName      String
  appNameSlug  String           @unique
  apiKey       String           @unique
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  reports      Report[]
  accessList   EndpointAccess[]

  @@index([appNameSlug])
  @@index([apiKey])
  @@map("endpoints")
}

model EndpointAccess {
  id         String   @id @default(cuid())
  userId     String
  endpointId String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  endpoint   Endpoint @relation(fields: [endpointId], references: [id], onDelete: Cascade)

  @@unique([userId, endpointId])
  @@map("endpoint_access")
}

model Report {
  id                String   @id @default(cuid())
  endpointId        String
  documentUri       String
  referrer          String?
  violatedDirective String
  effectiveDirective String?
  originalPolicy    String?  @db.Text
  disposition       String   // "enforce" | "report"
  blockedUri        String
  blockedDomain     String   // Extracted domain name without path/query string
  lineNumber        Int?
  columnNumber      Int?
  sourceFile        String?
  statusCode        Int?
  scriptSample      String?  @db.Text
  rawJson           Json     // Fully serialized original JSON report
  createdAt         DateTime @default(now())

  endpoint          Endpoint @relation(fields: [endpointId], references: [id], onDelete: Cascade)

  @@index([endpointId, createdAt(sort: Desc)])
  @@index([endpointId, violatedDirective])
  @@index([endpointId, blockedDomain])
  @@index([endpointId, disposition])
  @@map("reports")
}

```

---

## 4. Zod Schemas & Validation Logic (`lib/validations/`)

### 4.1 CSP Report Payload Schema

```typescript
import { z } from "zod";

export const cspReportPayloadSchema = z.object({
  "csp-report": z.object({
    "document-uri": z.string().url(),
    "referrer": z.string().optional().default(""),
    "violated-directive": z.string(),
    "effective-directive": z.string().optional(),
    "original-policy": z.string().optional(),
    "disposition": z.string().optional().default("enforce"),
    "blocked-uri": z.string(),
    "line-number": z.number().int().optional(),
    "column-number": z.number().int().optional(),
    "source-file": z.string().optional(),
    "status-code": z.number().int().optional(),
    "script-sample": z.string().optional().default("")
  })
});

export type CSPReportPayload = z.infer<typeof cspReportPayloadSchema>;

```

### 4.2 Application Forms Schemas

```typescript
// App Name Slug & Unique Key Validation
export const createEndpointSchema = z.object({
  appName: z
    .string()
    .min(2, "App name must be at least 2 characters")
    .max(50, "App name cannot exceed 50 characters")
    .regex(/^[a-zA-Z0-9\s]+$/, "App name can only contain letters, numbers, and spaces"),
  apiKey: z.string().min(16, "API Key must be at least 16 characters long")
});

// Admin Login Schema
export const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters")
});

// User Creation Schema
export const createUserSchema = z.object({
  firstName: z.string().min(1, "First name is required").regex(/^[a-zA-Z\s-]+$/),
  lastName: z.string().min(1, "Last name is required").regex(/^[a-zA-Z\s-]+$/),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["ADMIN", "VIEWER"])
});

```

---

## 5. Public CSP Ingestion & Rate Limiting Strategy

### Endpoint URL Format

`POST https://<hosted-app-name>/endpoint/<app-name-slug>?apiKey=<api-key>`

### Logic Flow (`app/endpoint/[app-name-slug]/route.ts`):

1. **Content-Type Handling:** Accepts `application/csp-report` and `application/json`.
2. **Rate Limiting:** Sliding window in Valkey indexed by `ip + app-name-slug` (e.g., max 100 requests / 10 seconds).
* *Returns `429 Too Many Requests` when limits are exceeded.*


3. **Endpoint Verification:** Verify `app-name-slug` and `apiKey` parameter against PostgreSQL database.
4. **Domain Normalization:** Strip request URI from `blocked-uri` using `new URL(blockedUri).hostname` to populate the `blockedDomain` column for indexing and fast filtering.
5. **Atomic Insertion:** Persist the normalized report row into `Report`.

---

## 6. Access Control & Authorization Matrix (RBAC)

Route protection for `/admin/*` is enforced through Next.js proxy route middleware (`proxy.ts`), evaluating session status and user roles stored via Better-Auth.

| Permission / Action | SUPERADMIN | ADMIN | VIEWER |
| --- | --- | --- | --- |
| View assigned endpoints (`/admin/endpoints`) | ✅ | ✅ | ✅ |
| View report details (`/admin/endpoints/[slug]`) | ✅ | ✅ | ✅ (If assigned) |
| Create endpoint (`/admin/endpoints/new`) | ✅ | ✅ | ❌ |
| Regenerate endpoint API Key | ✅ | ✅ | ❌ |
| Delete endpoint & clear reports | ✅ | ✅ | ❌ |
| Assign user access to endpoint | ✅ | ✅ | ❌ |
| View User Management list (`/admin/users`) | ✅ | ✅ | ❌ |
| Create new User | ✅ | ✅ | ❌ |
| Delete User | ✅ | ✅ | ❌ |
| Edit User Role | ✅ | ❌ | ❌ |
| Assign `ADMIN` role on creation | ✅ | ❌ | ❌ |

---

## 7. Frontend Features & UX Specifications

### 7.1 Sidebar Navigation

* Top header/brand: **CSP Lab Manager**
* "+ Create Endpoint" button styled like Google Drive side panel (directs to `/admin/endpoints/new`).
* Nav Items:
* 📊 **Endpoints** (`/admin/endpoints`)
* 👥 **Users** (`/admin/users`) — *Visible only to ADMIN & SUPERADMIN*.



### 7.2 Endpoints View (`/admin/endpoints`)

* Displays grid/table of endpoints.
* **Badge Request Counter:** Shows total aggregated reports per endpoint. Capped visually at **`99+`** (or actual number if below 99).
* Clicking row navigates to `/admin/endpoints/[app-name-slug]`.

### 7.3 Detailed Endpoint View (`/admin/endpoints/[app-name-slug]`)

* **Header Bar Controls:**
* Auto-Refresh Selector: Dropdown with `Off` (default), `Auto (5s)`, `5s`, `10s`, `15s`, `30s`, `1m`, `1h`. Uses TanStack Query `refetchInterval`.
* Manual Refresh Icon button.
* Time Range Filter (Grafana-style: `From` and `To` datetime pickers / quick selectors).


* **Filters:**
* Violated Directive filter dropdown.
* Blocked Domain filter dropdown (shows extracted hostname list).
* Disposition filter: `enforce` | `report`.
* Alphabetical domain sorting & Time sorting (Newest/Oldest).


* **Report List Items:**
* Title: `blockedUri`
* Badges: `violatedDirective` badge, `disposition` badge.
* Timestamp: Right-aligned ISO date/time in `YYYY-MM-DDTHH:MM:SSZ`.
* Accordion interaction: Clicking row expands a visual JSON Tree Serializer (e.g. `react-json-view` or formatted custom serializer) displaying the full structured CSP report.


* **Danger Zone:**
* **Clear All Reports:** Button triggers a modal warning: *"All report data for this endpoint will be lost forever."* Requires explicit typed confirmation or click confirmation to execute deletion.



---

## 8. Development Step-by-Step Execution Checklist

* [ ] **Step 1: Project Setup**
* Initialize Next.js 16 app with `pnpm create next-app` (App Router, Tailwind CSS v4, TypeScript).
* Install dependencies: `@prisma/client`, `prisma`, `better-auth`, `@tanstack/react-query`, `zod`, `ioredis`, `lucide-react`.


* [ ] **Step 2: Database & Auth Setup**
* Configure Prisma schema with `User`, `Session`, `Account`, `Endpoint`, `EndpointAccess`, and `Report` models.
* Run initial Prisma migration (`pnpm prisma migrate dev`).
* Integrate Better-Auth instance with Prisma adapter. Create auth routes under `app/api/auth/[...all]/route.ts`.


* [ ] **Step 3: Route Protection Proxy**
* Create `proxy.ts` / auth check proxy to validate `/admin/*` routes. Redirect unauthenticated users to `/admin/login`.


* [ ] **Step 4: Public Ingestion Endpoint & Rate Limiter**
* Build `app/endpoint/[app-name-slug]/route.ts`.
* Implement the Valkey sliding-window rate limit handler.
* Add Zod validation for CSP Report body and URL params.
* Extract domain name and store raw JSON + atomic report fields.


* [ ] **Step 5: Admin UI & TanStack Query State Layer**
* Build layout shell with sidebar and Google Drive style "+ Create Endpoint" button.
* Build `/admin/endpoints` overview with atomic count aggregation queries and `99+` request badge formatting.
* Build `/admin/endpoints/new` form with auto-slug generation (`appName.toLowerCase().replace(/\s+/g, '-')`) and Zod validation.


* [ ] **Step 6: CSP Report Explorer View**
* Build Grafana-style top bar (Auto-refresh selector via TanStack Query interval + Datetime range picker).
* Build directive, disposition, and blocked domain filter menus.
* Implement accordion list layout with formatted date display (`YYYY-MM-DDTHH:MM:SSZ`).
* Integrate JSON Serializer component for accordion expander.
* Add "Clear All Reports" action modal.


* [ ] **Step 7: User Management & RBAC Integration**
* Build `/admin/users` & `/admin/users/new`.
* Enforce role-based UI conditional rendering and API guardrails for `SUPERADMIN`, `ADMIN`, and `VIEWER`.