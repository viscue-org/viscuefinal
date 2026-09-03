# Viscue Online Authentication, Billing, and Cue Quota Design

**Date:** 2026-09-03  
**Status:** Approved for implementation  
**Owners:** Viscue

## 1. Purpose

Move Viscue's account, billing, quota enforcement, and model gateway online while keeping every user project local to the Chrome extension. A new user must be able to complete onboarding, create and verify an account, connect the extension, see the current plan and remaining daily cues, purchase a monthly plan through Dodo Payments, and use the product without running a local API server.

The system must not trust plan, identity, or quota values supplied by the extension. Those decisions are made atomically on the server and in Postgres.

## 2. Product rules

| Plan | Monthly price | Daily cue allowance |
| --- | ---: | ---: |
| Free | $0 | 9 |
| Plus | $4.90 USD | 28 |
| Pro | $9.00 USD | 99 |

- Allowances reset at 00:00 UTC.
- A cue is temporarily reserved when processing begins and becomes consumed only after a successful compile.
- A failed Viscue/model operation releases its reservation exactly once.
- A plan upgrade applies as soon as a verified `subscription.active` or applicable `subscription.plan_changed` webhook is processed.
- Changing plans does not erase cues already consumed that UTC day. Remaining cues equal `max(0, new allowance - consumed - reserved)`.
- A subscription that is on hold, failed, cancelled, or expired loses paid entitlement according to the effective status/date in Dodo. It falls back to Free unless another active paid subscription exists.
- The client cannot directly change a plan or usage count.

## 3. Architecture

### 3.1 Deployable units

Use one repository and one Next.js App Router application deployed on Vercel. It contains:

- public marketing, signup, login, verification, password reset, pricing, and legal pages;
- authenticated account and billing pages;
- the authorization/consent page used to connect the Chrome extension;
- authenticated API route handlers for account state, cue execution, checkout creation, customer portal creation, and Dodo webhooks;
- a server-only adapter around the existing VICSUC compiler modules.

Supabase provides Auth and Postgres. Dodo Payments is the billing authority. Amazon Bedrock remains the inference provider. Vercel stores secrets and runs the web/API application.

### 3.2 Extension authentication

Use Supabase OAuth 2.1 Authorization Code with PKCE for the extension. The extension is a public OAuth client and never has a client secret.

1. `Start Viscue` invokes `chrome.identity.launchWebAuthFlow` and opens the Vercel authorization page.
2. The extension generates a random PKCE verifier, challenge, and state value and stores the verifier locally only for the duration of the flow.
3. The user signs in on the website with verified email/password or Google and approves connecting Viscue.
4. Supabase redirects to the Chrome identity callback with a single-use authorization code.
5. The extension checks state, exchanges the code plus verifier, and stores the Supabase session in `chrome.storage.local`.
6. Refresh-token rotation maintains the session. Sign-out revokes the refresh token and clears extension state.

No access token, refresh token, password, Dodo key, model credential, or Supabase service-role key is placed in a URL, bundled file, or log.

### 3.3 Request path

The extension calls only the HTTPS Vercel API. Every protected route validates the Supabase JWT issuer, audience, signature, expiry, and subject. The server derives the user ID from the verified token and ignores any user ID or plan supplied in a request body.

For a compile:

1. Authenticate and rate-limit the request.
2. Validate the graph/media schema and enforce strict size, count, MIME, and dimension limits.
3. Call the atomic `reserve_cue` database function.
4. Process only reduced media held in request memory.
5. On success, call `commit_cue`; on controlled failure, call `release_cue`.
6. Return the existing VICSUC result contract to the extension.

Reservation functions are idempotent. A reservation has a short expiry so a terminated Vercel invocation cannot permanently consume capacity. A cleanup path releases expired reservations without granting extra cues.

## 4. Local-only user content boundary

The following remain exclusively in Chrome local storage:

- projects and canvas graphs;
- original images, videos, documents, captures, and derived frames;
- annotations, motion paths, prompts, compiled results, and destination receipts.

Supabase, Vercel Blob, analytics systems, and application logs must never persist this content.

When the user explicitly runs a cue, the extension may transmit a reduced processing copy over HTTPS. The copy must be small enough to remain below Vercel's 4.5 MB request limit after JSON/base64 overhead. The server holds it only in memory and sends it to Amazon Bedrock. It is not written to disk, object storage, a database, queue, error report, trace attribute, or log.

The existing extension reduction policy is retained and tightened:

- images/frames are resized and recompressed before transmission;
- documents send only user-selected, bounded excerpts or rendered pages;
- videos are represented by locally extracted sample frames and bounded temporal metadata rather than uploading the original video;
- the request is rejected locally if its encoded size exceeds the safe envelope.

AWS states that Amazon Bedrock inputs and outputs are not shared with model providers or used to train underlying models. Bedrock invocation logging must remain disabled for this workload. Viscue will accurately describe this as transient processing, not claim that bytes never leave the device.

## 5. Data model

### `profiles`

- `user_id uuid primary key references auth.users`
- `display_name text null`
- `created_at`, `updated_at`

