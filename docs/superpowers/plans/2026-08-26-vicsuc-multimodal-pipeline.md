# VICSUC Multimodal Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved VICSUC multimodal perception, reference-policy, anti-hallucination, and verified-handoff pipeline to Viscue and rebuild the production extension distribution.

**Architecture:** Extract the local server's policy, provider, verification, and receipt concerns into focused ES modules tested with Node's built-in test runner. Keep user-authored graph intent in React, send bounded perception media to the local orchestrator, and let the content script return a destination receipt that the server commits only after attachment and prompt verification.

**Tech Stack:** Node.js 24 ES modules and `node:test`, React 19, Vite 7, Chrome Manifest V3, Amazon Bedrock HTTPS APIs, optional commercial font-provider HTTP API.

**Spec:** `docs/superpowers/specs/2026-08-26-vicsuc-multimodal-pipeline-design.md`

## Global Constraints

- Voice typing, dictation, messy-language rewriting, and general writing assistance are excluded.
- User annotations, preserve roles, coordinates, regions, timestamps, and explicit relationships are authoritative.
- Provider observations are evidence with provenance and confidence; uncertain facts remain unknown.
- Default physical-reference limits are Free 2, Pro 10, and Plus 20.
- Required references cannot be silently trimmed.
- Qwen handles still-image perception; Nova handles video; Titan handles image/text relevance; Mistral handles optional wording.
- Exact font names require a configured commercially safe font provider above the acceptance threshold.
- Bedrock and font credentials remain in the local server environment.
- No upload state is committed before a verified destination receipt.
- The deterministic workflow remains usable when all external providers are unavailable.
- The final build must exclude source maps, secrets, tests, debug artifacts, and legacy side-panel files.
- This workspace is not a Git repository; replace commit steps with a clean test/build checkpoint and recorded diff summary.

---

### Task 1: Core policy, evidence, ranking, and canonical-brief contracts

**Files:**
- Create: `local-server/lib/contracts.mjs`
- Create: `local-server/lib/policy.mjs`
- Create: `local-server/lib/evidence.mjs`
- Create: `local-server/lib/brief.mjs`
- Create: `local-server/tests/policy.test.mjs`
- Create: `local-server/tests/evidence.test.mjs`
- Create: `local-server/tests/brief.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `PLAN_POLICY`, `MODEL_ROUTES`, `createStage()`, `enforceReferencePlan()`, `rankReferences()`, `validateCompositePanels()`, `normalizeEvidence()`, `deriveSpatialRelations()`, `buildCanonicalBrief()`, and `verifyProtectedFacts()`.
- Consumes: graph objects shaped like the current `buildGraph()` output plus `profile.plan`.

- [ ] **Step 1: Add the test command and write failing policy tests**

```json
"scripts": {
  "test": "node --test local-server/tests/*.test.mjs",
  "build": "vite build --config vite.config.mjs"
}
```

```js
test('blocks when required physical references exceed the plan', () => {
  const graph = graphWithAssets(3, { required: [0, 1, 2] });
  assert.equal(enforceReferencePlan(graph, 'free').status, 'blocked');
});

test('trims optional references after reserving required references', () => {
  const graph = graphWithAssets(4, { required: [2] });
  const result = enforceReferencePlan(graph, 'free');
  assert.deepEqual(result.selected.map(item => item.id), ['asset_2', 'asset_0']);
  assert.deepEqual(result.trimmed.map(item => item.id), ['asset_1', 'asset_3']);
});
```

- [ ] **Step 2: Run policy tests and verify module-not-found failure**

Run: `node --test local-server/tests/policy.test.mjs`  
Expected: FAIL because `local-server/lib/policy.mjs` does not exist.

- [ ] **Step 3: Implement exact plan and ranking contracts**

```js
export const PLAN_POLICY = Object.freeze({
  free: { physicalReferences: 2 },
  pro: { physicalReferences: 10 },
  plus: { physicalReferences: 20 },
});

export function rankReferences(references) {
  return references.toSorted((a, b) =>
    b.required - a.required ||
    b.finalScore - a.finalScore ||
    a.workspaceIndex - b.workspaceIndex ||
    a.id.localeCompare(b.id));
}
```

`enforceReferencePlan()` must derive required IDs from cues, cross-asset relations, and preserve roles; block when required count is too high; and return selected/trimmed arrays without mutating the graph.

- [ ] **Step 4: Write failing composite/evidence tests**

```js
test('accepts a valid 2x2 composite and rejects overlapping boxes', () => {
  assert.equal(validateCompositePanels(validGrid).ok, true);
  assert.equal(validateCompositePanels(overlappingGrid).ok, false);
});

