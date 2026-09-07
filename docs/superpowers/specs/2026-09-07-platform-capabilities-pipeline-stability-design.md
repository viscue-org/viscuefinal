# Viscue Platform Capabilities and Pipeline Stability Design

**Date:** 2026-09-07  
**Status:** Approved for implementation  
**Scope:** Chrome extension Workspace, gesture runtime, reference selection, cloud compiler, model verification, production packaging, and configured deployments

## Objective

Make Viscue work as one reliable product from the floating button through final AI-chat handoff. First-time users identify the subscription tier of the detected destination AI platform. Viscue combines that self-reported capability with the authenticated Viscue entitlement, enforces the effective visual-reference limit consistently, compiles the user's prompt and selected references through the real model pipeline, and attaches the verified output to the original destination conversation.

Completion requires evidence across the entire path. Passing isolated unit tests or rendering a Workspace shell is not sufficient.

## Confirmed Root Causes

The current failure is produced by several independent boundary defects:

1. The extension catches every cloud compile error, including authentication and quota denial, and silently retries against the local compiler. This bypasses server policy and makes failure behavior depend on whether a localhost service happens to be running.
2. Gesture inference is asynchronous, but parts of the runtime previously treated the resolution Promise as a completed value. A drawing could fail before it was persisted or leave an operation detached from its source stroke.
3. ONNX inference previously used a hardcoded acceptance threshold instead of the shipped calibration and did not reject nonfinite or wrong-length logits.
4. The cloud compile route previously did not execute the complete VICSUC pipeline, and extension bearer identity was not consistently propagated to Supabase database calls.
5. The Workspace reads a locally editable `viscue-plan`, while the server derives paid entitlement independently. The two values can disagree, and there is no separate destination-platform capability model.
6. Reference policy is enforced late during compilation but not at every Workspace insertion boundary. File picker, drag/drop, webpage capture, page capture, restore, and derived-reference scenarios can therefore create inconsistent counts.
7. The History surface includes a broom/cleaner control that is not part of the desired final action set.
8. Existing unit suites do not prove that prompt wording and reference choices materially affect the real generated output or that browser handoff succeeds on supported destination adapters.

## Capability Model

### Separate authorities

Viscue keeps two independent concepts:

- **Viscue entitlement:** server-authoritative and derived from Supabase/Dodo subscription state. The extension cannot increase it.
- **Destination capability:** user-reported AI-platform subscription metadata. It may reduce what Viscue sends but can never grant more than the authenticated Viscue entitlement.

The effective physical-reference limit is:

```text
minimum(
  authenticated Viscue reference allowance,
  selected destination-plan budget,
  verified provider hard ceiling
)
```

If a provider does not publish a precise hard ceiling, Viscue uses a conservative versioned product ceiling and labels its provenance as estimated. A missing or invalid capability profile fails to the lowest safe limit.

### Versioned registry

A shared, pure registry module defines:

- supported platform IDs and display names;
- allowed subscription-plan IDs per platform;
- conservative visual-reference budget per plan;
- verified hard ceiling when one is documented;
- supported reference kinds and relevant media constraints;
- registry version, source date, source URL, and confidence (`verified` or `estimated`).

The extension and cloud compiler import the same decision functions. Client output is used for immediate UX; server output is authoritative for compilation.

### Persistence

Chrome local storage records a schema-validated profile such as:

```json
{
  "schemaVersion": 1,
  "registryVersion": "2026-09-07",
  "platform": "chatgpt",
  "plan": "plus",
  "selectedAt": "2026-09-07T00:00:00.000Z"
}
```

A distinct completion key makes automatic setup one-time only. The user can revise the profile from Settings without resetting onboarding. Unknown future values normalize safely rather than crashing or granting capacity.

## First-Time Flow

1. The content-script floating button sends the live tab identity and detected platform to the background worker.
2. Existing authentication behavior remains intact. A real session is established before protected cloud work.
3. On the first Workspace open, a blocking platform-plan setup dialog appears before references can be added.
4. The dialog is pre-scoped to the detected platform and displays its current plan choices, the resulting Viscue visual limit, and a short explanation that the answer can be changed later.
5. Saving validates the platform/plan pair, writes the profile and one-time completion key atomically, and unlocks the Workspace.
6. Subsequent floating-button launches do not ask again. Settings exposes a deliberate “AI platform plan” editor.
7. When the user later opens Viscue from another supported platform, Viscue does not repeat onboarding. It applies the lowest safe capability for that destination until the user updates the destination plan in Settings.