Users may read and update only safe profile fields on their own row.

### `billing_customers`

- `user_id uuid primary key`
- `dodo_customer_id text unique`
- timestamps

No direct client access. Service-role webhook/checkout code only.

### `subscriptions`

- `dodo_subscription_id text primary key`
- `user_id uuid`
- `dodo_product_id text`
- `plan plan_t`
- `status subscription_status_t`
- `current_period_start`, `current_period_end`
- `cancel_at_period_end boolean`
- `last_event_at`, timestamps

Users receive a safe read-only view of their own subscription. Writes are service-role only.

### `usage_daily`

- `(user_id, usage_date)` primary key
- `consumed integer not null default 0`
- `reserved integer not null default 0`
- timestamps

Clients cannot read or write raw rows directly. A safe account summary function returns allowance, consumed, reserved, remaining, and next reset time.

### `cue_reservations`

- `id uuid primary key`
- `user_id uuid`
- `usage_date date`
- `status reserved|committed|released|expired`
- `request_key text`
- `expires_at`, timestamps
- unique `(user_id, request_key)`

The request key makes retries idempotent.

### `webhook_events`

- `webhook_id text primary key`
- `event_type text`
- `payload_hash text`
- `received_at`, `processed_at`
- `processing_status`, `error_code`

Store no raw webhook payload. The ID prevents duplicate side effects and the hash supports audit checks.

### `rate_limit_buckets`

- composite key containing action plus HMAC-hashed identity/IP/device signal
- fixed window start, count, expiry

Raw IP addresses are not persisted. Old buckets are deleted automatically.

## 6. Database security

- Enable RLS on every public-schema table.
- Revoke table writes from `anon` and `authenticated` unless explicitly required.
- Use `security definer` functions only with a fixed `search_path`, fully qualified names, narrow grants, input validation, and no dynamic SQL.
- The quota reservation transaction locks the relevant daily row and computes the effective plan from server-controlled subscription rows.
- Product IDs are mapped to plans using an allowlist; Dodo metadata is descriptive and never sufficient on its own to grant a plan.
- Service-role access exists only in Vercel server code.
- Database migrations include negative policy tests proving that one user cannot access another user's rows or mutate billing/usage data.

## 7. Billing design

### 7.1 Products

Update the existing live Dodo products:

- Viscue Plus: $4.90 every month, description `28 cues per UTC day.`, metadata `viscue_plan=plus`, `daily_cues=28`.
- Viscue Pro: $9.00 every month, description `99 cues per UTC day.`, metadata `viscue_plan=pro`, `daily_cues=99`.

The server maps the two exact Dodo product IDs to plan constants stored in environment variables. It never accepts an arbitrary product ID from the browser.

### 7.2 Checkout

`POST /api/billing/checkout` requires an authenticated and rate-limited user. It accepts only `plus` or `pro`, resolves the allowlisted product server-side, creates/reuses the Dodo customer, creates checkout with a server-generated idempotency key, and returns only the hosted checkout URL. Success redirects to the account page, which shows `processing` until the signed webhook arrives.

### 7.3 Webhook

`POST /api/webhooks/dodo` reads the raw body, verifies Dodo's Standard Webhooks signature and timestamp using the webhook secret, checks the business ID, and inserts the `webhook-id` before applying changes in one transaction.

Subscribe only to required lifecycle events: `subscription.active`, `subscription.renewed`, `subscription.updated`, `subscription.plan_changed`, `subscription.on_hold`, `subscription.cancelled`, `subscription.failed`, and `subscription.expired`.

Events may arrive late, out of order, or more than once. The handler is idempotent and applies state only when event/resource timestamps are not older than the stored state. It acknowledges valid duplicates without repeating effects. Invalid signatures, stale timestamps, unknown businesses/products, or malformed payloads never change entitlement.

## 8. Rate limiting and abuse controls

Use server-side database-backed rate limits so limits apply across Vercel instances. Suggested starting thresholds are configuration, not client-visible authority:

- signup: 5 attempts/IP/hour and 3 attempts/email/hour;
- password login: 10 attempts/IP/15 minutes and 5 attempts/account/15 minutes;
- password reset: 3 attempts/email/hour and 10 attempts/IP/hour;
- OAuth starts/callbacks: 20/IP/15 minutes;
- extension authorization: 10/account/hour and 20/IP/hour;
- checkout creation: 5/account/hour and 15/IP/hour;
- compile starts: bounded by plan plus a burst ceiling of 6/account/minute;
- webhook endpoint: signature verification first, plus a defensive high-volume source limit that cannot discard legitimate retries silently.

Rate-limit keys use an application HMAC secret. Responses are generic and do not reveal whether an email exists. Add strict Content Security Policy, frame ancestors, referrer policy, MIME sniffing protection, secure/HttpOnly/SameSite cookies, CSRF checks for cookie-authenticated mutations, allowed-origin checks, and exact extension redirect/origin allowlists.