test('marks model semantic claims as inferred evidence', () => {
  const evidence = normalizeEvidence({ type: 'relation', value: 'owns', confidence: 0.7 }, context);
  assert.equal(evidence.observation_kind, 'inferred');
});
```

- [ ] **Step 5: Run evidence tests and verify missing-export failure**

Run: `node --test local-server/tests/evidence.test.mjs`  
Expected: FAIL because the evidence functions are not implemented.

- [ ] **Step 6: Implement evidence validation and deterministic spatial relations**

```js
export function normalizeBbox(value) {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const box = value.map(Number);
  if (box.some(number => !Number.isFinite(number) || number < 0 || number > 1)) return null;
  if (box[2] <= box[0] || box[3] <= box[1]) return null;
  return box;
}
```

Composite validation must enforce 2-9 panels, minimum 4% area per panel, at most 8% pairwise overlap, and at least 55% parent coverage. Spatial relations must be derived from box centers and overlap instead of accepted from model prose.

- [ ] **Step 7: Write failing canonical-brief and protected-fact tests**

```js
test('canonical brief preserves exact names, regions, and timestamps', () => {
  const brief = buildCanonicalBrief(fixture);
  assert.match(brief.prompt, /Demo\.mp4/);
  assert.match(brief.prompt, /00:12\.840/);
  assert.match(brief.prompt, /45% across/);
});

test('candidate verification rejects a missing preserve constraint', () => {
  const result = verifyProtectedFacts(candidateWithoutPreserve, canonical);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ['preserve:asset_1']);
});
```

- [ ] **Step 8: Implement canonical brief and deterministic verification**

`buildCanonicalBrief()` must return `{ prompt, protectedFacts, coverageIds, attachments, summary }`. `verifyProtectedFacts()` must compare exact protected strings, selected attachment names, cue coverage IDs, and excluded trimmed IDs.

- [ ] **Step 9: Run Task 1 tests**

Run: `node --test local-server/tests/policy.test.mjs local-server/tests/evidence.test.mjs local-server/tests/brief.test.mjs`  
Expected: all tests PASS with zero warnings.

### Task 2: Bedrock and commercial font-provider gateways

**Files:**
- Create: `local-server/lib/http-client.mjs`
- Create: `local-server/lib/bedrock.mjs`
- Create: `local-server/lib/font-gateway.mjs`
- Create: `local-server/tests/bedrock.test.mjs`
- Create: `local-server/tests/font-gateway.test.mjs`

**Interfaces:**
- Consumes: model routes from `contracts.mjs`, data URLs, canonical briefs, and injected `request()` functions.
- Produces: `BedrockGateway.analyzeImage()`, `analyzeVideo()`, `embedReference()`, `compilePrompt()`, `verifyPrompt()`, and `FontGateway.identify()`.

- [ ] **Step 1: Write failing provider parsing and fallback tests**

```js
test('image route retries invalid Qwen JSON then uses Nova', async () => {
  const calls = [];
  const gateway = createGatewayWithResponses(calls, ['not-json', novaEvidence]);
  const result = await gateway.analyzeImage(imageRequest);
  assert.equal(result.provider, 'nova-pro');
  assert.equal(result.status, 'degraded');
});

test('embedding failure returns a normalized provider error', async () => {
  await assert.rejects(() => gateway.embedReference(input), /titan.*unavailable/i);
});
```

- [ ] **Step 2: Run provider tests and verify missing-module failure**

Run: `node --test local-server/tests/bedrock.test.mjs`  
Expected: FAIL because the Bedrock gateway does not exist.

- [ ] **Step 3: Implement authenticated HTTP and Bedrock model routes**

```js
export class BedrockGateway {
  constructor({ region, credentials, routes, request = signedRequest }) {
    Object.assign(this, { region, credentials, routes, request });
  }

  async analyzeImage(input) {
    return this.#withFallback([
      () => this.#converse(this.routes.imagePrimary, imageMessage(input), parseEvidence),
      () => this.#converse(this.routes.imageFallback, imageMessage(input), parseEvidence),
    ], 'perception.image');
  }
}
```

The shared request layer must support bearer and SigV4 modes, an abort timeout, bounded response bodies, scrubbed errors, Converse calls, and InvokeModel calls for Titan.

- [ ] **Step 4: Write failing font-gateway tests**

```js
test('unconfigured font provider returns degraded unknown', async () => {
  const result = await new FontGateway({}).identify(fontRequest);
  assert.deepEqual(result, { status: 'degraded', exact_match: null, candidates: [], warning: 'Font provider is not configured.' });
});

