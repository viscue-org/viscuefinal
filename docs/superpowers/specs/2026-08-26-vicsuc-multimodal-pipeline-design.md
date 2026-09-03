# VICSUC Multimodal Pipeline Design

**Date:** 2026-08-26  
**Status:** Approved in chat; written specification pending user review  
**Source specification:** `C:\Users\witne\Downloads\deep-research-report (3).md`

## Purpose

VICSUC turns user-scoped image, video, document, webpage, and canvas-reference inputs into a provenance-aware semantic graph, selects the most relevant references within the user's plan, compiles an intention-faithful prompt, and hands the references and prompt to a supported AI destination in a verified order.

The governing rule is: prefer faithful uncertainty over confident invention. User annotations and explicit constraints are authoritative. Model observations are evidence, never authority.

## Scope

This release adds the following capabilities to the active Viscue 3.2 root project:

- Plan-aware physical-reference limits.
- Composite-image detection with logical child panels.
- Still-image and region perception through Qwen3-VL on Amazon Bedrock.
- Whole-video or sampled-frame perception through Amazon Nova on Bedrock.
- A provider-neutral, commercially safe font-identification gateway.
- Semantic descriptors and graph facts with provenance and confidence.
- Multimodal relevance scoring through Titan Multimodal Embeddings.
- Stable deterministic ranking when embeddings fail.
- Model-aware Mistral prompt compilation.
- Deterministic and semantic anti-hallucination verification.
- A stage ledger with explicit degraded and blocked states.
- Correct handoff receipts so attachment state is committed only after destination confirmation.
- Automated unit, integration, failure-injection, build, and package checks.

## Explicit Exclusions

- Voice typing, dictation, messy-language rewriting, and general writing assistance.
- A general OCR pipeline over every image.
- Image generation inside Viscue.
- A cloud database, hosted multi-user account system, or vector database.
- Chrome Web Store publication. Deployment in this workspace means a verified production extension build, local compiler/font-gateway services, and a clean distributable ZIP.
- Bundling MixFont Lens weights. Their current open-weight license prohibits commercial use without written permission.
- Claiming an exact font match when only generic visual typography evidence is available.

## Existing Product Boundary

The active product is a Manifest V3 React extension and a local Node.js compiler:

- `extension/src/App.jsx` owns canvas state and builds the current graph candidate.
- `extension/background.js` proxies compile and handoff messages.
- `extension/content.js` attaches references, waits for readiness, inserts the prompt, and optionally submits.
- `local-server/server.mjs` validates the graph, optionally calls Bedrock, and provides a deterministic compiler fallback.

The current server contains an early Nova-based point inspection hook. It does not yet provide full VICSUC routing, schema validation, plan enforcement, composite handling, font identification, embedding ranking, stage receipts, or safe upload-state commits.

## Architecture

```text
User query + workspace-scoped references
                    |
                    v
          Workspace/plan validation
                    |
                    v
       Media preparation and hashing
                    |
           +--------+---------+
           |                  |
           v                  v
   Qwen still-image       Nova video
   and layout analysis    understanding
           |                  |
           +--------+---------+
                    |
          Specialist font gateway
                    |
                    v
       Provenance-aware evidence graphs
                    |
                    v
       Cross-reference graph fusion
                    |
                    v
        Titan relevance embeddings
                    |
                    v
      Plan-aware reference selection
                    |
                    v
       Deterministic canonical brief
                    |
                    v
        Mistral wording compilation
                    |
                    v
       Reverse hallucination checks
                    |
                    v
      Attach -> verify -> insert -> verify
                    |
                    v
          Commit destination receipt
```

## Component Boundaries

### Pipeline orchestrator

The local server owns orchestration. It accepts graph metadata and bounded media payloads, invokes providers, validates provider output, constructs evidence graphs, selects references, compiles the prompt, and returns the stage ledger and execution manifest.

The React application remains responsible for user-authored canvas intent and clean attachment bytes. The destination content script remains responsible for attachment and editor verification.

