# VIS CUE System Trust and Human Validation Design

**Date:** 2026-09-08  
**Status:** Approved design, pending implementation plan  
**Scope:** Extension compilation transparency, end-to-end verification, provider checks, performance measurement, and private real-human gesture evaluation

## 1. Purpose

VIS CUE must make visual intent understandable to an AI destination without hiding uncertainty or silently replacing user-authored meaning. A successful-looking handoff is insufficient when a model stage failed, a fallback was used, or the final browser action was never verified.

This change adds an observable trust layer around the existing deterministic and learned pipeline. It does not replace the VICSUC compiler, gesture resolver, provider gateways, or destination adapters.

## 2. Governing principles

- User-authored instructions, explicit selections, geometry, and constraints remain authoritative.
- Every learned stage identifies what actually ran. A fallback is never presented as model success.
- Ordinary automated verification must not spend model quota or production Cues.
- Paid provider and authenticated production checks are explicit, bounded, and opt-in.
- Human gesture recordings remain local until the user explicitly exports a report.
- Synthetic and GPT-generated inputs remain synthetic evidence. They cannot be labelled real-human validation.
- A single-person study measures personal usability but cannot establish population-level production accuracy.
- The workspace closes only after a verified destination handoff and a cached receipt.

## 3. Current root causes

### 3.1 Stage transparency

`SendDialog` can render `review.stages`, but the active Cue path starts the animation and calls `compileAndSend` directly. Compilation and destination handoff therefore occur in one operation, so the user normally cannot inspect the stage results before sending.

Pipeline stages also lack a uniform public shape. Provider, model, duration, evidence count, warning, and fallback origin are present inconsistently. Provider exceptions are safely degraded, but their public reason is too generic to distinguish an unavailable model from malformed evidence or verification rejection.

### 3.2 Browser verification

The existing `run-human-test.mjs` opens the extension and performs a basic visual smoke sequence. It does not assert the complete selection, annotation, compilation, adapter, receipt, and automatic-close lifecycle. It intentionally leaves Chrome open and is unsuitable as a repeatable release gate.

### 3.3 Authenticated production verification

The extension already authenticates API requests through its stored API credential. There is no explicit one-shot verifier that uses a supplied test credential, confirms the production response contract, records the consumed Cue, and exits. Unauthenticated endpoint checks prove access control only, not authenticated compilation.

### 3.4 Gesture validation

The runtime has a shipped ONNX model and synthetic calibration metadata, but no real-human collection and evaluation interface. The current UI smoke script does not capture labelled gesture trials or calculate selective-classification metrics.

## 4. Architecture

The implementation adds four isolated units:

1. **Execution ledger** — a normalized, redacted stage contract produced by the compiler and shown before destination handoff.
2. **Release verifier** — deterministic browser fixtures for everyday CI plus separate opt-in live checks.
3. **Provider benchmark runner** — explicit bounded calls that report availability and warm latency without becoming part of free CI.
4. **Gesture Validation Lab** — a local extension page that collects prompted human trials, computes metrics, and exports a report.

No unit requires a new external database or telemetry service.

## 5. Two-phase Cue flow

### Phase A: prepare

1. Validate that the workspace contains actionable intent. Assets remain optional for a text-only flow.
2. Build the VICSUC request and compile it.
3. Normalize the returned stages into the public execution-ledger schema.
4. Open Final Review with selected references, trimmed references, final prompt summary, quota impact, and the complete ledger.
5. Do not attach, insert, submit, or close the workspace in this phase.

### Phase B: handoff

1. The user confirms after reviewing the ledger.
2. Attach only the references selected by the server.
3. Verify attachment readiness before inserting the prompt.
4. Submit only when automatic submission is enabled.
5. Save the verified handoff receipt.
6. Close only the VIS CUE workspace tab after both handoff verification and receipt caching succeed.

If the user cancels Final Review, the compiled result may remain in memory for that unchanged graph but is not handed off. Any graph mutation invalidates the prepared result.

## 6. Execution-ledger contract

Every stage exposed to the extension uses this redacted shape:

```json
{
  "name": "perception.asset-id",
  "role": "visual perception",
  "status": "ok",
  "provider": "aws-bedrock",
  "model": "qwen.qwen3-vl-235b-a22b",
  "duration_ms": 3720,
  "evidence_count": 4,
  "fallback": false,
  "fallback_from": null,
  "message": "4 grounded observations",
  "attempt": 1
}
```

Allowed statuses are `ok`, `degraded`, `skipped`, and `blocked`. The server may record detailed diagnostic codes internally, but the extension receives no credentials, stack traces, raw provider payloads, or sensitive user content.

The Final Review groups stages under understandable labels:

- Visual understanding — Qwen for still images; Nova Pro or Nova Lite for video and configured fallback routes.
- Relevance — Titan embedding.
- Instruction compilation — Mistral Large or deterministic canonical brief.
- Safety verification — deterministic protected-fact and cue-coverage verification.

An overall banner states one of:

- **All AI stages completed**
- **Completed with fallback**
- **Deterministic only**
- **Action required**

## 7. Error and fallback behavior

- A provider timeout, malformed evidence response, unavailable model, or rejected compiled prompt becomes a degraded ledger entry with a stable diagnostic code.
- Deterministic completion remains allowed where existing policy permits it.
- The UI never uses “AI completed” when no learned stage completed successfully.
- A blocked reference policy prevents handoff and does not consume further provider work.
- Retry is user initiated. The system does not silently repeat paid provider calls.
- Logs and exported reports contain counts, statuses, model identifiers, timings, and error codes, but not source images or user prompt text.

## 8. Browser end-to-end verification

The release verifier uses Puppeteer and a freshly built unpacked extension. It owns its temporary browser profile and always closes it in `finally`.

Deterministic fixture pages emulate the supported destination DOM contracts for ChatGPT, Gemini, Claude, Copilot, Perplexity, and Grok. These tests cover:

- Workspace launch from each destination.
- Text-only intent without an asset.
- Image selection and full-image corner annotation.
- Multiple references and server-selected attachment ordering.
- Compile review before handoff.
- Successful attachment, prompt insertion, optional submit, and receipt caching.
- Workspace automatic close only after verified completion.
- Failed upload, missing editor, changed destination, rejected prompt verification, and uncached receipt keep the workspace open.

Fixture tests prove VIS CUE adapter logic against controlled contracts; they do not prove that an external site has not changed. A separate manual live-adapter checklist remains required for release candidates.

## 9. Authenticated production smoke check

The authenticated production verifier is a separate command and never runs under `npm test`.

- It requires `VISCUE_E2E_AUTH_TOKEN` in the process environment or an explicitly selected already-authenticated extension session.
- It displays that exactly one production Cue may be consumed and requires a deliberate invocation.
- It sends one bounded text-only payload by default to minimize cost and avoid personal media.
- It validates HTTP status, execution ID, quota response, final prompt, stage schema, provider truthfulness, and absence of exposed credentials.
- It writes a redacted local report and never writes the authentication token.
- Missing authentication fails closed without making the request.

This check proves the authenticated production compiler boundary. Destination-site handoff remains a separate browser assertion because submission to a real external AI chat can create additional cost or external side effects.

## 10. Provider canaries and performance

Three verification tiers prevent accidental credit use:

1. **Contract canaries:** free deterministic provider-response fixtures on every test run.
2. **Configured local canary:** an explicit command makes one minimal request to Qwen, Nova Pro, Nova Lite, Titan, and Mistral and records success, model, response contract, and latency.
3. **Production canary:** an explicit authenticated one-Cue end-to-end compilation check.

Paid canaries are not scheduled automatically by this implementation. Scheduling requires a later explicit budget and notification decision.

The benchmark runner performs warm-up separately, then records count, failures, p50, p95, maximum duration, and fallback rate. Default repeated benchmarks use fixtures. Live repeated benchmarks require an explicit run count and print the maximum possible call count before starting.

## 11. Local Human Gesture Validation Lab

The lab is an extension-owned page using the same capture, geometry, feature, ONNX, calibration, and acceptance modules as production.

### Trial design