test('low-confidence results never become exact matches', async () => {
  const result = await configuredGateway.identify(fontRequest);
  assert.equal(result.exact_match, null);
  assert.equal(result.candidates.length, 2);
});
```

- [ ] **Step 5: Implement commercial-safe font-provider mapping**

```js
export class FontGateway {
  constructor({ endpoint, apiKey, threshold = 0.9, request = fetch }) {
    Object.assign(this, { endpoint, apiKey, threshold, request });
  }

  async identify({ imageBase64, recognizedText, topK = 5 }) {
    if (!this.endpoint || !this.apiKey) return degradedUnknown();
    const rows = await requestWhatFontIs(this, { imageBase64, recognizedText, topK });
    const candidates = rows.map(normalizeFontCandidate);
    return { status: 'ok', exact_match: candidates[0]?.score >= this.threshold ? candidates[0] : null, candidates };
  }
}
```

No MixFont Lens code or weights may be downloaded or included.

- [ ] **Step 6: Run Task 2 tests**

Run: `node --test local-server/tests/bedrock.test.mjs local-server/tests/font-gateway.test.mjs`  
Expected: all tests PASS without making network calls.

### Task 3: Pipeline orchestration, stage ledger, and receipt store

**Files:**
- Create: `local-server/lib/pipeline.mjs`
- Create: `local-server/lib/receipts.mjs`
- Create: `local-server/tests/pipeline.test.mjs`
- Create: `local-server/tests/receipts.test.mjs`
- Modify: `local-server/server.mjs`

**Interfaces:**
- Consumes: graph, session, profile, bounded media, Bedrock gateway, font gateway, policy/evidence/brief modules.
- Produces: `runPipeline(request, dependencies)`, `ReceiptStore`, `/capabilities`, `/compile`, `/font/identify`, `/handoff-receipt`, and `/session/reset`.

- [ ] **Step 1: Write failing end-to-end pipeline tests**

```js
test('provider failures still return a deterministic degraded result', async () => {
  const result = await runPipeline(request, allProvidersFailing);
  assert.equal(result.ok, true);
  assert.equal(result.status, 'degraded');
  assert.equal(result.provider, 'deterministic');
  assert.ok(result.stages.every(stage => ['ok', 'degraded', 'skipped'].includes(stage.status)));
});

test('required references above the plan block before perception', async () => {
  const result = await runPipeline(overPlanRequest, spyingProviders);
  assert.equal(result.status, 'blocked');
  assert.equal(spyingProviders.calls.length, 0);
});
```

- [ ] **Step 2: Run pipeline tests and verify missing-module failure**

Run: `node --test local-server/tests/pipeline.test.mjs`  
Expected: FAIL because `pipeline.mjs` is missing.

- [ ] **Step 3: Implement dependency-gated orchestration**

```js
export async function runPipeline(request, deps) {
  const stages = [];
  const policy = enforceReferencePlan(request.graph, request.profile?.plan || 'free');
  stages.push(createStage('plan.selection', policy.status, { evidence: policy.summary }));
  if (policy.status === 'blocked') return blockedResponse(policy, stages);
  const evidence = await collectEvidence(policy.selected, request.media || {}, deps, stages);
  const ranked = await scoreAndSelect(policy, evidence, request.graph, deps, stages);
  const canonical = buildCanonicalBrief({ graph: request.graph, evidence, selection: ranked });
  return compileAndVerify(canonical, ranked, deps, stages);
}
```

Provider calls must be per selected asset, cached by content hash/model/schema, and wrapped so every failure becomes a stage instead of an unhandled rejection.

- [ ] **Step 4: Write failing receipt tests**

```js
test('compile does not mark attachments uploaded', () => {
  const store = new ReceiptStore();
  store.beginExecution(execution);
  assert.equal(store.hasConfirmedState('chat:1', 'state:a'), false);
});