### Bedrock gateway

One server-only Bedrock gateway owns bearer-token and SigV4 authentication, timeouts, bounded retries, response parsing, model IDs, and safe error normalization. Credentials never enter the extension, response payloads, logs, screenshots, or packages.

Default model routes:

| Capability | Primary | Fallback |
| --- | --- | --- |
| Still-image/region/layout perception | `qwen.qwen3-vl-235b-a22b` | `amazon.nova-pro-v1:0` |
| Whole-video understanding | `amazon.nova-pro-v1:0` | `amazon.nova-lite-v1:0` |
| Large-video understanding | timestamped sampled frames through Nova Pro | sampled frames through Qwen |
| Image/text relevance | `amazon.titan-embed-image-v1` | deterministic intent score |
| Prompt wording | configured `BEDROCK_MODEL_ID` for Mistral Large 3 | deterministic canonical prompt |
| Semantic prompt verification | Nova Lite using the canonical brief and candidate prompt | deterministic verification only |

Every route is configurable through `.viscue-local.env`; defaults are non-secret and documented.

### Font gateway

Font identification is a separate HTTP boundary with this provider-neutral contract:

```json
{
  "region_id": "region_4",
  "image_base64": "...",
  "recognized_text": "SALE",
  "top_k": 5
}
```

Successful results contain ranked candidates, provider, score, family, style, weight, license category, catalog version, and the source region. The gateway never turns a candidate into an exact match without an acceptance threshold and corroborating evidence.

Provider policy:

1. Use a configured commercially licensed broad-catalog provider through `FONT_PROVIDER_URL` and `FONT_PROVIDER_API_KEY`.
2. The initial adapter targets the documented WhatFontIs API because it exposes broad free/commercial catalog matching. Commercial launch requires a commercial agreement and key from the provider.
3. A later Monotype adapter can be added behind the same contract for enterprise font licensing and delivery.
4. A self-hosted open-font matcher can be added only with project-owned or commercially permitted weights and a generated font-license manifest.
5. When no commercial font provider is configured, return `degraded` and store only generic typography attributes from Qwen, never an asserted font name.

No non-commercial model weights are included in the production artifact.

### Media preparation

Each reference receives a stable content hash, workspace ID, physical reference ID, MIME type, byte size, clean-source pointer, and optional derived-asset provenance.

- Images are resized for perception without changing the clean attachment.
- Video ranges remain authoritative in milliseconds.
- Videos within Bedrock's safe inline payload limit are sent natively to Nova.
- Larger videos are sampled into at most eight timestamped frames across the user-selected range. Existing explicitly extracted frames are preferred.
- Documents use existing page extraction for visual page analysis. Text-only documents remain context references and are not treated as visual evidence.
- Provider payloads are sent one asset at a time so the compiler request never carries every full-resolution asset at once.

### Composite detection

Qwen returns candidate panel boxes for obvious 1x2, 2x1, 2x2, and 3x3 composites. Results must pass deterministic validation:

- Two to nine panels.
- Normalized boxes are in bounds.
- Each panel has a minimum area.
- Pairwise overlap stays below the configured threshold.
- The union covers enough of the parent image to represent a real composite.

A composite consumes one physical plan slot. Each validated panel becomes a logical child reference with `PART_OF_COMPOSITE` provenance. If validation fails, the parent remains a normal single image.

## Data Model

### Intent graph

The existing canvas graph remains the authority for:

- User notes.
- Point and region annotations.
- Cross-asset relationships.
- Preserve roles.
- Video ranges.
- `FRAME_OF` and `AT_TIME` provenance.
- Motion evidence already representable by the application.

### Evidence graph

Provider observations are stored separately:

```json
{
  "id": "evidence_31",
  "asset_id": "asset_7",
  "logical_reference_id": "panel_2",
  "type": "object",
  "value": "laptop",
  "bbox": [0.12, 0.22, 0.61, 0.72],
  "time_ms": null,
  "provider": "qwen",
  "model": "qwen.qwen3-vl-235b-a22b",
  "confidence": 0.88,
  "observation_kind": "observed"
}
```

