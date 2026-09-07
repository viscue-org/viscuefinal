# AI, Text-Only Cue, Whole-Image Linking, and Auto-Close Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore working AI compilation in the installed extension, allow text-only flows, add an explicit whole-image-to-point gesture, and close Viscue only after a verified successful handoff.

**Architecture:** Keep production compilation server-owned through the authenticated web API, while verifying its deployed model configuration and preserving deterministic fallback. Move UI eligibility and close decisions into small pure modules so tests cover the behavior without a browser. Extend the existing annotation gesture rather than introducing a second connection system.

**Tech Stack:** React 19, XYFlow, Chrome Manifest V3, Node test runner, Next.js/Vercel, AWS Bedrock.

**Spec:** User-approved design in the 2026-09-08 Codex task.

## Global Constraints

- Never expose AWS or Viscue secrets in client code, logs, commits, or test output.
- Keep failures recoverable: Viscue remains open when compile, attachment, prompt verification, submission, or receipt caching fails.
- Text-only Cue must require meaningful text but zero physical references.
- Whole-image selection must be explicit and visually apparent.
- Existing point, area, draw, erase, motion, and handoff behavior must remain compatible.

---

### Task 1: Restore and verify AI compilation

**Files:**
- Modify if required: `web/src/lib/compiler/run.mjs`
- Modify if required: `local-server/lib/contracts.mjs`
- Modify if required: `extension/background.js`
- Modify: `.vercelignore`
- Test: `local-server/tests/bedrock.test.mjs`
- Test: `web/src/app/api/compile/vicsuc/route.test.ts`
- Test: `web/src/lib/compiler/deployment-boundary.test.ts`

**Interfaces:**
- Consumes: server-only environment variables and `runConfiguredPipeline(payload, env)`.
- Produces: authenticated `/api/compile/vicsuc` responses with working Qwen/Nova/Mistral routes and deterministic fallback.

- [x] Inspect the linked Vercel project’s environment variable names and live deployment logs without printing values.
- [x] Run the local AI smoke test against `.viscue-local.env` and capture only provider/status metadata.
- [x] Add a failing regression test for any confirmed routing/configuration defect.
- [x] Implement the smallest server-side correction; do not move credentials into the extension.
- [x] Run focused Bedrock and web route tests, then deploy the corrected web application and verify the live endpoint.

### Task 2: Permit text-only Cue flows

**Files:**
- Create: `extension/src/utils/cueEligibility.mjs`
- Modify: `extension/src/App.jsx`
- Modify: `extension/src/components/dialogs/Dialogs.jsx`
- Test: `extension/tests/cue-eligibility.test.mjs`

**Interfaces:**
- Consumes: workspace nodes and edges.
- Produces: `validateCueEligibility(nodes, edges)` returning `{ ok: true }` or `{ ok: false, error: string }`.

- [x] Write a failing test showing one non-empty text node is valid with no asset.
- [x] Write failing tests showing an empty workspace and empty text note are invalid.
- [x] Implement `validateCueEligibility` and replace the hard-coded asset gate in `openSend`.
- [x] Update final-review copy so zero attachments is described as a text-only handoff.
- [x] Run the focused eligibility and dialog render tests.

### Task 3: Add whole-image-to-point annotation

**Files:**
- Create: `extension/src/utils/annotationTargets.mjs`
- Modify: `extension/src/components/workspace/WorkspaceChrome.mjs`
- Modify: `extension/src/components/workspace/workspaceChromeModel.mjs`
- Modify: `extension/src/components/nodes/AssetNode.jsx`
- Modify: `extension/src/App.jsx`
- Modify: `extension/src/styles.css`
- Test: `extension/tests/annotation-targets.test.mjs`
- Test: `extension/tests/workspace-chrome-render.test.mjs`

**Interfaces:**
- Consumes: annotation tool value `whole`, source node id, destination screen point, and current nodes.
- Produces: source anchor `{ x: 0.5, y: 0.5, isWholeAsset: true }` and a precise destination anchor when dropped on another asset.

- [x] Write failing tests for the new Whole image toolbar option and target resolution.
- [x] Add `whole` to the annotation toolbar and selected-tool model.
- [x] Start whole-image linking from any point on the selected image while storing the source as a whole-asset anchor.
- [x] Reuse the existing note/cross-asset completion path, with destination coordinates clamped to `[0,1]`.
- [x] Add clear selected-source and destination-hover styling and run focused tests.

### Task 4: Close Viscue after verified handoff

**Files:**
- Create: `extension/src/utils/handoffCompletion.mjs`
- Modify: `extension/src/App.jsx`
- Modify: `extension/background.js`
- Test: `extension/tests/handoff-completion.test.mjs`

**Interfaces:**
- Consumes: handoff result and receipt-cache result.
- Produces: `shouldCloseWorkspace(handoff, receipt)` and a `close-workspace` runtime message that removes only the sender workspace tab.

- [x] Write failing tests that close only when handoff and receipt are both verified.
- [x] Implement the pure decision helper.
- [x] Add a background handler that verifies the sender URL is the extension workspace before removing that exact tab.
- [x] After success, focus the destination tab, request workspace closure, and leave it open on every failure.
- [x] Run focused completion and handoff tests.

### Task 5: Full verification and delivery

**Files:**
- Modify: `docs/superpowers/plans/2026-09-08-ai-text-only-whole-image-autoclose.md`

**Interfaces:**
- Consumes: all completed tasks.
- Produces: tested extension bundle, passing web build, committed branch, pushed online source.

- [x] Run `pnpm test`.
- [x] Run `pnpm test:ml`.
- [x] Run `pnpm web:test` and `pnpm web:build`.
- [x] Run `pnpm build` and `node scripts/verify-package.mjs dist/extension`.
- [x] Inspect `git diff`, confirm no credentials or unrelated files, commit, push, and report deployment status.