- The lab prompts one requested intent at a time and creates a compatible randomized canvas context.
- Intent order and context variants are randomized before the session.
- Prediction is hidden until the trial is committed, preventing correction after feedback.
- Each trial stores requested intent, predicted intent, family, accepted state, confidence, alternatives, reason, pointer type, normalized runtime features, model version, duration, and inference latency.
- Raw image contents, filenames, URLs, text notes, and external chat data are never collected.
- Unknown/OOD trials ask the participant to make an unclear, accidental, incomplete, or unsupported gesture.
- Participants can mark a trial as misunderstood before seeing the result; it is excluded with a documented reason rather than relabelled.

### Self-study preset

The default personal study contains:

- 30 production intents × 10 trials = 300 prompted trials.
- 50 unknown/OOD trials.
- Separate sessions per available pointer class, preferably mouse and trackpad.
- Breaks between blocks to reduce fatigue.

The study is resumable locally. It does not show aggregate model results until a block is complete.

### Metrics

The report contains:

- Accepted precision with a Wilson 95% confidence interval.
- Coverage and abstention rate.
- Closed-set accuracy and macro F1, clearly separated from selective precision.
- Per-intent precision, recall, support, and confusion matrix.
- OOD false-accept rate.
- Confidence calibration error and risk-coverage curve.
- Model inference p50/p95 and end-to-end resolution p50/p95.
- Counts excluded by the participant and their recorded reasons.
- Device, browser, extension version, model version, and report schema version.

The exported JSON is machine-readable and an HTML summary is human-readable. Export is an explicit local download.

### Interpretation

- One participant can establish whether the model works reliably for that participant and device.
- It cannot establish population-level accuracy or change the model status to `ProductionApproved`.
- A later population study should use at least 20–30 participants across mouse, trackpad, stylus, and touch where supported, with pre-registered gates and an untouched evaluation set.
- Synthetic and GPT-generated trials stay reported separately and cannot be mixed into real-human metrics.

## 12. Tests and release gates

Implementation follows test-driven development. Required gates are:

- Unit tests for ledger normalization, overall status, redaction, latency capture, graph invalidation, and explicit paid-check guards.
- Pipeline tests for Qwen/Nova/Titan/Mistral success, degradation, malformed output, and deterministic verification replacement.
- Gesture metric tests using fixed labelled fixtures, including Wilson interval, macro F1, OOD false accepts, ECE, and latency percentiles.
- Browser fixture E2E tests for all six adapters and the automatic-close security boundary.
- Full root tests, web tests, ML tests, extension build, web build, and production-package verification.
- One preview deployment followed by public-route, security-boundary, and error-log checks before production promotion.

A release report distinguishes `verified`, `failed`, `not run`, and `requires user-authenticated live check`. No unchecked surface is described as working.

## 13. Deliverables

- Normalized execution-ledger types and formatter.
- Two-phase compilation and handoff flow in the React extension.
- Accessible Final Review ledger UI and styles.
- Provider timing and truthful fallback metadata.
- Deterministic six-adapter browser E2E suite.
- Opt-in authenticated production smoke verifier.
- Free contract canaries and opt-in live provider benchmark.
- Local Human Gesture Validation Lab with JSON and HTML export.
- Human-study instructions and model-card template.
- Updated package scripts, documentation, verification report, and deployed production build.

## 14. Non-goals

- Automatic collection or upload of real-user gestures.
- Claiming worldwide accuracy from a self-study.
- Automatically spending production Cues in CI.
- Sending messages to real third-party AI chats during unattended tests.
- Replacing deterministic geometry or target binding with a language or vision model.
- Weakening the original accuracy, OOD, calibration, parity, or latency gates.

## 15. Definition of done

- A user sees which provider/model actually ran before authorizing destination handoff.
- Fallback and deterministic-only outcomes are unmistakable.
- Fixture E2E verifies all supported destination contracts and automatic workspace closing.
- Authenticated production verification is available but cannot run accidentally.
- Provider availability and p50/p95 measurements are reproducible and visibly separated into fixture versus live results.
- A user can complete and export a private self-study without uploading gesture data.
- Reports calculate the specified selective, OOD, calibration, and latency metrics honestly.
- All automated release gates pass, deployment is promoted, and any live checks not run are reported explicitly.
