# Viscue Online Product Verification Report

Date: 2026-09-03  
Repository: [viscue-org/viscuefinal](https://github.com/viscue-org/viscuefinal)  
Branch: `main`

---

## 1. Connected Infrastructure Verification

### Supabase Backend
* **Project Reference:** `vqqaxhzqaehjdpoefrjc` (`Viscue extension`)
* **Status:** `ACTIVE_HEALTHY`
* **Migrations Applied:**
  * `202609030001_core_accounts.sql` (Profiles, Subscriptions, Usage, RLS)
  * `202609030002_cue_reservations.sql` (Atomic `reserve_cue`, `commit_cue`, `release_cue`)
  * `202609030004_billing_events.sql` (Idempotent cryptographic Dodo webhook RPC)
* **Access Control:** All public tables enforce Row Level Security. `get_account_summary` and cue reservation functions are granted only to `authenticated`.

### Dodo Payments
* **Mode:** Live Mode
* **Products Configured:**
  * **Viscue Plus:** `$4.90 / month` — 28 Cues / day allowance (`pdt_0Njwkcsm5QrrZxWwkAe3L`)
  * **Viscue Pro:** `$9.00 / month` — 99 Cues / day allowance (`pdt_0Njwkcq27QRFcZ5cACBD5`)
* **Webhook Endpoint:** `/api/webhooks/dodo` with raw body HMAC verification and replay audit via `webhook_events`.

### Vercel Hosted Application
* **Project:** `viscue-starter/viscue`
* **Deployment URL:** `https://viscue-viscue-starter.vercel.app`
* **Routes Available:**
  * Landing page: `/`
  * Policies: `/privacy`, `/terms`
  * Account & Quota dashboard: `/account`
  * OAuth connect page: `/connect`
  * Authentication: `/login`, `/signup`, `/verify`, `/forgot-password`, `/update-password`, `/auth/callback`
  * APIs: `/api/account/summary`, `/api/billing/checkout`, `/api/billing/portal`, `/api/compile/vicsuc`, `/api/webhooks/dodo`

---

## 2. Test Suite Execution Summary

### Web Application (`pnpm --dir web test`)
* **Test files:** 19 passed (19 total)
* **Tests:** 41 passed (41 total)
* **Coverage:**
  * Environment validation and secret leak prevention
  * Strict security headers (CSP without `unsafe-eval`, `frame-ancestors 'none'`, `no-referrer`)
  * Extension OAuth 2.1 authorization request allowlist & PKCE S256 verification
  * Anti-enumeration authentication state
  * Quota reservation state machine repository
  * Dodo checkout & customer portal endpoints
  * Bounded payload compile route (<= 4,000,000 bytes)

### Chrome Extension (`node --test extension/tests/*.test.mjs`)
* **Test files:** 36 passed (36 total)
* **Coverage:**
  * PKCE generation, verifier entropy, and safe callback handling
  * Background session storage, refresh-token rotation, and sign-out
  * API client bearer headers, request ID, and 429 quota handling
  * Pure account view model (`accountView`)
  * Full-page workspace, visual motion recorder, annotations, history retention

---

## 3. Privacy & Zero Cloud Storage Compliance
* Full-resolution original media, drawing vectors, image crops, and project canvas state are maintained strictly in local Chrome storage.
* Transient compilation sends only bounded excerpts (<= 4MB) to the server in memory.
* Zero user prompts, project trees, or images are written to Supabase, Vercel Blob, or persistent storage.