test('only matching execution and destination receipts commit state', () => {
  const store = preparedStore();
  assert.throws(() => store.commitReceipt(wrongDestination), /destination/i);
  assert.equal(store.commitReceipt(validReceipt).confirmed.length, 1);
});
```

- [ ] **Step 5: Implement receipt validation and scoped session cache**

`ReceiptStore` must validate execution ID, destination fingerprint, prompt hash, attachment state hashes, and prompt verification before committing. `resetSession(chatId)` must clear only the named conversation.

- [ ] **Step 6: Refactor the HTTP entry point**

`server.mjs` must construct dependencies from environment, call `runPipeline()`, expose capabilities without secrets, preserve CORS restrictions, use endpoint-specific size limits, and return HTTP 422 only for blocked requests.

- [ ] **Step 7: Run Task 3 tests and the complete server test suite**

Run: `pnpm test`  
Expected: all server tests PASS with zero network calls.

### Task 4: Extension graph media, plan profile, and execution review

**Files:**
- Create: `extension/src/utils/vicsuc.js`
- Create: `local-server/tests/extension-contract.test.mjs`
- Modify: `extension/src/App.jsx`
- Modify: `extension/src/popup.jsx`
- Modify: `extension/src/components/dialogs/Dialogs.jsx`
- Modify: `extension/src/styles.css`

**Interfaces:**
- Consumes: existing React nodes/edges, current stored plan, server compile response.
- Produces: `buildVicsucRequest()`, bounded perception thumbnails, profile plan, stage review UI, trimmed-reference notices, and execution ID forwarding.

- [ ] **Step 1: Write failing pure contract tests**

```js
test('buildVicsucRequest includes plan and bounded media only for visual assets', () => {
  const request = buildVicsucRequest(graph, nodes, { plan: 'free' });
  assert.equal(request.profile.plan, 'free');
  assert.deepEqual(Object.keys(request.media), ['image_1']);
});

test('stage copy distinguishes fallback from blocked state', () => {
  assert.equal(stageLabel({ status: 'degraded' }), 'Fallback used');
  assert.equal(stageLabel({ status: 'blocked' }), 'Action required');
});
```

- [ ] **Step 2: Run contract tests and verify missing-module failure**

Run: `node --test local-server/tests/extension-contract.test.mjs`  
Expected: FAIL because `extension/src/utils/vicsuc.js` does not exist.

- [ ] **Step 3: Implement request/media helpers**

```js
export function stageLabel(stage) {
  return stage.status === 'blocked' ? 'Action required' :
    stage.status === 'degraded' ? 'Fallback used' :
    stage.status === 'skipped' ? 'Skipped' : 'Ready';
}

