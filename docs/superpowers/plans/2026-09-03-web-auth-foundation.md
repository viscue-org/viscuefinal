# Viscue Web and Authentication Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a Vercel-hosted Next.js application with verified email/password and Google authentication plus a secure OAuth 2.1 PKCE authorization surface for the Chrome extension.

**Architecture:** A focused `web/` Next.js App Router application uses Supabase SSR for browser sessions and Supabase OAuth 2.1 Server for extension sessions. Authentication state is server-validated; secrets stay in Vercel and no user project content enters the web application.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase Auth/Postgres, `@supabase/ssr`, `@supabase/supabase-js`, Zod, Vitest, Vercel

**Spec:** `docs/superpowers/specs/2026-09-03-online-auth-billing-quota-design.md`

## Global Constraints

- User projects, media, annotations, prompts, and results remain in Chrome local storage.
- Free is 9 cues/day; Plus is 28 cues/day at $4.90/month; Pro is 99 cues/day at $9/month.
- Daily reset is 00:00 UTC.
- Email/password requires email verification; Google sign-in is enabled.
- The extension uses Authorization Code with PKCE; no secret is embedded in the extension.
- Never commit `.env*`, API keys, service-role keys, OAuth secrets, or generated source maps.
- Production routes must not contain localhost fallbacks or test bearer keys.

---

### Task 1: Repository Baseline and Web Application Shell

**Files:**
- Modify: `.gitignore`
- Modify: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/next.config.ts`
- Create: `web/src/app/layout.tsx`
- Create: `web/src/app/page.tsx`
- Create: `web/src/app/privacy/page.tsx`
- Create: `web/src/app/terms/page.tsx`
- Create: `web/src/app/globals.css`
- Create: `web/src/app/page.test.tsx`
- Create: `web/vitest.config.ts`
- Create: `web/vitest.setup.ts`

**Interfaces:**
- Consumes: existing root Vite extension build and `pnpm-lock.yaml`.
- Produces: `pnpm --dir web test`, `pnpm --dir web build`, and a deployable `web/` project.

- [ ] **Step 1: Write the failing home-page test**

```tsx
import { render, screen } from '@testing-library/react'
import Home from './page'

it('presents Viscue without claiming cloud project storage', () => {
  render(<Home />)
  expect(screen.getByRole('heading', { name: /make your intent visible/i })).toBeVisible()
  expect(screen.getByText(/projects stay on this device/i)).toBeVisible()
})
```

- [ ] **Step 2: Run the focused test and verify red**

Run: `pnpm --dir web test -- src/app/page.test.tsx`  
Expected: FAIL because the web package and page do not exist.

- [ ] **Step 3: Create the workspace and minimal accessible application shell**

Use `pnpm-workspace.yaml`:

```yaml
packages:
  - web
```

Add root scripts `web:dev`, `web:test`, and `web:build`. Configure `web/package.json` with Next 16/React 19, Supabase, Zod, Vitest, jsdom, and Testing Library. The home page must contain links to `/signup`, `/login`, `/account`, `/privacy`, and `/terms`, plus the exact local-data copy asserted above. Privacy copy must distinguish local persistence from transient Bedrock processing and list the minimal account/billing/usage records stored online.

- [ ] **Step 4: Harden the Next.js response headers**

Configure `next.config.ts` headers for `Content-Security-Policy`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `Permissions-Policy`, and `frame-ancestors 'none'`. Permit only self, Supabase Auth HTTPS, and Dodo checkout navigation; do not add `unsafe-eval`.

- [ ] **Step 5: Run tests and production build**

Run: `pnpm install`  
Run: `pnpm --dir web test -- src/app/page.test.tsx`  
Run: `pnpm --dir web build`  
Expected: all PASS and a successful Next.js production build.

- [ ] **Step 6: Commit**

```powershell
git add .gitignore package.json pnpm-workspace.yaml pnpm-lock.yaml web
git commit -m "feat: scaffold Viscue account web app"
```

### Task 2: Validated Environment and Supabase SSR Clients

**Files:**
- Create: `web/.env.example`
- Create: `web/src/lib/env.ts`
- Create: `web/src/lib/env.test.ts`
- Create: `web/src/lib/supabase/browser.ts`
- Create: `web/src/lib/supabase/server.ts`
- Create: `web/src/lib/supabase/admin.ts`
- Create: `web/src/lib/auth/require-user.ts`
- Create: `web/src/lib/auth/require-user.test.ts`
- Create: `web/src/proxy.ts`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`.
- Produces: `publicEnv`, `serverEnv`, `createBrowserClient()`, `createServerClient()`, `createAdminClient()`, and `requireUser()`.

