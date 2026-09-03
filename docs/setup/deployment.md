# Viscue Production Deployment Guide

This document outlines the live configuration, environment scopes, database migrations, and rollback procedures for Viscue.

---

## 1. Connected Services Overview

| Service | Target Identifier | Purpose |
| :--- | :--- | :--- |
| **GitHub** | `https://github.com/viscue-org/viscuefinal.git` | Primary source code repository and CI automation |
| **Supabase** | `vqqaxhzqaehjdpoefrjc` (`Viscue extension`) | PostgreSQL database, Auth with PKCE, daily usage & RLS |
| **Vercel** | `viscue-starter/viscue` (`https://viscue-viscue-starter.vercel.app`) | Hosted Next.js 16 Web & API application |
| **Dodo Payments** | Live Account | Recurring subscriptions (Plus: $4.90/mo, Pro: $9.00/mo) |

---

## 2. Environment Variable Scopes

### Vercel Server & Public Environment Variables
The following environment variables are configured across Production and Preview:

* `NEXT_PUBLIC_SUPABASE_URL`: `https://vqqaxhzqaehjdpoefrjc.supabase.co`
* `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase anon public key
* `NEXT_PUBLIC_SITE_URL`: Production domain / Vercel deployment URL
* `SUPABASE_SERVICE_ROLE_KEY`: Private Supabase service role secret (server-only)
* `DODO_PAYMENTS_API_KEY`: Server-only live Dodo secret key
* `DODO_PAYMENTS_WEBHOOK_KEY`: Server-only Dodo webhook secret key
* `DODO_PLUS_PRODUCT_ID`: `pdt_0Njwkcsm5QrrZxWwkAe3L`
* `DODO_PRO_PRODUCT_ID`: `pdt_0Njwkcq27QRFcZ5cACBD5`
* `AWS_ACCESS_KEY_ID`: Amazon Bedrock runtime credentials
* `AWS_SECRET_ACCESS_KEY`: Amazon Bedrock runtime credentials
* `AWS_REGION`: Bedrock region (e.g. `us-east-1` or `ap-southeast-2`)

---

## 3. Database Migration Deployment

Supabase database migrations reside in `supabase/migrations/`:
* `202609030001_core_accounts.sql`: Accounts, profiles, daily usage, subscriptions, and RLS.
* `202609030002_cue_reservations.sql`: Atomic reservation state machine (`reserve_cue`, `commit_cue`, `release_cue`).
* `202609030004_billing_events.sql`: Idempotent cryptographic Dodo webhook event application.

To push migrations to the live database:
```powershell
npx supabase db push --project-ref vqqaxhzqaehjdpoefrjc --yes
```

---

## 4. Building the Chrome Extension

To build the unpacked Chrome extension artifact:
```powershell
pnpm build
```
Artifact output directory: `dist/extension/`

Load unpacked into Chrome via `chrome://extensions` > Developer mode > **Load unpacked**.
