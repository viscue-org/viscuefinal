# Viscue Atomic Quota and Transient Compiler API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce daily cue allowances atomically and expose the existing VICSUC compiler through an authenticated, rate-limited Vercel API that never persists user content.

**Architecture:** Supabase migrations provide deny-by-default account, subscription, usage, reservation, webhook-audit, and rate-limit storage. The Vercel route reserves a cue in Postgres, passes only bounded request-memory media to the existing compiler, then commits or releases the reservation idempotently.

**Tech Stack:** PostgreSQL/Supabase RLS, Next.js Route Handlers, Zod, existing VICSUC ESM modules, Vitest, Amazon Bedrock

**Spec:** `docs/superpowers/specs/2026-09-03-online-auth-billing-quota-design.md`

## Global Constraints

- Store no user project, graph, media, annotation, prompt, or result in Supabase, Vercel Blob, logs, traces, or analytics.
- Maximum encoded request size is 4,000,000 bytes, leaving margin below Vercel's 4.5 MB limit.
- Original videos never upload; only locally selected frames and temporal metadata may be sent.
- Free/Plus/Pro allowances are exactly 9/28/99 per UTC day.
- Quota and plan decisions are server/database authoritative and concurrency-safe.
- Failed internal processing releases a reservation exactly once.
- Raw IP addresses are never persisted.

---

### Task 1: Account, Billing, and Usage Schema with RLS

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/202609030001_core_accounts.sql`
- Create: `supabase/tests/core_accounts.test.sql`
- Create: `web/src/lib/account/types.ts`

**Interfaces:**
- Produces: enums `viscue_plan`, `subscription_status`, tables `profiles`, `billing_customers`, `subscriptions`, `usage_daily`, `cue_reservations`, `webhook_events`, and safe function `get_account_summary()`.

- [ ] **Step 1: Write pgTAP policy tests first**

Test that anonymous users read nothing; user A cannot read user B; authenticated users cannot insert/update/delete subscription, usage, reservation, customer, or webhook rows; and `get_account_summary()` returns only the caller's data.

- [ ] **Step 2: Run the migration test and verify red**

Run: `supabase db reset`  
Run: `supabase test db supabase/tests/core_accounts.test.sql`  
Expected: FAIL because schema objects do not exist.

- [ ] **Step 3: Implement the schema and trigger-created profile**

Use UUID foreign keys to `auth.users(id) on delete cascade`, non-negative checks for counters, unique Dodo identifiers, and timestamps. The auth trigger inserts only `user_id` and safe display-name data; it does not copy arbitrary metadata.

- [ ] **Step 4: Enable RLS and narrow grants**

Enable and force RLS on every public table. Grant safe profile select/update policies and execute on `get_account_summary()` to `authenticated`; revoke all other client table writes. Fix `search_path = pg_catalog, public` on security-definer functions.

- [ ] **Step 5: Implement typed account summary contract**

```ts
export type AccountSummary = {
  email: string
  plan: 'free' | 'plus' | 'pro'
  allowance: 9 | 28 | 99
  consumed: number
  reserved: number
  remaining: number
  resetsAt: string
  subscriptionStatus: string | null
}
```

- [ ] **Step 6: Run database tests and commit**

Run: `supabase db reset`  
Run: `supabase test db`  
Expected: PASS.

```powershell
git add supabase web/src/lib/account/types.ts
git commit -m "feat: add protected account and usage schema"
```

### Task 2: Atomic Cue Reservation State Machine

**Files:**
- Create: `supabase/migrations/202609030002_cue_reservations.sql`
- Create: `supabase/tests/cue_reservations.test.sql`
- Create: `web/src/lib/quota/repository.ts`
- Create: `web/src/lib/quota/repository.test.ts`

**Interfaces:**
- Produces: `reserve_cue(p_request_key text)`, `commit_cue(p_reservation_id uuid)`, `release_cue(p_reservation_id uuid)`, and `expire_cue_reservations()`.
- `reserve_cue` returns `{ reservation_id, allowance, consumed, reserved, remaining, resets_at }` or SQLSTATE `P0001` with safe code `quota_exhausted`.

- [ ] **Step 1: Write failing concurrency and idempotency tests**

Cover 10 concurrent reservations on Free yielding 9 accepted; repeat request key returning the same reservation; double commit consuming once; commit after release doing nothing; release after commit doing nothing; and expired reservations decrementing `reserved` once.

- [ ] **Step 2: Run tests and verify red**

Run: `supabase test db supabase/tests/cue_reservations.test.sql`  
Expected: FAIL because functions are absent.

- [ ] **Step 3: Implement the locked transaction functions**

Each function derives `auth.uid()`, uses `timezone('utc', now())::date`, upserts and locks `usage_daily`, calculates entitlement from server-owned active subscription rows and the exact 9/28/99 mapping, and updates reservation plus counters in one transaction.

- [ ] **Step 4: Implement the server repository adapter**

```ts
export interface QuotaRepository {
  reserve(userJwt: string, requestKey: string): Promise<Reservation>
  commit(userJwt: string, reservationId: string): Promise<void>
  release(userJwt: string, reservationId: string): Promise<void>
}
```

Map quota exhaustion to HTTP 429 fields only; redact Postgres internals.

- [ ] **Step 5: Run database and repository tests**

Run: `supabase test db`  
Run: `pnpm --dir web test -- src/lib/quota`  
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add supabase/migrations/202609030002_cue_reservations.sql supabase/tests/cue_reservations.test.sql web/src/lib/quota
git commit -m "feat: enforce atomic daily cue reservations"
```

