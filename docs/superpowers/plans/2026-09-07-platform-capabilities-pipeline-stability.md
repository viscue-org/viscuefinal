# Platform Capabilities and Pipeline Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a production-tested Viscue flow that collects destination subscription capability once, enforces the lower Viscue/provider reference limit, runs the real gesture and cloud model pipelines, and completes verified destination handoff.

**Architecture:** A shared pure capability module validates destination plans and computes effective limits. The extension uses it for first-time setup and all Workspace insertion preflights; the authenticated cloud route recomputes the same limit from server-owned Viscue entitlement before the reference engine runs. Cloud failures remain cloud failures, while model-specific degradation stays inside the VICSUC gateway.

**Tech Stack:** Manifest V3, React 19, Vite 7, Node test runner, Next.js 16 App Router, Vitest, Supabase Auth/Postgres, Dodo Payments, Amazon Bedrock, ONNX Runtime Web, Playwright-backed browser automation through agent-browser.

**Spec:** `docs/superpowers/specs/2026-09-07-platform-capabilities-pipeline-stability-design.md`

## Global Constraints

- Effective reference capacity is the minimum of authenticated Viscue entitlement, selected destination-plan budget, and verified provider ceiling.
- Destination-plan metadata is self-reported and may reduce capacity; it never grants billing entitlement.
- Automatic platform-plan setup appears exactly once and remains editable in Settings.
- Required references are never silently removed; optional references trim deterministically.
- Production cloud errors never fall back automatically to localhost.
- Raw drawings survive inference failures and async results cannot create ghost operations.
- No secrets, source maps, tests, environment files, or local URLs ship in the extension distribution.
- Existing user changes in the working tree must be preserved.

---

### Task 1: Finish the diagnosed runtime and cloud-boundary repairs

**Files:**
- Modify: `extension/background.js`
- Modify: `extension/src/App.jsx`
- Modify: `gesture/runtime/annotation-policy.mjs`
- Modify: `gesture/runtime/onnx-resolver.mjs`
- Modify: `gesture/runtime/pipeline.mjs`
- Modify: `gesture/runtime/resolver.mjs`
- Modify: `gesture/shared/operation-lifecycle.mjs`
- Modify: `local-server/lib/server-app.mjs`
- Modify: `web/src/lib/supabase/server.ts`
- Modify: `web/src/app/api/account/summary/route.ts`
- Test: `extension/tests/background-security.test.mjs`
- Test: `gesture/tests/algorithm-order.test.mjs`
- Test: `gesture/tests/onnx-resolver.test.mjs`
- Test: `gesture/tests/operation-lifecycle.test.mjs`
- Test: `local-server/tests/server.test.mjs`
- Test: `web/src/lib/supabase/server.test.ts`
- Test: `web/src/app/api/compile/vicsuc/route.test.ts`

**Interfaces:**
- Consumes: `apiFetch(path, init)`, `createServerClient(request?)`, `runOnnxInference(inputs, options)`.
- Produces: no-fallback cloud compile behavior, bearer-bound Supabase client, Promise-safe gesture resolution, stroke-owned operations.

- [ ] Run `node --test extension/tests/background-security.test.mjs` and confirm quota denial fails because localhost is called.
- [ ] Change the `compile` message handler to return the `apiFetch` error directly; permit localhost only behind an explicit development-only configuration flag that defaults false.
- [ ] Run `node --test extension/tests/background-security.test.mjs` and confirm it passes.
- [ ] Run the focused gesture, server, and Supabase tests and finish only the minimal changes required for the existing regression tests.
- [ ] Commit the diagnosed boundary repairs with their tests.

### Task 2: Add the shared destination capability contract

**Files:**
- Create: `local-server/lib/platform-capabilities.mjs`
- Create: `local-server/tests/platform-capabilities.test.mjs`
- Modify: `local-server/lib/contracts.mjs`
- Modify: `local-server/lib/policy.mjs`
- Modify: `local-server/tests/policy.test.mjs`
- Modify: `extension/src/utils/vicsuc.js`
- Modify: `local-server/tests/extension-contract.test.mjs`
- Modify: `web/src/lib/compiler/payload.ts`
- Modify: `web/src/app/api/compile/vicsuc/route.ts`
- Modify: `web/src/app/api/compile/vicsuc/route.test.ts`

**Interfaces:**
- Produces: `normalizePlatformCapability(value)`, `destinationReferenceLimit(profile)`, `effectiveReferenceLimit({ viscuePlan, capability })`, and a validated `platformCapability` compile field.
- Returns: `{ limit, viscueLimit, destinationLimit, providerCeiling, constrainedBy, capability }`.

- [ ] Write table-driven failing tests with literal limits for every supported platform/plan, malformed inputs, provider clamps, and all Viscue-plan combinations.
- [ ] Run focused tests and confirm missing exports/behavior are the failures.
- [ ] Implement the frozen versioned registry and pure normalization/limit functions.
- [ ] Extend `enforceReferencePlan` to accept the effective numeric limit while retaining deterministic physical-reference grouping.
- [ ] Add `platformCapability` to the extension request builder and Zod server schema; derive the Viscue plan only from the quota reservation.
- [ ] Run focused policy, extension-contract, and route tests until green.
- [ ] Commit the capability contract and server enforcement.

### Task 3: Implement one-time plan setup and Workspace insertion limits

**Files:**
- Create: `extension/src/platformPlanModel.mjs`
- Create: `extension/tests/platform-plan-model.test.mjs`
- Modify: `extension/src/App.jsx`
- Modify: `extension/src/components/dialogs/Dialogs.jsx`
- Modify: `extension/src/styles.css`
- Modify: `extension/src/popup.jsx`
- Modify: `extension/src/popup.css`
- Modify: `extension/tests/onboarding-model.test.mjs`
- Modify: `extension/tests/workspace-chrome-model.test.mjs`