- [ ] **Step 1: Write failing environment and authorization tests**

```ts
it('rejects a service role key from public configuration', () => {
  expect(() => parsePublicEnv({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'service_role.secret' })).toThrow()
})

it('returns 401 when Supabase has no verified user', async () => {
  await expect(requireUser({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } } as never))
    .rejects.toMatchObject({ status: 401 })
})
```

- [ ] **Step 2: Run tests and verify red**

Run: `pnpm --dir web test -- src/lib/env.test.ts src/lib/auth/require-user.test.ts`  
Expected: FAIL because modules are absent.

- [ ] **Step 3: Implement strict environment parsing**

Use separate Zod schemas. `serverEnv` may be imported only by files beginning with `import 'server-only'`. `.env.example` contains empty values only:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 4: Implement Supabase clients and `requireUser`**

`requireUser` must call `auth.getUser()`, never trust `getSession()` alone, require a UUID `user.id`, and return only `{ id, email }`. The admin client must set `persistSession: false` and `autoRefreshToken: false`.

- [ ] **Step 5: Add session-refresh proxy**

Use Next.js 16 `proxy.ts` to refresh Supabase cookies. Match application routes only; exclude `_next/static`, `_next/image`, icons, and public assets. Do not authorize inside proxy—protected server components and handlers still call `requireUser()`.

- [ ] **Step 6: Run focused and full web tests**

Run: `pnpm --dir web test -- src/lib/env.test.ts src/lib/auth/require-user.test.ts`  
Run: `pnpm --dir web test`  
Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add web/.env.example web/src/lib web/src/proxy.ts
git commit -m "feat: add validated Supabase server sessions"
```

### Task 3: Email Verification, Password Reset, and Google Sign-In

**Files:**
- Create: `web/src/app/(auth)/login/page.tsx`
- Create: `web/src/app/(auth)/signup/page.tsx`
- Create: `web/src/app/(auth)/verify/page.tsx`
- Create: `web/src/app/(auth)/forgot-password/page.tsx`
- Create: `web/src/app/(auth)/update-password/page.tsx`
- Create: `web/src/app/auth/callback/route.ts`
- Create: `web/src/features/auth/actions.ts`
- Create: `web/src/features/auth/safe-redirect.ts`
- Create: `web/src/features/auth/safe-redirect.test.ts`
- Create: `web/src/features/auth/auth-form.test.tsx`

**Interfaces:**
- Consumes: Supabase server client and `NEXT_PUBLIC_SITE_URL`.
- Produces: `signUpWithPassword`, `signInWithPassword`, `signInWithGoogle`, `requestPasswordReset`, `updatePassword`, and `safeRedirectPath`.

- [ ] **Step 1: Write failing redirect and anti-enumeration tests**

```ts
expect(safeRedirectPath('https://evil.example/steal')).toBe('/account')
expect(safeRedirectPath('/connect?client_id=viscue-extension')).toBe('/connect?client_id=viscue-extension')
```

Render signup and forgot-password forms and assert both success states use generic copy that does not disclose whether an email exists.

- [ ] **Step 2: Run focused tests and verify red**

Run: `pnpm --dir web test -- src/features/auth`  
Expected: FAIL because the feature is absent.

- [ ] **Step 3: Implement server actions with validated inputs**

Use Zod email validation, a minimum 12-character password, generic failure copy, and `emailRedirectTo: ${siteUrl}/auth/callback?next=/account`. Do not echo Supabase internal messages to the browser.

- [ ] **Step 4: Implement Google OAuth and callback**

Call `signInWithOAuth({ provider: 'google', options: { redirectTo } })`. In the callback, validate `next` with `safeRedirectPath`, exchange the code once, rotate cookies, and redirect to a generic `/login?error=callback` on failure.

- [ ] **Step 5: Implement accessible auth pages**

Every field has a label, browser autocomplete, pending/disabled state, generic live-region error, and links between signup/login/reset. The verify page tells users to check email without reflecting the submitted address.

- [ ] **Step 6: Run tests and build**

Run: `pnpm --dir web test -- src/features/auth`  
Run: `pnpm --dir web build`  
Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add web/src/app web/src/features/auth
git commit -m "feat: add verified email and Google authentication"
```

