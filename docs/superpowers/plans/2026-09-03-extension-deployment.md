# Viscue Extension Integration and Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the Chrome extension to the hosted authenticated API, replace fake local account state, verify local-only content handling, and deploy the complete product through GitHub, Supabase, Vercel, and Dodo.

**Architecture:** The Manifest V3 background worker owns OAuth tokens and authenticated networking. UI components request safe account/compile actions through Chrome messaging; no component can set plan or usage. Deployment proceeds from test environments to production with artifact and live-flow verification.

**Tech Stack:** Chrome Manifest V3, `chrome.identity`, Supabase OAuth 2.1 PKCE, Vite/React, Node test runner, GitHub, Supabase CLI, Vercel CLI

**Spec:** `docs/superpowers/specs/2026-09-03-online-auth-billing-quota-design.md`

## Global Constraints

- No fallback test bearer key and no production localhost API URL.
- OAuth access/refresh tokens live only in extension local storage and are never exposed to content scripts or page JavaScript.
- Original project/media content remains local; only bounded transient copies leave after explicit cue execution.
- UI-displayed plan/remaining values come from authenticated server responses.
- Existing VICSUC compile and handoff behavior must remain compatible.
- Production release occurs only after database, auth, billing, security, and package gates pass.

---

### Task 1: Extension PKCE Session Module

**Files:**
- Modify: `extension/manifest.json`
- Create: `extension/auth/session.mjs`
- Create: `extension/auth/pkce.mjs`
- Create: `extension/tests/auth-session.test.mjs`
- Create: `extension/tests/pkce.test.mjs`

**Interfaces:**
- Produces: `signIn()`, `signOut()`, `getAccessToken()`, `refreshSession()`, `randomVerifier()`, `challengeFor(verifier)`, and `safeOAuthCallback(url, expectedState)`.

- [ ] **Step 1: Write failing PKCE and callback tests**

Assert verifier entropy/length, S256 challenge, constant-time state match, rejection of missing/error/replayed callbacks, rejection of wrong callback origin, one-time verifier cleanup, and refresh-token rotation persistence.

- [ ] **Step 2: Run and verify red**

Run: `node --test extension/tests/pkce.test.mjs extension/tests/auth-session.test.mjs`  
Expected: FAIL.

- [ ] **Step 3: Add minimal manifest permissions**

Add `identity` permission and exact production API/Auth host permissions. Remove `http://127.0.0.1:8787/*` from the production manifest and narrow `<all_urls>` where existing content/capture behavior permits without regression.

- [ ] **Step 4: Implement OAuth Authorization Code with PKCE**

Use `chrome.identity.getRedirectURL('oauth2')`, a 32-byte verifier and state, `chrome.identity.launchWebAuthFlow`, exact callback validation, and the Supabase token endpoint. Store `{ accessToken, refreshToken, expiresAt }` under one private key in `chrome.storage.local`; never return refresh token from a message handler.

- [ ] **Step 5: Implement refresh and logout**

Refresh once when within 60 seconds of expiry, serialize concurrent refreshes, rotate both tokens, revoke on logout when possible, and clear local auth even if network revocation fails.

- [ ] **Step 6: Run tests and commit**

Run: `node --test extension/tests/pkce.test.mjs extension/tests/auth-session.test.mjs`  
Expected: PASS.

```powershell
git add extension/manifest.json extension/auth extension/tests
git commit -m "feat: authenticate extension with PKCE"
```

### Task 2: Authenticated Background API Client

**Files:**
- Modify: `extension/background.js`
- Create: `extension/api/client.mjs`
- Create: `extension/api/config.mjs`
- Create: `extension/tests/api-client.test.mjs`
- Modify: `extension/tests/extension-contract.test.mjs`

**Interfaces:**
- Consumes: `getAccessToken()`, production `VISCUE_WEB_URL`/`VISCUE_API_URL` build constants.
- Produces: message actions `auth-sign-in`, `auth-sign-out`, `account-get`, `billing-open`, `compile`, `handoff-receipt`, and `health`.

- [ ] **Step 1: Write failing network-boundary tests**

Assert no `test_local_key_88`, no client-set plan header/body, authenticated Bearer header, one refresh/retry after 401, no retry on 429, exact allowed API origin, JSON timeout/size handling, and refresh token never included in message responses.

- [ ] **Step 2: Run and verify red**

Run: `node --test extension/tests/api-client.test.mjs extension/tests/extension-contract.test.mjs`  
Expected: FAIL against the current hardcoded local API and test bearer.

- [ ] **Step 3: Implement the isolated API client**

Allow only relative paths joined to the compile-time HTTPS API origin. Add bearer access token, `x-viscue-request-id`, timeouts, safe JSON parsing, and stable error codes. Never log bodies or authorization headers.