Allowed evidence types are `object`, `text_region`, `layout_block`, `font_candidate`, `color`, `scene`, `segment`, `relation`, and `composite_panel`.

`observation_kind` is `observed` or `inferred`. Inferred facts cannot override user intent or become hard prompt constraints without confirmation.

### Semantic relations

Supported evidence relations include:

- `ABOVE`, `BELOW`, `LEFT_OF`, `RIGHT_OF`, `NEAR`, `OVERLAPS`.
- `TEXT_ON`, `CONTAINS`, `PART_OF_COMPOSITE`.
- `SAME_AS_CANDIDATE` for cross-reference fusion.
- Existing authoritative `FRAME_OF`, `AT_TIME`, and `CROSS_ASSET_ANNOTATION` relations.

Spatial relations are derived deterministically from validated boxes when possible. Model-proposed semantic relations remain inferred evidence.

### Stage ledger

Every pipeline stage returns:

```json
{
  "stage": "perception.image",
  "status": "ok",
  "provider": "qwen",
  "attempts": 1,
  "warnings": [],
  "evidence": { "asset_ids": ["asset_7"] },
  "next_action": null,
  "started_at": "2026-08-26T00:00:00.000Z",
  "duration_ms": 420
}
```

Allowed statuses are `ok`, `degraded`, `blocked`, and `skipped`. Pixel data, prompts containing private content, credentials, and provider response bodies are excluded from the ledger.

## Plan Policy

Reference limits count physical user inputs, not composite child panels or video frames.

Initial configurable defaults:

| Plan | Physical references per execution |
| --- | ---: |
| Free | 2 |
| Pro | 10 |
| Plus | 20 |

These limits are separate from the popup's existing daily cue allowance. One shared plan-policy module supplies both UI and server enforcement so the client cannot bypass the server.

Selection rules:

1. References targeted by a user cue or cross-asset relation are required.
2. Preserve-role references are required.
3. If required physical references exceed the plan limit, block with the exact required count and allowed count.
4. Optional references are ranked and trimmed only after required references are reserved.
5. Trimming is always returned in the response and shown to the user; it is never silent.
6. Composite child panels inherit their parent's selected or trimmed state.

## Ranking

The ranking score is deterministic given provider outputs:

```text
final_score =
  0.55 * normalized_embedding_similarity
  + 0.25 * explicit_intent_score
  + 0.10 * visual_salience_score
  + 0.10 * user_role_score
```

- `explicit_intent_score` is 1 for cue-targeted assets and 0 otherwise.
- `user_role_score` prioritizes preserve/reference roles over generic context.
- `visual_salience_score` is derived from validated descriptor confidence and count, capped to prevent busy images dominating.
- Ties resolve by original workspace order and then stable asset ID.

When embeddings fail, required references remain selected and optional references use `explicit_intent_score`, then role, then workspace order.

## Canonical Brief and Prompt Compilation

The deterministic canonical brief is built before calling Mistral. It contains:

- Selected reference names and IDs.
- Requested changes tied to cue IDs.
- Exact coordinates, regions, and timestamps.
- Preserve constraints.
- Verified evidence summaries with provenance.
- Video temporal ranges.
- Explicit unknowns and degraded stages.

Mistral receives only this brief. It may improve clarity and destination-specific wording. It must preserve exact reference names and protected literals and must not invent objects, fonts, colors, relationships, coordinates, timestamps, or actions.

The deterministic canonical prompt remains usable when Mistral fails or produces an unsafe candidate.

## Reverse Hallucination Verification

The candidate prompt passes two gates.

### Deterministic gate

- All required cue IDs are represented in the internal coverage map.
- All selected reference names exist in the execution manifest.
- Protected names, quoted text, coordinates, regions, timestamps, and video ranges remain exact.
- Trimmed references are absent.
- Preserve constraints remain present.
- Attachment IDs and prompt references agree.