export function buildVicsucRequest(graph, media, profile, session) {
  return { graph, media, profile: { plan: normalizePlan(profile?.plan) }, session };
}
```

App media preparation must create perception JPEGs at at most 768 px and 0.78 quality for still images while preserving clean original attachments. Video metadata and existing extracted frames must remain linked by provenance.

- [ ] **Step 4: Wire profile and compile responses into the UI**

The popup stores `viscue-plan` with default `free`. The Send dialog shows selected/allowed counts, required/optional rows, stage labels, warnings, and trimmed references. It must not expose raw provider output.

- [ ] **Step 5: Fix cached execution behavior in App**

Remove the direct cached `insert-prompt` shortcut. A cached prompt may be reused only when the server compile response confirms all required state hashes for the current destination fingerprint; otherwise run full handoff.

- [ ] **Step 6: Run contract tests and production build**

Run: `node --test local-server/tests/extension-contract.test.mjs`  
Run: `pnpm build`  
Expected: test PASS and Vite exits 0.

### Task 5: Destination receipts and handoff correctness

**Files:**
- Create: `local-server/tests/handoff-contract.test.mjs`
- Modify: `extension/content.js`
- Modify: `extension/background.js`
- Modify: `extension/src/App.jsx`

**Interfaces:**
- Consumes: `executionId`, prompt hash, destination fingerprint, attachments with state hashes.
- Produces: content-script handoff receipt, background `handoff-receipt` message, and server receipt commit response.

- [ ] **Step 1: Write failing receipt-shape tests**

```js
test('handoff receipt contains only confirmed attachment state hashes', () => {
  const receipt = buildHandoffReceipt(input);
  assert.deepEqual(receipt.attachment_state_hashes, ['state:a']);
  assert.equal(receipt.prompt_verified, true);
  assert.equal(receipt.submitted, false);
});
```

- [ ] **Step 2: Run the test and verify missing-export failure**

Run: `node --test local-server/tests/handoff-contract.test.mjs`  
Expected: FAIL because the receipt helper is absent.

- [ ] **Step 3: Return verified receipts from the content script**

```js
return {
  ok: true,
  execution_id: executionId,
  destination_fingerprint: destinationFingerprint,
  attachment_state_hashes: attachments.map(item => item.stateHash),
  prompt_hash: promptHash,
  prompt_verified: true,
  attached,
  submitted: Boolean(submit),
};
```

The return occurs only after attachment readiness and stable prompt verification. Submission still rechecks the prompt immediately before clicking Send.

- [ ] **Step 4: Proxy and commit the receipt**

Background accepts `handoff-receipt` and posts it to the local server. App posts the returned content receipt after a successful handoff and treats receipt rejection as a degraded warning, never as proof that upload state was saved.

- [ ] **Step 5: Run handoff tests and full tests**

Run: `pnpm test`  
Expected: all tests PASS.

### Task 6: Documentation, capability configuration, and clean packaging

**Files:**
- Modify: `local-server/configure-local.mjs`
- Modify: `README.md`
- Modify: `BACKEND.md`
- Modify: `vite.config.mjs`
- Modify: `extension/manifest.json`
- Create: `scripts/verify-package.mjs`
- Create: `local-server/tests/package.test.mjs`

**Interfaces:**
- Consumes: built `dist/extension` and local environment variable names.
- Produces: documented provider configuration, source-map-free dist, package verification, and version `3.3.0` artifacts.

- [ ] **Step 1: Write failing package-security tests**

```js
test('production extension contains no excluded artifacts', async () => {
  const files = await listFiles('dist/extension');
  assert.equal(files.some(file => /\.map$|\.env$|\.csv$|test|sidepanel/i.test(file)), false);
});
```

- [ ] **Step 2: Run package test and observe existing source-map failure**

Run: `node --test local-server/tests/package.test.mjs`  
Expected: FAIL because current `dist/extension` contains `.map` files.

- [ ] **Step 3: Disable production source maps and bump the extension version**

Set Vite `build.sourcemap` to `false`, update `package.json` and `extension/manifest.json` to `3.3.0`, and ensure the asset-copy step mirrors only the rebuilt clean output.

- [ ] **Step 4: Document exact capability configuration**

Document `QWEN_MODEL_ID`, `NOVA_PRO_MODEL_ID`, `NOVA_LITE_MODEL_ID`, `TITAN_EMBED_MODEL_ID`, `BEDROCK_MODEL_ID`, `FONT_PROVIDER_URL`, `FONT_PROVIDER_API_KEY`, `FONT_MATCH_THRESHOLD`, plan defaults, capability health, and commercial font-provider licensing.

- [ ] **Step 5: Implement package verifier**

```js
const forbidden = [/\.env$/i, /\.csv$/i, /\.map$/i, /(^|\/)tests?\//i, /sidepanel/i, /(access|secret)[_-]?key/i, /token/i];
if (files.some(file => forbidden.some(pattern => pattern.test(file)))) process.exitCode = 1;
```

The verifier must also assert manifest version `3.3.0` and required runtime files.

- [ ] **Step 6: Rebuild and run package verification**

Run: `pnpm build`  
Run: `node scripts/verify-package.mjs dist/extension`  
Expected: both exit 0 with no excluded artifacts.

### Task 7: Full verification and dist deployment

**Files:**
- Update: `dist/extension/**` through `pnpm build`
- Update: mirrored `dist/**` runtime files through the Vite asset plugin
- Create: `artifacts/packaging/Viscue-3.3-VICSUC-Production.zip`

**Interfaces:**
- Consumes: all implementation tasks.
- Produces: fresh verified test/build evidence and the requested updated distribution.

- [ ] **Step 1: Run the complete automated suite**

Run: `pnpm test`  
Expected: zero failures and zero unhandled warnings.

- [ ] **Step 2: Run deterministic local-server smoke tests**

Start the server with Bedrock variables omitted in a child process, call `/health`, `/capabilities`, and `/compile` with a fixture, then terminate it. Expected: health `ok: true`, capabilities report deterministic degradation, and compile returns a usable deterministic prompt.

- [ ] **Step 3: Run configured Bedrock capability smoke tests**

Start the server with the existing `.viscue-local.env`, call `/health` and `/capabilities`, and submit one bounded image fixture. Expected: the response reports the actual accessible model route or an explicit degraded stage; it must not falsely claim Qwen/Nova success.

- [ ] **Step 4: Build and verify dist**

Run: `pnpm build`  
Run: `node scripts/verify-package.mjs dist/extension`  
Expected: both exit 0.

- [ ] **Step 5: Create a clean production ZIP**

Create `artifacts/packaging/Viscue-3.3-VICSUC-Production.zip` from the verified production file list. Do not include `.viscue-local.env`, credentials, tests, source maps, old builds, or workspace artifacts.

- [ ] **Step 6: Inspect final changed-file and artifact summaries**

Run: `Get-ChildItem -Recurse dist/extension | Select-Object FullName,Length`  
Run: `Get-Item artifacts/packaging/Viscue-3.3-VICSUC-Production.zip | Select-Object FullName,Length,LastWriteTime`  
Expected: the extension runtime and production ZIP exist with current timestamps.

- [ ] **Step 7: Record the no-Git limitation**

Report that the workspace has no `.git` metadata, so no commit, branch, or diff hash can be supplied. Hand off the exact modified source files, verification commands, updated `dist/extension`, and production ZIP.