- [ ] **Step 4: Replace background message handlers**

Derive compile profile from server account state; do not forward `message.payload.profile.plan`. `Start Viscue` signs in when no session exists, otherwise opens the workspace. `billing-open` opens `${webUrl}/account#plans`.

- [ ] **Step 5: Run tests and commit**

Run: `node --test extension/tests/api-client.test.mjs extension/tests/extension-contract.test.mjs`  
Expected: PASS.

```powershell
git add extension/background.js extension/api extension/tests
git commit -m "feat: connect extension to authenticated API"
```

### Task 3: Replace Fake Popup Account and Plan Controls

**Files:**
- Modify: `extension/src/popup.jsx`
- Modify: `extension/src/popup.css`
- Create: `extension/src/accountModel.mjs`
- Create: `extension/tests/account-model.test.mjs`
- Create: `extension/tests/popup-account-contract.test.mjs`

**Interfaces:**
- Consumes: `account-get`, `auth-sign-in`, `auth-sign-out`, and `billing-open` background messages.
- Produces: loading, signed-out, authenticated, exhausted, offline, and error popup states.

- [ ] **Step 1: Write failing model and source-contract tests**

Assert exact plan labels/prices/allowances; remaining uses server values; reset renders UTC; fake email and `pickPlan` are absent; Plus/Pro buttons open billing rather than mutate storage; local auto-submit setting remains local.

- [ ] **Step 2: Run and verify red**

Run: `node --test extension/tests/account-model.test.mjs extension/tests/popup-account-contract.test.mjs`  
Expected: FAIL because popup currently trusts local fake plan/email data.

- [ ] **Step 3: Implement pure account view model**

```js
export function accountView(summary) {
  if (!summary) return { state: 'signed-out' }
  return {
    state: summary.remaining === 0 ? 'exhausted' : 'ready',
    email: summary.email,
    plan: summary.plan,
    count: `${summary.remaining}/${summary.allowance}`,
    resetsAt: new Date(summary.resetsAt).toISOString(),
  }
}
```

- [ ] **Step 4: Wire popup states and onboarding start**

After onboarding, Start invokes `auth-sign-in`; on success it opens the workspace. Existing users see real account data. Offline failures show retry and keep project access, but compile remains unavailable until authenticated.

- [ ] **Step 5: Run popup and onboarding tests**