### Semantic gate

Nova Lite compares the candidate prompt against the canonical brief and returns only omissions, contradictions, or unsupported additions in a validated JSON schema. The semantic critic cannot add facts to the prompt.

If either gate reports a material issue, the candidate prompt is rejected and the deterministic canonical prompt is used. The ledger records the rejection without storing private prompt content.

## State Machine and Failure Policy

| Stage | Failure | Required behavior |
| --- | --- | --- |
| Ingest | Corrupt or unsupported required asset | `blocked`; identify the asset and remediation |
| Ingest | Corrupt optional asset | `skipped`; continue with notice |
| Plan | Required count above limit | `blocked`; never trim required intent |
| Composite | Invalid panel geometry | `degraded`; process parent as one image |
| Image perception | Qwen error/invalid JSON | Retry once; use Nova Pro; then metadata-only degradation |
| Video perception | Nova Pro error | Use Nova Lite; then sampled-frame Qwen |
| Font | Provider missing/error/low confidence | `degraded`; font name stays unknown |
| Embedding | Titan error | Deterministic rank fallback |
| Compilation | Mistral error/empty response | Deterministic canonical prompt |
| Verification | Candidate omission/invention | Reject candidate; deterministic canonical prompt |
| Attach | Any required attachment unconfirmed | Stop before prompt insertion and submission |
| Prompt | Editor does not retain complete prompt | Stop before submission |
| Submit | Prompt disappears or control unavailable | Report not submitted; do not commit receipt |

No fallback may invent missing visual evidence.

## Handoff Receipts and Cache Correctness

The current implementation records attachment state during compilation. This is incorrect because compilation does not prove the destination accepted the files.

The corrected flow is:

1. Server returns the execution manifest and state hashes without mutating session-upload state.
2. Content script attaches every required file and waits for destination readiness.
3. Content script inserts and verifies the complete prompt.
4. Content script optionally submits after re-verifying the prompt.
5. Content script returns a receipt containing destination fingerprint, chat ID, attached asset IDs/state hashes, prompt hash, and submission state.
6. Background worker posts the receipt to the local server.
7. Server commits uploaded state hashes only for the confirmed destination conversation.

The unchanged-workspace shortcut is valid only when the current destination fingerprint has a confirmed receipt for every required state hash. Otherwise references are attached again.

## HTTP Interfaces

The local service retains `GET /health` and `POST /compile` and adds:

- `GET /capabilities`: configured providers, model routes, plan policy version, and degraded capabilities without secrets.
- `POST /perception/image`: bounded single-image analysis.
- `POST /perception/video`: bounded native-video or sampled-frame analysis.
- `POST /handoff-receipt`: validates and commits destination receipts.
- `POST /session/reset`: clears only the named destination session receipt cache.

`POST /compile` returns:

```json
{
  "ok": true,
  "status": "ok",
  "provider": "bedrock",
  "final_prompt": "...",
  "attachments": [],
  "selected_references": [],
  "trimmed_references": [],
  "graph_summary": {},
  "stages": [],
  "warnings": [],
  "execution_id": "..."
}
```

Blocked pipeline requests use HTTP `422`. Invalid requests use `400`. Provider degradation with a usable deterministic result remains HTTP `200` with `status: degraded`.

## User Interface

The existing Send dialog gains a compact execution review:

- Plan and selected physical-reference count.
- Required and optional references.
- Composite child count where applicable.
- Processing stages with `ready`, `fallback used`, or `action required` copy.
- Trimmed-reference notice.
- Provider-warning details behind disclosure.
- Final handoff progress: attach, verify, insert, verify, submit.

The interface does not expose provider stack traces, raw model JSON, credentials, or private telemetry.

## Security and Privacy