### Task 4: Extension OAuth Authorization Surface

**Files:**
- Create: `web/src/app/connect/page.tsx`
- Create: `web/src/features/connect/consent-card.tsx`
- Create: `web/src/features/connect/consent-card.test.tsx`
- Create: `web/src/features/connect/authorize.ts`
- Create: `web/src/features/connect/authorize.test.ts`
- Create: `docs/setup/supabase-auth.md`

**Interfaces:**
- Consumes: Supabase OAuth authorization request parameters and authenticated website user.
- Produces: a consent UI that approves/denies only the registered Viscue extension client and preserves PKCE/state parameters.

- [ ] **Step 1: Write failing allowlist tests**

```ts
expect(validateAuthorizationRequest({ client_id: 'unknown', redirect_uri: 'https://evil.example' })).toEqual({ ok: false })
expect(validateAuthorizationRequest(validRegisteredRequest)).toMatchObject({ ok: true })
```

- [ ] **Step 2: Run the focused tests and verify red**

Run: `pnpm --dir web test -- src/features/connect`  
Expected: FAIL because connect modules do not exist.

- [ ] **Step 3: Implement deny-by-default authorization validation**

Require the configured extension OAuth client ID, exact Chromium callback redirect, `response_type=code`, PKCE method `S256`, a non-empty challenge, and a random state of at least 128 bits. Reject extra redirect origins.

- [ ] **Step 4: Implement consent and authentication continuation**

Unauthenticated users are redirected to `/login?next=<encoded local connect path>`. Authenticated users see the Viscue client name and requested scopes (`openid email profile`). Approval posts to Supabase's documented authorization endpoint; denial returns the standard OAuth error without exposing a session.

- [ ] **Step 5: Document exact Supabase dashboard configuration**

Document enabling email confirmations, Google provider, OAuth 2.1 Server, the `/connect` authorization path, exact production/localhost redirect allowlists, registered extension client, refresh-token rotation, and removal of wildcard redirects.

- [ ] **Step 6: Run tests and build**

Run: `pnpm --dir web test -- src/features/connect`  
Run: `pnpm --dir web build`  
Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add web/src/app/connect web/src/features/connect docs/setup/supabase-auth.md
git commit -m "feat: add extension OAuth consent flow"
```

### Task 5: Auth Security Verification

**Files:**
- Create: `web/src/security/no-secrets.test.ts`
- Create: `web/src/security/headers.test.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: built web output and repository tree.
- Produces: automated evidence that auth pages, headers, and bundles do not expose secrets.

- [ ] **Step 1: Write failing secret and header tests**

Scan tracked source and `.next/static` for `service_role`, pasted/test bearer patterns, `DODO_PAYMENTS_API_KEY`, and `AWS_SECRET_ACCESS_KEY`. Fetch a locally started build and assert CSP, referrer, nosniff, and frame protection headers.

- [ ] **Step 2: Run tests and verify red before wiring the checks**

Run: `pnpm --dir web test -- src/security`  
Expected: FAIL until scanners and header fixtures are complete.

- [ ] **Step 3: Complete scanners and setup documentation**

README must explain `pnpm install`, `pnpm web:dev`, environment pull without committing `.env.local`, and the requirement to rotate the exposed Dodo key.

- [ ] **Step 4: Run the auth foundation gate**

Run: `pnpm --dir web test`  
Run: `pnpm --dir web build`  
Run: `git grep -n -E "test_local_key_88|DODO_PAYMENTS_API_KEY=|SUPABASE_SERVICE_ROLE_KEY=" -- ':!docs/**'`  
Expected: tests/build PASS; grep returns no tracked secret assignments.

- [ ] **Step 5: Commit**

```powershell
git add web/src/security README.md
git commit -m "test: verify web authentication security"
```