Run: `node --test extension/tests/account-model.test.mjs extension/tests/popup-account-contract.test.mjs extension/tests/onboarding-model.test.mjs`  
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add extension/src/popup.jsx extension/src/popup.css extension/src/accountModel.mjs extension/tests
git commit -m "feat: show server-backed account and cue allowance"
```

### Task 4: Workspace Quota and Local-Only Compile Integration

**Files:**
- Modify: `extension/src/App.jsx`
- Modify: `extension/src/utils/vicsuc.js`
- Modify: `extension/src/components/dialogs/Dialogs.jsx`
- Create: `extension/tests/online-compile.test.mjs`
- Modify: `extension/tests/vicsuc-utils.test.mjs`

**Interfaces:**
- Consumes: bounded `buildTransientMedia`, authenticated compile response and stable API errors.
- Produces: online compile UX without cloud persistence or client-selected plan.

- [ ] **Step 1: Write failing integration contracts**

Assert build request omits `profile.plan`, original video data, local-only graph persistence, and nonintentional media. Assert 429 quota opens account plans, network failure preserves graph, success refreshes usage, and failure does not locally decrement cues.

- [ ] **Step 2: Run and verify red**

Run: `node --test extension/tests/online-compile.test.mjs extension/tests/vicsuc-utils.test.mjs`  
Expected: FAIL.

- [ ] **Step 3: Remove client plan authority and add transient payload builder**

Keep the canvas graph in local extension state. At explicit compile time, generate bounded frames/excerpts, calculate request bytes, and send a random idempotent request ID. Do not persist the transient reduced payload after the request settles.

- [ ] **Step 4: Implement safe error/retry UI**

Show reset time on quota exhaustion, Retry-After on rate limit, sign-in action on 401, and generic compiler retry on 503. Do not surface provider/database/internal exception text.

- [ ] **Step 5: Run regression tests and commit**

Run: `node --test extension/tests/*.test.mjs`  
Expected: PASS.

```powershell
git add extension/src extension/tests
git commit -m "feat: enforce online quotas without cloud project storage"
```

### Task 5: Repository Hygiene and Deployment Configuration

**Files:**
- Modify: `.gitignore`
- Create: `.vercelignore`
- Create: `vercel.json`
- Create: `.github/workflows/ci.yml`
- Modify: `scripts/verify-package.mjs`
- Create: `scripts/tests/repository-hygiene.test.mjs`
- Create: `docs/setup/deployment.md`

**Interfaces:**
- Produces: clean GitHub source, CI gates, Vercel project rooted at `web`, and documented environment separation.

- [ ] **Step 1: Write failing repository hygiene tests**

Reject tracked ZIPs, `.env*`, credentials, `node_modules*`, `.next`, `dist`, scratch/tmp/audit output, historic production copies, source maps, localhost production URLs, and the fallback test key. Require authoritative `extension`, `local-server`, `web`, `supabase`, `gesture`, `ml`, `scripts`, and `docs` sources.

- [ ] **Step 2: Run and verify red**

Run: `node --test scripts/tests/repository-hygiene.test.mjs`  
Expected: FAIL because the initialized repository has not yet curated the application source.

- [ ] **Step 3: Curate tracked source without deleting user archives**

Expand `.gitignore` to exclude generated/archived local directories and ZIP files. Add only authoritative source paths to Git; leave ignored user archives intact on disk. Configure Vercel build root/output for `web` and exclude extension ML assets from the server bundle.

- [ ] **Step 4: Add CI**

CI runs install with frozen lockfile, Supabase local database tests, web tests/build, extension/local-server tests, package verifier, secret scan, and repository hygiene. It must not have live Dodo/AWS credentials and must use deterministic fakes.

- [ ] **Step 5: Document linking and environment scopes**

Document GitHub remote, Vercel team/project link, Supabase project ref, production/preview/development variable scopes, migrations, Google OAuth redirects, extension client registration, and rollback. Preview must use Dodo Test Mode and nonproduction Supabase credentials.

- [ ] **Step 6: Run tests and commit**

Run: `node --test scripts/tests/repository-hygiene.test.mjs`  
Run: `pnpm test`  
Run: `pnpm web:test`  
Run: `pnpm web:build`  
Expected: PASS.

```powershell
git add .gitignore .vercelignore vercel.json .github scripts docs/setup/deployment.md
git commit -m "ci: add secure repository and deployment gates"
```

### Task 6: Supabase, Vercel, Dodo, and Extension End-to-End Release

**Files:**
- Create: `docs/verification/2026-09-03-online-product.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: all prior plans and dashboard configuration.
- Produces: deployed production URL, active signed Dodo webhook, published source branch, verified extension artifact, and redacted evidence report.

- [ ] **Step 1: Establish authenticated tool access without sharing secrets**

Sign in manually to Vercel if required. Use connected Supabase/GitHub/Vercel capabilities or their authenticated CLIs. Rotate the pasted Dodo key in Dodo. Add replacement secrets directly to Vercel sensitive environment variables; never route them through chat, source, command history, or logs.

- [ ] **Step 2: Apply database and auth configuration**

Run migrations against `vqqaxhzqaehjdpoefrjc`, verify RLS/policy tests, enable confirmed email/password plus Google, configure exact site/redirect URLs, register the extension OAuth client, and save only safe IDs in documentation.

- [ ] **Step 3: Deploy a preview and run nonfinancial E2E**

Verify signup, email confirmation, Google login, logout, reset request, extension PKCE, Free 9-cue summary, concurrent quota cap, transient processing, error redaction, and zero user-content rows/log fields.

- [ ] **Step 4: Run Dodo Test Mode E2E**

Complete Plus and Pro test checkout, verify immediate 28/99 allowance, renewal/plan change, forged/duplicate/out-of-order webhook resistance, on-hold fallback, cancellation, and portal access.

- [ ] **Step 5: Deploy production and configure live billing**

Promote the verified commit, run production migrations, set narrowly scoped production secrets, update live Dodo Plus/Pro products, create the signed live webhook, and verify Dodo reports successful delivery.

- [ ] **Step 6: Build and inspect the extension artifact**

Run: `pnpm test`  
Run: `pnpm build`  
Run: `node scripts/verify-package.mjs dist/extension`  
Expected: PASS with no source maps, env files, localhost API, secret assignments, or test keys.

- [ ] **Step 7: Run production smoke tests**

Using fresh accounts, verify email and Google signup, extension connection, account page, Free cue use, a low-risk paid checkout only with explicit action-time confirmation, immediate paid allowance, sign-out/sign-in persistence, and local project preservation. Do not create a real charge merely to test if Dodo Test Mode already proves payment behavior.

- [ ] **Step 8: Record redacted evidence and rollback instructions**

The report records commit SHA, migration versions, deployment URL/ID, webhook ID/status, product IDs/prices/allowances, test names/results, and content-retention inspection. It contains no keys, user email, media, prompts, tokens, or raw payloads.

- [ ] **Step 9: Push source and commit verification report**

```powershell
git add README.md docs/verification/2026-09-03-online-product.md
git commit -m "docs: verify production account and billing flow"
git push -u origin main
```

Expected: GitHub `viscue-org/viscuefinal` contains the curated source and CI passes.

