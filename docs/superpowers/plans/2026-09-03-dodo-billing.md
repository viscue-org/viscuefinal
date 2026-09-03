# Viscue Dodo Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide authenticated Plus/Pro checkout and synchronize subscription entitlement from cryptographically verified, idempotent Dodo webhooks.

**Architecture:** The browser chooses only a plan slug. Server-side code maps that slug to an allowlisted environment product ID and creates Dodo checkout. Dodo subscription webhooks are the sole authority for paid entitlement; raw signed bodies are verified before any database mutation.

**Tech Stack:** Dodo Payments Node SDK, Next.js Route Handlers, Supabase/Postgres, Zod, Vitest

**Spec:** `docs/superpowers/specs/2026-09-03-online-auth-billing-quota-design.md`

## Global Constraints

- Plus is $4.90/month with 28 cues/day; Pro is $9/month with 99 cues/day.
- The exposed Dodo API key must be revoked; only its replacement may enter Vercel server-only environment variables.
- Unknown business IDs, product IDs, unsigned events, stale signatures, and out-of-order events grant nothing.
- Raw webhook payloads and customer billing addresses are not stored by Viscue.
- Checkout and portal creation require an authenticated, rate-limited account.
- Test Mode must pass before Live Mode changes.

---

### Task 1: Billing Configuration and Product Allowlist

**Files:**
- Modify: `web/.env.example`
- Create: `web/src/lib/billing/config.ts`
- Create: `web/src/lib/billing/config.test.ts`
- Create: `web/src/lib/billing/dodo.ts`

**Interfaces:**
- Produces: `BILLING_PLANS`, `planForProductId(productId)`, `productIdForPlan(plan)`, and `createDodoClient()`.

- [ ] **Step 1: Write failing allowlist tests**

```ts
expect(productIdForPlan('plus')).toBe(process.env.DODO_PLUS_PRODUCT_ID)
expect(planForProductId('pdt_unknown')).toBeNull()
expect(() => productIdForPlan('enterprise' as never)).toThrow()
```

- [ ] **Step 2: Run and verify red**

Run: `pnpm --dir web test -- src/lib/billing/config.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement immutable plan mapping and server-only client**

Add empty example keys for `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, `DODO_BUSINESS_ID`, `DODO_PLUS_PRODUCT_ID`, and `DODO_PRO_PRODUCT_ID`. Validate IDs by prefix/length and reject equal Plus/Pro IDs.

- [ ] **Step 4: Run tests and commit**

Run: `pnpm --dir web test -- src/lib/billing/config.test.ts`  
Expected: PASS.

```powershell
git add web/.env.example web/src/lib/billing
git commit -m "feat: add allowlisted Dodo billing configuration"
```

### Task 2: Authenticated Checkout and Customer Portal Routes

**Files:**
- Create: `web/src/app/api/billing/checkout/route.ts`
- Create: `web/src/app/api/billing/checkout/route.test.ts`
- Create: `web/src/app/api/billing/portal/route.ts`
- Create: `web/src/app/api/billing/portal/route.test.ts`
- Create: `web/src/lib/billing/customers.ts`
- Create: `web/src/lib/billing/customers.test.ts`

**Interfaces:**
- Consumes: authenticated user, billing plan slug, allowlisted product, checkout rate limiter.
- Produces: `{ checkoutUrl }` and `{ portalUrl }` containing only verified HTTPS Dodo URLs.

- [ ] **Step 1: Write failing route tests**

Cover unauthenticated 401, CSRF/origin rejection, rate-limit 429, invalid plan 400, client-supplied product ID ignored/rejected, idempotent customer reuse, safe HTTPS URL validation, and no API key in response/logs.

- [ ] **Step 2: Run and verify red**

Run: `pnpm --dir web test -- src/app/api/billing src/lib/billing/customers.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement customer creation/reuse**

Look up `billing_customers` by `auth.uid()`. If absent, create a Dodo customer with verified Auth email and a server-generated idempotency key, then insert the unique mapping. Resolve concurrent creation by re-reading the unique row.

- [ ] **Step 4: Implement checkout and portal routes**

Accept `{ plan: 'plus' | 'pro' }` only. Add authenticated user ID as Dodo metadata, choose the server product ID, and use `${siteUrl}/account?checkout=complete` as return URL. Validate Dodo-returned URLs against exact approved hosts before responding.

- [ ] **Step 5: Run tests and commit**

Run: `pnpm --dir web test -- src/app/api/billing src/lib/billing/customers.test.ts`  
Expected: PASS.

```powershell
git add web/src/app/api/billing web/src/lib/billing/customers*
git commit -m "feat: create secure Dodo checkout and portal sessions"
```

### Task 3: Verified Idempotent Subscription Webhook

**Files:**
- Create: `supabase/migrations/202609030004_billing_events.sql`
- Create: `supabase/tests/billing_events.test.sql`
- Create: `web/src/app/api/webhooks/dodo/route.ts`
- Create: `web/src/app/api/webhooks/dodo/route.test.ts`
- Create: `web/src/lib/billing/apply-event.ts`
- Create: `web/src/lib/billing/apply-event.test.ts`

**Interfaces:**
- Consumes: raw body and `webhook-id`, `webhook-signature`, `webhook-timestamp` headers.
- Produces: `apply_dodo_subscription_event(...)` transactional RPC and HTTP 200 for applied/duplicate valid events.

- [ ] **Step 1: Write failing cryptographic and ordering tests**

Test missing/forged/stale signatures; wrong business; malformed body; unknown product; duplicate webhook ID; same subscription with older event timestamp; active→on_hold→renewed; plan change; cancellation/expiry; and valid retry after transient DB failure.

- [ ] **Step 2: Run tests and verify red**

Run: `supabase test db supabase/tests/billing_events.test.sql`  
Run: `pnpm --dir web test -- src/app/api/webhooks/dodo/route.test.ts src/lib/billing/apply-event.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement raw-body signature verification first**