### Task 3: Distributed Rate Limiter

**Files:**
- Create: `supabase/migrations/202609030003_rate_limits.sql`
- Create: `supabase/tests/rate_limits.test.sql`
- Create: `web/src/lib/security/rate-limit.ts`
- Create: `web/src/lib/security/rate-limit.test.ts`
- Modify: `web/.env.example`
- Modify: `web/src/features/auth/actions.ts`
- Modify: `web/src/features/connect/authorize.ts`

**Interfaces:**
- Produces: `check_rate_limit(action, key_hash, limit, window_seconds)` and `enforceRateLimit({ action, userId?, email?, ip, device? })`.

- [ ] **Step 1: Write failing boundary tests**

Assert the Nth request passes, N+1 fails with `retryAfter`, different users do not share buckets, fixed windows reset, raw IP/email never reaches stored `key_hash`, and an absent IP still enforces account keys.

- [ ] **Step 2: Run tests and verify red**

Run: `supabase test db supabase/tests/rate_limits.test.sql`  
Run: `pnpm --dir web test -- src/lib/security/rate-limit.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement HMAC keys and atomic bucket increment**

Use `RATE_LIMIT_HMAC_SECRET` with HMAC-SHA-256. Normalize email before hashing. Trust Vercel's platform-provided client IP header only; do not accept a browser-supplied forwarded chain.

- [ ] **Step 4: Encode the approved thresholds**

Create an immutable policy map for signup 5/IP/hour + 3/email/hour; login 10/IP/15m + 5/account/15m; reset 10/IP/hour + 3/email/hour; OAuth 20/IP/15m; extension authorization 10/account/hour + 20/IP/hour; checkout 5/account/hour + 15/IP/hour; compile burst 6/account/minute.

- [ ] **Step 5: Wire authentication and extension authorization actions**

Call `enforceRateLimit` before Supabase signup, password login, password reset, Google OAuth start, and extension authorization. Use generic 429 responses and `Retry-After`; the email/account limiter must not change response copy in a way that reveals account existence.

- [ ] **Step 6: Run tests and commit**

Run: `supabase test db`  
Run: `pnpm --dir web test -- src/lib/security/rate-limit.test.ts`  
Expected: PASS.

```powershell
git add supabase web/src/lib/security/rate-limit* web/.env.example web/src/features/auth/actions.ts web/src/features/connect/authorize.ts
git commit -m "feat: add distributed abuse rate limits"
```

### Task 4: Bounded Transient Request Validation

**Files:**
- Create: `web/src/lib/compiler/request-schema.ts`
- Create: `web/src/lib/compiler/request-schema.test.ts`
- Create: `web/src/lib/compiler/redaction.ts`
- Create: `web/src/lib/compiler/redaction.test.ts`
- Create: `extension/src/utils/transientMedia.mjs`
- Create: `extension/tests/transient-media.test.mjs`

**Interfaces:**
- Produces: `parseCompileRequest(raw, byteLength)`, `safeCompilerError(error)`, and `buildTransientMedia(graph, localMedia)`.

- [ ] **Step 1: Write failing size/MIME/content tests**

Reject bodies above 4,000,000 bytes, unknown keys, remote media URLs, original videos, non-data URLs, disallowed MIME types, excessive assets/pages, malformed base64, and graph IDs not matching media IDs. Assert errors contain no data URL, prompt, filename, or provider response.

- [ ] **Step 2: Run tests and verify red**

Run: `pnpm --dir web test -- src/lib/compiler`  
Run: `node --test extension/tests/transient-media.test.mjs`  
Expected: FAIL.

- [ ] **Step 3: Implement strict schemas and local reduction envelope**

Allow only JPEG/PNG/WebP reduced images and explicitly bounded text excerpts. Convert video to selected local sample frames before request construction. Calculate encoded JSON bytes before sending and return a local actionable error above 4,000,000 bytes.

- [ ] **Step 4: Implement redacted operational errors**

Expose only stable codes: `invalid_request`, `payload_too_large`, `quota_exhausted`, `rate_limited`, `compiler_unavailable`, and `internal_error`. Log only request ID, user hash, status, timing, stage names, and byte counts.

- [ ] **Step 5: Run tests and commit**

Run: `pnpm --dir web test -- src/lib/compiler`  
Run: `node --test extension/tests/transient-media.test.mjs`  
Expected: PASS.

```powershell
git add web/src/lib/compiler extension/src/utils/transientMedia.mjs extension/tests/transient-media.test.mjs
git commit -m "feat: bound transient compiler requests"
```

### Task 5: Adapt VICSUC Compiler to a Vercel Route

**Files:**
- Create: `web/src/lib/compiler/run.ts`
- Create: `web/src/lib/compiler/run.test.ts`
- Create: `web/src/app/api/compile/route.ts`
- Create: `web/src/app/api/compile/route.test.ts`
- Create: `web/src/app/api/health/route.ts`
- Create: `web/src/app/api/health/route.test.ts`
- Create: `web/src/app/api/capabilities/route.ts`
- Create: `web/src/app/api/handoff-receipt/route.ts`
- Create: `web/src/app/api/handoff-receipt/route.test.ts`
- Modify: `local-server/lib/pipeline.mjs`
- Modify: `local-server/lib/receipts.mjs`
- Create: `web/src/lib/compiler/receipt-repository.ts`

**Interfaces:**
- Consumes: authenticated JWT, `QuotaRepository`, validated transient request, existing `runPipeline`.
- Produces: `POST /api/compile`, `POST /api/handoff-receipt`, `GET /api/health`, and `GET /api/capabilities` with existing VICSUC-compatible result shapes.

- [ ] **Step 1: Write failing route state-machine tests**

Test unauthenticated 401; rate-limited 429 before reservation; quota 429 before compiler; successful compiler reserve→commit; thrown/blocked compiler reserve→release; repeated request ID reuses reservation; response and logs omit input content.

- [ ] **Step 2: Run focused tests and verify red**

Run: `pnpm --dir web test -- src/app/api/compile/route.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Extract environment-neutral compiler construction**