This sequence prevents repeated prompts while avoiding an optimistic assumption for a platform the user never configured.

## Workspace Reference Enforcement

Every visual insertion path calls one shared preflight function before expensive file reads or capture work:

- image, video, and document file selection;
- drag/drop batches;
- webpage URL capture;
- current-page capture;
- extracted video frames;
- imported or restored snapshots;
- future programmatic insertion paths.

Physical-reference counting reuses the compiler policy: an attached derived frame counts with its present parent video; detached frames count independently. Text notes never consume a visual slot.

Multi-file additions are atomic. If the whole batch does not fit, no file from that batch is added. The error states current count, effective limit, limiting authority, and how to change the platform plan or Viscue plan.

Imported or restored workspaces are never destroyed because their count exceeds a new limit. They open readably, prevent additional visual insertion, and show an over-limit state. Compilation continues to reserve required references first, deterministically trims optional references, and blocks before any provider call if required physical references exceed the effective limit.

The reference review surface shows:

- selected, required, optional, and trimmed references;
- the effective limit and which authority constrained it;
- deterministic selection order;
- why each required reference is required;
- a clear blocking message before model execution.

## Compilation and Output Pipeline

The only production compile path is the authenticated Vercel API:

```text
Workspace graph + reduced media + capability profile
  -> authenticated HTTPS request
  -> bounded schema validation
  -> Supabase cue reservation
  -> effective reference policy
  -> Qwen still-image analysis
  -> Nova image/video fallback
  -> Titan relevance scoring
  -> deterministic canonical brief
  -> optional Mistral wording compile
  -> protected-fact verification
  -> quota commit/release
  -> attachment manifest + prompt hash
  -> destination fingerprint verification
  -> ordered attachment
  -> prompt insertion and verification
  -> optional submit
  -> receipt commit
```

Cloud failures never fall back automatically to an unmetered local service. Authentication and quota errors are returned unchanged. Retryable provider failures degrade only inside the model gateway according to the existing Qwen/Nova/Titan/Mistral rules. The local compiler remains an explicit development mode and requires an intentional configuration switch plus its own API key.

Each boundary returns a stable, redacted error code. Quota reservations commit only after successful compilation and release exactly once after controlled failure. Unknown commit state is retried by reservation ID rather than creating another reservation.

The canonical brief remains authoritative for filenames, user text, coordinates, regions, timestamps, roles, and relationships. Model claims remain confidence-scored evidence. Final wording is accepted only when protected facts survive verification and trimmed references do not reappear.

## Gesture Runtime

Raw drawing is persisted synchronously before ONNX inference starts. Async inference enriches only the still-existing matching stroke. Erase, undo, reset, restore, and late completion cannot create ghost operations.

The ONNX resolver:

- loads the shipped calibration;
- uses the calibrated acceptance and abstention thresholds;
- validates exact logit length and finiteness;
- converts thrown/rejected inference into a serializable abstention;
- preserves the raw drawing when interpretation fails;
- keeps model input ID-free and bounded.

Model verification includes a real ONNX session smoke test and deterministic gesture fixtures across accepted, ambiguous, malformed, async, erased, restored, and late-result cases.

## History UI

Remove the broom/cleaner button from the History bottom bar and remove the unused `onClearAll` surface wiring associated with that control. Keep import, per-entry restore/export/delete, retention configuration, and close actions. Existing stored History data is not deleted.

## Validation Strategy

### Automated regression coverage

Tests are written before each behavior change and observed failing for the intended reason. Coverage includes:

- one-time platform-plan setup and persisted reload;
- valid/invalid platform-plan pairs and safe unknown fallback;
- effective limit calculation for every Viscue/destination combination;
- every reference insertion boundary, including atomic batches;
- parent/frame physical counting and detached frames;
- over-limit import/restore preservation;
- optional trimming and required-reference blocking;
- cloud quota/auth/provider failures with no local fallback;
- authenticated bearer propagation through Supabase quota calls;
- real cloud compiler adapter execution;
- prompt/reference sensitivity and protected-fact preservation;
- History cleaner removal;
- async gesture inference and ONNX calibration;
- package and secret scans.

### Model validation

Run local ONNX integration tests plus configured Bedrock smoke tests for Qwen, Nova Pro, Nova Lite, Titan, and the configured wording model. Record model ID, region, request class, success/degraded state, latency, and redacted error. No credentials or user media enter logs.

Use a matrix containing:

- same prompt with different selected references;
- different prompts with the same references;
- required plus optional references above and below the limit;
- image, derived frame, video range, webpage capture, and document-derived visual;
- provider failure and deterministic fallback;
- prompt facts containing filenames, coordinates, timestamps, and preserve constraints.

The expected result is semantic sensitivity to changed prompt/reference evidence while authoritative protected facts remain exact.

### Browser and Workshop verification

Build and load the production extension artifact. Verify at least:

1. first floating-button launch, authentication, and one-time plan selection;
2. subsequent launch without repeat setup;
3. changing the platform plan in Settings;
4. add, annotate, text, motion, crop, extract-frame, undo, redo, theme, History, import, export, restore, delete, and clear-workspace actions;
5. under-limit, exact-limit, and over-limit additions through picker, drop, capture, and restore;
6. reference review selection and trimming;
7. complete compilation and output handoff on representative supported destinations;
8. quota exhausted, offline, model-degraded, changed-conversation, attachment failure, and prompt-verification failure states;
9. no browser console error, framework overlay, blank surface, or stuck busy state.

Where a third-party UI prevents automation or a live account is unavailable, retain adapter contract tests and report the exact unverified surface rather than claiming success.

## Deployment and Synchronization

Release only after focused tests, full root/web/ML suites, production builds, package verification, browser verification, and model smoke tests pass.

- **GitHub:** commit source, tests, design/verification evidence, lockfiles, and generated distribution artifacts intended for version control; push the release branch. Do not overwrite unrelated user changes.
- **Supabase:** apply only required schema/config changes, run RLS/security checks and advisors, and verify quota/auth functions with test queries. This design keeps destination-plan metadata local, so no database migration is required unless implementation evidence proves otherwise.
- **Vercel:** synchronize production environment names without exposing values, build a preview, run smoke tests against the preview, then promote the same verified artifact to production. Inspect post-deploy errors.
- **Dodo:** change configuration only if billing verification demonstrates a mismatch. Validate product IDs, webhook signature path, business mode, checkout, and portal behavior before any production mutation.
- **Extension distribution:** rebuild `dist`, run the package verifier, confirm manifest version and absence of secrets/source maps/test artifacts, and publish the exact tested artifact through the configured distribution channel if credentials and channel configuration are available.

Every platform is reported as deployed, unchanged/not applicable, or blocked with specific evidence. No target is claimed synchronized without a successful command or API response.

## Acceptance Criteria

1. The first floating-button Workspace access asks for the detected AI platform subscription exactly once.
2. The setting is editable later and never conflated with Viscue billing entitlement.
3. Every visual insertion path enforces the same effective physical-reference limit.
4. Server policy recomputes the limit and cannot be increased by client payloads.
5. Required references block safely and optional references trim deterministically.
6. Prompt and selected-reference changes produce the expected model/output changes without corrupting protected facts.
7. Gesture drawings survive async inference failures and no ghost operation is produced.
8. Cloud auth/quota errors never fall back to unmetered local compilation.
9. The real configured model pipeline produces a verified prompt and attachment manifest.
10. The intended destination receives all selected references, the exact verified prompt, and no automatic submission unless enabled.
11. All visible Workshop/Workspace actions pass normal and error-state checks.
12. The History cleaner button is absent while required History actions remain functional.
13. Root, web, ML, build, package, browser, model, and deployment checks have recorded evidence.
14. GitHub, Vercel, Supabase, Dodo, and distribution state are synchronized wherever configured and applicable.