**Interfaces:**
- Consumes: capability functions from Task 2 and `account-get` server summary.
- Produces: storage keys `viscue-platform-capability-v1` and `viscue-platform-plan-setup-complete`; `preflightVisualAddition({ nodes, candidates, limit })`.

- [ ] Write failing model tests for first launch, one-time persistence, invalid stored data, later Settings edits, batch rejection, frame/parent grouping, and over-limit restored workspaces.
- [ ] Run the focused tests and confirm the missing model behavior fails.
- [ ] Implement pure storage-state and preflight decisions in `platformPlanModel.mjs`.
- [ ] Add the blocking first-Workspace dialog scoped to the detected destination and save both storage values atomically.
- [ ] Load the authenticated Viscue plan from `account-get`, never from `viscue-plan`, and calculate the effective limit with the selected destination capability.
- [ ] Call preflight before file reading, drop processing, webpage capture, current-page capture, and derived-frame insertion; reject oversized batches atomically with actionable copy.
- [ ] Add the editable AI-platform plan control to Settings without resetting the one-time completion key.
- [ ] Pass the normalized capability profile to compile and expose selected/trimmed/effective-limit information in review.
- [ ] Run focused extension tests until green.
- [ ] Commit onboarding and Workspace enforcement.

### Task 4: Remove the History cleaner control

**Files:**
- Modify: `extension/src/components/workspace/WorkspaceChrome.mjs`
- Modify: `extension/src/components/workspace/WorkspaceChrome.css`
- Modify: `extension/src/App.jsx`
- Modify: `extension/tests/workspace-chrome-render.test.mjs`

**Interfaces:**
- Produces: History bottom bar with Import and Close only; per-entry Restore/Export/Delete and retention remain.

- [ ] Change the existing render test so it expects no broom/clear-all control while still exercising Import, Restore, Export, Delete, retention, and Close.
- [ ] Run the focused test and confirm it fails against the current broom button.
- [ ] Remove the button, icon import, unused prop, and App wiring; clean only now-unused CSS.
- [ ] Run History model/render tests until green.
- [ ] Commit the History cleanup.

### Task 5: Validate prompt/reference sensitivity and model routing

**Files:**
- Create: `local-server/tests/pipeline-sensitivity.test.mjs`
- Modify: `local-server/tests/pipeline.test.mjs`
- Modify: `scripts/test-ai.mjs`
- Modify: `scripts/test-nova.mjs`
- Modify: `scripts/test-gesture-pipeline-e2e.mjs`
- Modify: `docs/verification/2026-09-06-runtime-audit.md`

**Interfaces:**
- Consumes: `runPipeline(payload, gateways)`, real configured Bedrock environment, ONNX model artifacts.
- Produces: deterministic sensitivity assertions and a redacted provider verification report.

- [ ] Write failing tests proving different prompts with the same references alter the compiled intent, different references with the same prompt alter evidence/selection, trimmed references never reappear, and protected facts remain exact.
- [ ] Run the focused tests and confirm each intended mutation is caught.
- [ ] Make the smallest pipeline corrections required by the failures.
- [ ] Run the real ONNX integration and configured Qwen/Nova Pro/Nova Lite/Titan/wording-model smoke scripts; record redacted model IDs, result states, and failures.
- [ ] Update the runtime audit with exact commands and results.
- [ ] Commit sensitivity coverage and verification evidence.

### Task 6: Verify the complete product and distribution

**Files:**
- Modify generated output under `dist/` only through `pnpm build`.
- Modify: `docs/verification/2026-09-07-release-verification.md`

**Interfaces:**
- Produces: a package-verifier-approved extension artifact and end-to-end evidence matrix.

- [ ] Run focused tests for every changed module.
- [ ] Run `pnpm test`, `pnpm web:test`, and `pnpm test:ml` with zero failures.
- [ ] Run `pnpm build`, `pnpm web:build`, and `node scripts/verify-package.mjs dist/extension`.
- [ ] Start the Vite preview and Next.js server, then use agent-browser to check meaningful content, no error overlay, no blank page, and no console errors.
- [ ] Exercise first setup, subsequent launch, Settings edit, all Workspace actions, exact/over-limit additions, History operations, reference review, compile error states, and successful handoff where the available accounts permit.
- [ ] Write the verification matrix, explicitly marking any third-party-account surface not exercised.
- [ ] Commit the verified distribution and report.

### Task 7: Synchronize configured production targets

**Files:**
- Modify only configuration or migrations proven necessary by deployment checks.

**Interfaces:**
- Produces: pushed GitHub branch, verified Vercel production artifact, verified Supabase/Dodo state, and exact deployment status.

- [ ] Inspect Git remote, Vercel linkage, Supabase linkage/migration list, Dodo environment names, and extension distribution configuration without printing secret values.
- [ ] Run Supabase changelog/docs checks, advisors, and read-only/test queries; apply no migration unless implementation requires one.
- [ ] Compare required environment variable names across local, Vercel, Supabase, and Dodo; correct only confirmed mismatches.
- [ ] Push the completed branch to GitHub.
- [ ] Create a Vercel preview, run smoke checks, and promote the same verified artifact to production.
- [ ] Validate Dodo checkout, portal, and signed webhook paths without changing products unless a mismatch is proven.
- [ ] Inspect production errors and record URL, commit, status, framework, build duration, and observability result.
- [ ] Report every target as synchronized, unchanged/not applicable, or blocked with evidence.