- Only localhost and Chrome extension origins can call the local server.
- AWS and font-provider credentials remain server-side.
- Request-size ceilings are endpoint-specific and enforced before parsing full bodies.
- Media is processed in memory and is not written to logs.
- Cache keys use content hashes, model ID, schema version, and requested region; cache values contain descriptors rather than raw pixels.
- Provider errors are bounded and scrubbed before returning to the extension.
- Production ZIP checks reject `.env`, CSV, key, token, source-map, test, debug, and legacy side-panel files.
- Every third-party font/model integration must have its license recorded before packaging.

## Testing Strategy

### Unit tests

- Plan-limit enforcement and required-reference blocking.
- Composite geometry validation and physical counting.
- Evidence schema validation and inferred/observed separation.
- Spatial relation derivation.
- Stable ranking and deterministic fallback.
- Canonical brief construction.
- Protected-literal and manifest verification.
- Receipt validation and session scoping.
- Provider-output parsing and error normalization.

### Failure-injection tests

- Qwen timeout, invalid JSON, and empty output.
- Nova Pro failure followed by Nova Lite success.
- All perception providers unavailable.
- Font gateway absent, low confidence, and malformed output.
- Titan failure with stable fallback ranking.
- Mistral output omits a required cue or invents a font.
- Attachment succeeds but prompt insertion fails.
- Prompt inserts but disappears before submission.
- Receipt is posted for the wrong destination fingerprint.
- Cached prompt exists without confirmed attachment receipts.

### Integration tests

- Image-only pipeline.
- Video range plus extracted-frame provenance.
- Composite image with child graphs.
- More optional references than the selected plan permits.
- Required references above the plan limit.
- Bedrock-disabled deterministic workflow.
- Configured Bedrock workflow using a bounded smoke fixture.
- Successful handoff receipt and correct subsequent deduplication.

### Release checks

- Full test suite passes.
- Vite production build succeeds.
- Local server health and capability endpoints succeed.
- Deterministic compile smoke test succeeds.
- Bedrock capability smoke tests report real configured status.
- Extension package contains no secrets or excluded files.
- Browser handoff confirms attachment -> wait -> prompt -> verify -> optional submit ordering.

## Deployment

Deployment for this repository produces:

1. `dist/extension`, ready for Chrome's Load unpacked flow.
2. A production ZIP containing the extension and documented local services, excluding credentials and development artifacts.
3. Updated `README.md` and `BACKEND.md` with configuration, provider licensing, capability health, fallback behavior, and verification commands.

Chrome Web Store publication, cloud hosting, commercial font-provider contracting, and account entitlements require external authority and are not performed automatically.

## Success Criteria

- A user can submit scoped image/video references and receive a graph-grounded, destination-ready prompt.
- Still-image perception uses Qwen when configured; video perception uses Nova when configured.
- Font names are asserted only by a configured commercial-safe font provider above threshold.
- Composite references count correctly without losing child semantics.
- Required references are never silently removed.
- Every provider failure produces a documented fallback, degradation, or block.
- The compiler never needs raw full-resolution media in the graph request.
- Unsupported prompt additions cause candidate rejection.
- No destination upload is cached before a verified receipt.
- The deterministic workflow remains usable without Bedrock or font-provider availability.
- The production build and package pass automated security and workflow checks.

## Sources

- User-provided VICSUC algorithm report: `C:\Users\witne\Downloads\deep-research-report (3).md`
- [Amazon Bedrock Qwen3-VL model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-qwen-qwen3-vl-235b-a22b.html)
- [Amazon Nova modality support](https://docs.aws.amazon.com/nova/latest/userguide/modalities.html)
- [Amazon Titan Multimodal Embeddings](https://docs.aws.amazon.com/bedrock/latest/userguide/titan-multiemb-models.html)
- [WhatFontIs API](https://www.whatfontis.com/API-identify-fonts-from-image.html)
- [Monotype Font APIs](https://www.monotype.com/fonts-api)
- [Google Fonts repository and per-family licenses](https://github.com/google/fonts)
- [MixFont Lens repository and non-commercial open-weight license](https://github.com/mixfont/lens)