Vercel Firewall rules provide coarse bot and volumetric protection. Application and database checks remain mandatory because firewall rules alone cannot enforce per-account quotas.

## 9. UI behavior

### Website

- `/login`, `/signup`, `/verify`, `/forgot-password`, and `/auth/callback`
- `/connect` for extension authorization
- `/account` showing email, plan, consumed/remaining cues, UTC reset, subscription state, pricing, and billing actions
- generic success/error states that do not leak account existence or internal provider errors

### Extension

- onboarding `Start Viscue` begins web authentication instead of opening the workspace directly;
- popup shows real identity, plan, and remaining cues from the server;
- expired sessions refresh once, then require sign-in;
- exhausted quota blocks compile and opens `/account#plans`;
- offline/account-service errors do not destroy local work;
- no client-side plan selector or fallback test bearer key remains.

## 10. Secrets and configuration

Vercel server-only variables:

- `SUPABASE_SERVICE_ROLE_KEY`
- `DODO_PAYMENTS_API_KEY`
- `DODO_PAYMENTS_WEBHOOK_KEY`
- `DODO_BUSINESS_ID`
- exact Plus/Pro product IDs
- AWS Bedrock credentials/model IDs
- rate-limit HMAC secret

Public configuration is limited to the Supabase project URL, publishable key, website URL, and registered OAuth client ID. Secret variables never use `NEXT_PUBLIC_`. Production, preview, and development receive separate credentials; preview cannot access live Dodo or production service-role credentials.

The Dodo API key pasted into chat must be revoked and replaced before production use. It must never be copied into source code or a shell command.

## 11. Failure behavior

- Authentication failure: return 401 and preserve local work.
- Quota exhausted: return 429 with safe allowance/remaining/reset fields.
- Rate limit exceeded: return 429 with `Retry-After` and generic copy.
- Reservation database failure: fail closed before calling Bedrock.
- Bedrock/compiler failure: release reservation idempotently and return a redacted error.
- Commit uncertainty: retry `commit_cue` by reservation ID; never issue a second reservation for the same request key.
- Dodo webhook failure after valid verification: return non-2xx so Dodo retries; duplicate delivery remains safe.
- Unknown product/business: record a safe error code, grant nothing, and alert operational monitoring without raw payloads.
- Cancellation/hold: server account state changes; existing local projects remain usable but new paid cue allowance is not granted.

## 12. Verification strategy

### Automated

- unit tests for plan mapping, request validation, redaction, media size calculations, and webhook event ordering;
- database tests for every RLS policy and quota function, including concurrent reservations;
- route tests for missing/expired/forged JWTs, CSRF/origin failures, quota exhaustion, and rate-limit combinations;
- official Dodo SDK signature tests using raw bodies plus duplicate and out-of-order events;
- extension tests for PKCE state/verifier handling, token refresh, logout, exhausted quota, and local-data preservation;
- regression tests for the existing compile and handoff contracts;
- package scanning that rejects secrets, `.env` files, test keys, localhost production URLs, and source maps.

### End-to-end

1. Create and verify an email/password account.
2. Sign in through Google.
3. Connect a clean extension install using PKCE.
4. Confirm Free starts with 9 daily cues.
5. Run concurrent cue requests and prove the limit cannot be exceeded.
6. Complete Dodo test checkouts for Plus and Pro and verify immediate allowance changes.
7. Replay, reorder, and forge webhook deliveries and prove entitlement remains correct.
8. Put a subscription on hold/cancel it and verify fallback behavior.
9. Inspect Supabase, Vercel logs, and built artifacts and prove user project/media content was not persisted.
10. Deploy production, create the live webhook, run a low-risk production smoke test, and verify account/extension state.

## 13. Rollout order

1. Establish the repository and Vercel project linkage.
2. Add the Next.js web/API application without changing the published extension.
3. Apply and test Supabase migrations and auth configuration.
4. Add authenticated quota and transient compile APIs.
5. Add Dodo checkout/webhook handling and validate entirely in Test Mode.
6. Add extension PKCE/account/quota integration.
7. Run security, concurrency, package, and end-to-end tests.
8. Correct the live Dodo product definitions, deploy production, create the signed webhook, and smoke-test.
9. Publish the updated extension only after the production API passes verification.

## 14. Explicit non-goals

- Cloud project synchronization or backup
- Storing original or reduced user media online
- Usage-based overage billing
- Annual plans, add-ons, team accounts, or lifetime purchases
- Trusting client-side plan values
- Claiming absolute immunity from future vulnerabilities

## 15. Authoritative references

- [Vercel Function limits](https://vercel.com/docs/functions/limitations)
- [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords)
- [Supabase OAuth 2.1 server](https://supabase.com/docs/guides/auth/oauth-server)
- [Supabase PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Dodo subscription webhook events](https://docs.dodopayments.com/developer-resources/webhooks/intents/subscription)
- [Dodo webhook creation API](https://docs.dodopayments.com/api-reference/webhooks/create-webhook)
- [Amazon Bedrock data protection](https://docs.aws.amazon.com/bedrock/latest/userguide/data-protection.html)

