# Viscue 3.3 VICSUC Backend

The local service implements the VICSUC multimodal pipeline described in [`docs/superpowers/specs/2026-08-26-vicsuc-multimodal-pipeline-design.md`](docs/superpowers/specs/2026-08-26-vicsuc-multimodal-pipeline-design.md). It listens on `127.0.0.1:8787`; AWS and font-provider credentials remain in `.viscue-local.env` and are never returned to or bundled with the extension.

## Pipeline

1. Enforce the physical-reference allowance: Free 2, Pro 10, Plus 20.
2. Reserve every cue, cross-asset, motion, and Preserve dependency. Over-plan required references block before model calls.
3. Route still-image evidence to Qwen3-VL with one strict-JSON retry and Nova Pro fallback.
4. Route video to Nova Pro with Nova Lite fallback.
5. Treat object/layout/OCR observations as evidence with provider, model, asset, region, and confidence provenance. Derive spatial relationships from normalized geometry.
6. Use Titan multimodal embeddings when accessible; otherwise retain deterministic explicit-intent ordering.
7. Call the optional commercial font provider only for requested regions. A family becomes exact only above `FONT_MATCH_THRESHOLD`; otherwise it remains a candidate or unknown.
8. Build a canonical deterministic prompt, optionally improve wording with Mistral, then reverse-check exact filenames, Preserve constraints, coordinates, timestamps, cue coverage, and trimmed-reference exclusion.
9. Start an execution without marking uploads complete. State is committed only after the content script verifies the destination conversation, attachment readiness, prompt hash, and stable prompt text.

Every optional provider failure creates a `degraded` or `skipped` stage and leaves deterministic compilation usable. A required-reference overflow or receipt-integrity mismatch blocks the affected operation.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `AWS_BEARER_TOKEN_BEDROCK` | One AWS auth method | Bedrock bearer authentication. |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Alternative auth method | SigV4 credentials. |
| `AWS_SESSION_TOKEN` | Optional | Temporary SigV4 session token. |
| `AWS_REGION` | Optional | Defaults to `us-east-1`. |
| `QWEN_MODEL_ID` | Optional override | Defaults to `qwen.qwen3-vl-235b-a22b`. |
| `NOVA_PRO_MODEL_ID` | Optional override | Defaults to `amazon.nova-pro-v1:0`. |
| `NOVA_LITE_MODEL_ID` | Optional override | Defaults to `amazon.nova-lite-v1:0`. |
| `TITAN_EMBED_MODEL_ID` | Optional override | Defaults to `amazon.titan-embed-image-v1`. |
| `BEDROCK_MODEL_ID` | Optional | Mistral compiler route; omitted means deterministic wording. |
| `FONT_PROVIDER_URL`, `FONT_PROVIDER_API_KEY` | Optional pair | Commercially licensed font-identification service. |
| `FONT_MATCH_THRESHOLD` | Optional | Exact font threshold, default `0.90`. |
| `VISCUE_PORT` | Optional | Defaults to `8787`. |

`node local-server/configure-local.mjs -AccessKeyCsv <path> -BedrockKeyCsv <path>` imports AWS credentials and writes the model defaults. Add commercial font credentials manually only after confirming the provider agreement. MixFont Lens code and weights are not included because their published license is noncommercial.

## HTTP API

### `GET /health`

Returns basic readiness and whether the local deterministic fallback is active.

### `GET /capabilities`

Returns region, configured flags, and public model IDs. It always reports `credentials_exposed: false`.

### `POST /compile`

Accepts:

```json
{
  "graph": { "destination": "ChatGPT", "items": [], "cues": [], "relations": [], "motions": [] },
  "media": { "asset_id": { "kind": "image", "dataUrl": "data:image/jpeg;base64,..." } },
  "profile": { "plan": "free" },
  "session": { "chatId": "ChatGPT:abc", "destinationFingerprint": "ChatGPT:/c/abc" }
}
```

The extension sends bounded perception copies (still images at most 768 px, JPEG quality 0.78) while retaining clean originals for destination attachment. Small activated videos may be passed to Nova; oversized media degrades explicitly rather than exceeding the endpoint bound.

Success returns `execution_id`, `prompt_hash`, `final_prompt`, attachment state hashes, selected/trimmed references, evidence, summary, and the stage ledger. Required-plan violations return HTTP 422. No attachment state is committed by this endpoint.

### `POST /font/identify`

Calls the configured font gateway. Without configuration or on failure it returns `status: degraded`, `exact_match: null`, and no invented family.

### `POST /handoff-receipt`

Commits confirmed attachment state only when execution ID, destination fingerprint, prompt hash, required attachment hashes, and prompt verification all match the pending execution.

### `POST /session/reset`

Clears pending and confirmed state only for the supplied `chatId`.

## Reverse-failure rules

| Failure | Result |
| --- | --- |
| Required references exceed plan | Block before provider calls; list the required IDs. |
| Qwen invalid JSON or unavailable | Retry once, then use Nova Pro and mark degraded. |
| Nova Pro video failure | Use Nova Lite and mark degraded. |
| All perception unavailable | Keep user intent, unknown visual facts, deterministic prompt. |
| Titan unavailable | Use explicit-intent/salience/stable ordering and mark degraded. |
| Font provider absent/uncertain | No exact font; generic typography guidance only. |
| Mistral removes protected facts | Discard its wording and use canonical deterministic wording. |
| Destination conversation changes | Content script blocks before attachment/submission. |
| Prompt hash/text mismatch | Block submission; do not issue a receipt. |
| Attachment readiness incomplete | Block prompt insertion/submission; do not commit state. |
| Receipt mismatch | Reject commit; later runs cannot claim previous upload state. |

## Verification

```powershell
pnpm test
pnpm build
node scripts/verify-package.mjs dist/extension
```

The build verifier requires manifest `3.3.0` and rejects source maps, credentials, environment/CSV files, tests, legacy side-panel files, and missing runtime assets.