Keep pipeline modules free of `http`, filesystem, and `.env` loading. `web/src/lib/compiler/run.ts` constructs Bedrock/font gateways from validated server environment. Ensure Bedrock invocation logging is not enabled by this application.

- [ ] **Step 4: Implement the route orchestration**

Read raw text with a byte counter, authenticate, apply origin and burst checks, parse JSON, reserve, compile, and commit. In `catch/finally`, release only when a reservation exists and was not committed. Set `Cache-Control: no-store` and never reflect internal error messages.

- [ ] **Step 5: Replace in-memory receipt persistence**

Store only handoff state hashes, execution IDs, user ID, and expiry in a protected Supabase table/function. Never store prompts, filenames, graph content, or attachments. Add cross-user and expiry tests.

- [ ] **Step 6: Implement receipt, health, and capability routes**

`POST /api/handoff-receipt` authenticates the same user who owns the execution and commits only matching execution/fingerprint/prompt/attachment hashes. `GET /api/health` reports deploy/database/compiler readiness without model credentials. `GET /api/capabilities` returns public model availability flags and `credentials_exposed: false`; it never returns provider endpoints or IDs that are configured as private.

- [ ] **Step 7: Run regression gates**

Run: `pnpm --dir web test -- src/app/api/compile/route.test.ts src/app/api/handoff-receipt/route.test.ts src/app/api/health/route.test.ts src/lib/compiler`  
Run: `node --test local-server/tests/*.test.mjs`  
Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add web/src/lib/compiler web/src/app/api/compile web/src/app/api/handoff-receipt web/src/app/api/health web/src/app/api/capabilities local-server/lib supabase
git commit -m "feat: expose authenticated transient compile API"
```

### Task 6: Account Summary API

**Files:**
- Create: `web/src/app/api/account/route.ts`
- Create: `web/src/app/api/account/route.test.ts`
- Create: `web/src/lib/account/get-summary.ts`

**Interfaces:**
- Produces: `GET /api/account` returning the exact `AccountSummary` contract with `Cache-Control: no-store`.

- [ ] **Step 1: Write failing authorization and response tests**

Assert 401 without a user, caller-only data, correct 9/28/99 mappings, non-negative remaining, ISO UTC reset timestamp, and no Dodo IDs/database fields in output.

- [ ] **Step 2: Run and verify red**

Run: `pnpm --dir web test -- src/app/api/account/route.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement safe RPC-backed summary**

Call `get_account_summary()` with the user's JWT client, validate the returned shape with Zod, attach the verified email from Auth, and set `Cache-Control: no-store, private`.

- [ ] **Step 4: Run the complete quota/API gate**

Run: `supabase test db`  
Run: `pnpm --dir web test`  
Run: `pnpm --dir web build`  
Run: `node --test local-server/tests/*.test.mjs extension/tests/*.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add web/src/app/api/account web/src/lib/account
git commit -m "feat: expose safe account usage summary"
```