Use the official SDK `unwrap(rawBody, { headers, key })`; never call `unsafeUnwrap` outside an isolated test helper. Verify expected business ID and allowlisted event names/products before invoking the database.

- [ ] **Step 4: Implement transactional event application**

Insert `webhook_events(webhook_id, event_type, payload_hash)` and update subscription/customer state in one transaction. Do not store raw JSON. Ignore stale resource timestamps. Map Dodo statuses explicitly; default unknown states to no paid entitlement.

- [ ] **Step 5: Keep acknowledgment semantics retry-safe**

Return 200 for a valid duplicate, 400 for malformed input, 401 for invalid signature, and 500 for a verified event that could not be committed so Dodo retries.

- [ ] **Step 6: Run tests and commit**

Run: `supabase test db`  
Run: `pnpm --dir web test -- src/app/api/webhooks/dodo/route.test.ts src/lib/billing/apply-event.test.ts`  
Expected: PASS.

```powershell
git add supabase web/src/app/api/webhooks web/src/lib/billing/apply-event*
git commit -m "feat: synchronize verified Dodo subscriptions"
```

### Task 4: Account and Pricing Billing UI

**Files:**
- Create: `web/src/app/account/page.tsx`
- Create: `web/src/features/account/account-dashboard.tsx`
- Create: `web/src/features/account/account-dashboard.test.tsx`
- Create: `web/src/features/billing/pricing-cards.tsx`
- Create: `web/src/features/billing/pricing-cards.test.tsx`
- Create: `web/src/features/billing/checkout-button.tsx`

**Interfaces:**
- Consumes: `AccountSummary`, checkout/portal routes.
- Produces: authenticated account UI showing current plan, daily consumed/remaining, UTC reset, subscription state, and billing actions.

- [ ] **Step 1: Write failing UI tests**

Assert exact prices/allowances, current-plan badge, `remaining/allowance`, UTC reset label, processing message after checkout return, disabled duplicate checkout, and portal button only for a Dodo customer.

- [ ] **Step 2: Run tests and verify red**

Run: `pnpm --dir web test -- src/features/account src/features/billing`  
Expected: FAIL.

- [ ] **Step 3: Implement server-rendered account state and client billing actions**

The page calls the safe summary server-side. Checkout button posts a plan slug, disables while pending, then uses `location.assign(checkoutUrl)`. It never marks a plan active from query parameters; only webhook-backed account state controls the badge.

- [ ] **Step 4: Run tests and build**

Run: `pnpm --dir web test -- src/features/account src/features/billing`  
Run: `pnpm --dir web build`  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add web/src/app/account web/src/features/account web/src/features/billing
git commit -m "feat: add account usage and subscription UI"
```

### Task 5: Dodo Test and Live Configuration Gate

**Files:**
- Create: `docs/setup/dodo-payments.md`
- Create: `scripts/verify-billing-config.mjs`
- Create: `scripts/tests/verify-billing-config.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `pnpm verify:billing` and an operational checklist with exact product/event configuration.

- [ ] **Step 1: Write failing configuration-verifier tests**

Fixtures must reject reversed prices, 50/20 cue metadata, non-monthly periods, unknown products, disabled webhook, wrong URL, and missing required subscription event filters.

- [ ] **Step 2: Run and verify red**

Run: `node --test scripts/tests/verify-billing-config.test.mjs`  
Expected: FAIL.

- [ ] **Step 3: Implement redacted verifier and documentation**

The verifier reports product IDs and safe fields but never API/webhook keys. The setup guide requires Test Mode first, then the exact live edits: Plus `$4.90`, `28 cues per UTC day`, metadata `plus/28`; Pro `$9.00`, `99 cues per UTC day`, metadata `pro/99`; monthly recurrence; production webhook URL `/api/webhooks/dodo`; eight approved subscription events.

- [ ] **Step 4: Verify Test Mode end-to-end**

Create test products/webhook, complete test checkout, replay/forge/reorder events, and capture only safe IDs/statuses in the verification report. Expected: entitlement changes only on valid signed events.

- [ ] **Step 5: Apply live Dodo changes only after production endpoint health passes**

Rotate the exposed API key, place the replacement directly in Vercel's sensitive environment setting, update both products, and create the live webhook. Retrieve its signing secret directly into Vercel; never paste it into source, chat, or logs.

- [ ] **Step 6: Run the billing gate and commit**

Run: `node --test scripts/tests/verify-billing-config.test.mjs`  
Run: `pnpm verify:billing`  
Run: `pnpm --dir web test`  
Expected: PASS.

```powershell
git add docs/setup/dodo-payments.md scripts package.json
git commit -m "docs: verify Dodo subscription configuration"
```

