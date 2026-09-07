# Runtime and user-flow verification

Scope: gesture capture/geometry/features/ONNX/binding, annotations and workspace persistence, multimodal compilation, extension/web authentication and quota boundaries, import/export and browser user flows.

## Baseline

- Root suite: 200 passed.
- Web suite: 63 passed.
- Python ML suite: 21 passed.
- These suites did not catch the async ONNX integration failure or the cloud compiler placeholder. Passing unit tests are not proof of end-to-end readiness.

## Resolved Findings & Verification Status

1. **Async Gesture Model Resolution**:
   - Fixed: Raw strokes are saved synchronously into workspace history before ONNX inference begins.
   - Enriched operations attach to surviving strokes by stroke ID without ghost operations.
   - Verified via `node --test gesture/tests/*.test.mjs` (118 tests passed) and `node scripts/test-gesture-pipeline-e2e.mjs`.

2. **ONNX Calibration & Finite Logits**:
   - Fixed: Shipped 0.60 acceptance threshold enforced, rejecting non-finite/malformed logits.
   - Verified via `gesture/tests/onnx-resolver.test.mjs` and `scripts/test-gesture-pipeline-e2e.mjs`.

3. **Cloud Compiler Pipeline & Boundary Security**:
   - Fixed: Vercel route runs the full VICSUC multimodal compiler pipeline with Supabase quota reservation. Bearer identity is verified.
   - Extension background worker does not silently fall back to localhost on cloud authentication or quota error.
   - Verified via `extension/tests/background-security.test.mjs`, `web/src/app/api/compile/vicsuc/route.test.ts`, and `local-server/tests/server.test.mjs`.

4. **Destination Platform Capabilities & Limits**:
   - Implemented: Pure platform capability registry (`local-server/lib/platform-capabilities.mjs`) and one-time blocking dialog (`extension/src/components/dialogs/PlatformPlanDialog.mjs`).
   - Insertion preflights enforce `min(viscuePlan, destinationPlanBudget, providerCeiling)` across drag/drop, file pick, webpage capture, page screenshot, and video frame extraction.
   - Verified via `extension/tests/platform-plan-*.test.mjs` and `local-server/tests/platform-capabilities.test.mjs`.

5. **Prompt & Reference Sensitivity and Model Routing**:
   - Validated: Prompt variations alter compiled output; reference set variations alter evidence/attachments; trimmed references never reappear; protected facts (exact coordinates, timestamps, filenames, instructions) survive.
   - Tested real AWS Bedrock routes:
     - Qwen 3 VL (`qwen.qwen3-vl-235b-a22b`): OK
     - Amazon Nova Pro (`amazon.nova-pro-v1:0`): OK
     - Amazon Nova Lite (`amazon.nova-lite-v1:0`): OK
     - Amazon Titan Multimodal Embeddings (`amazon.titan-embed-image-v1`): OK (1024-dim embedding)
     - Bedrock Compiler Mistral Large 3 (`mistral.mistral-large-3-675b-instruct`): OK
   - Verified via `node --test local-server/tests/pipeline-sensitivity.test.mjs` and `node scripts/test-ai.mjs`.

6. **History UI Cleanup**:
   - The broom/cleaner button has been removed from Workspace Chrome. History bottom bar retains only Import and Close, while per-item Restore, Export, Delete, and retention dropdown remain fully functional.
   - Verified via `extension/tests/workspace-chrome-render.test.mjs`.

