# Viscue Gesture Intent Resolver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fresh, leakage-resistant synthetic gesture environment, train and qualify a calibrated resolver in SageMaker, export it to ONNX, and integrate local browser inference between deterministic geometry and deterministic graph binding.

**Architecture:** A canonical ESM gesture core owns runtime schemas, deterministic geometry, feature construction, simulation, and dataset manifests so SageMaker and Chrome consume identical features. SageMaker Processing runs the JavaScript simulator/audits in a custom container; pinned Python jobs compare baselines and compact neural fusion models, calibrate abstention, evaluate immutable splits, and export the selected candidate to ONNX Runtime Web.

**Tech Stack:** Node.js 24 ESM and `node:test`; React 19/React Flow; Python 3.12; NumPy 2.5.2; scikit-learn 1.9.0; PyTorch 2.13.0; ONNX/ONNX Runtime 1.29; ONNX Runtime Web 1.29.0; Docker; Amazon ECR, S3, SageMaker Processing/Training, CloudWatch, and Model Registry.

**Spec:** `docs/superpowers/specs/2026-08-27-gesture-intent-resolver-design.md`

## Global Constraints

- The active program is synthetic-only. Do not add telemetry, consent flows, behavioral uploads, or real-user data collection.
- Do not send images, video, documents, filenames, text, URLs, destination chats, or credentials to SageMaker.
- Do not reuse the existing SageMaker model/endpoint, historical gesture data, checkpoints, feature caches, benchmarks, or metrics.
- Coordinates and deterministic hit testing determine where; the model predicts only gesture intent.
- Learned output never contains target IDs. Explicit tool/target evidence always wins.
- All serious model comparisons use one frozen benchmark; test/hard/OOD/template splits never tune models or thresholds.
- Synthetic release floor: at least 95% accepted precision at at least 70% test coverage; at least 95% accepted precision at at least 50% hard/template coverage; OOD false accept at most 2%; ECE at most 0.03.
- Final browser artifact target is under 10 MB; native/ONNX maximum probability delta is below `1e-4`; batch-1 p95 is at most 25 ms on the reference desktop and 60 ms on the lower-tier device.
- Model status cannot exceed `SyntheticQualified` until a separately approved real-human study exists.
- Ordinary production inference is local and offline-capable; no permanent SageMaker inference endpoint is required.
- Full-scale SageMaker generation/training requires a printed estimate and an explicit numeric cost ceiling; launchers default to dry-run.
- The workspace has no Git metadata. Replace commit steps with passing tests plus `scripts/source-manifest.mjs` checkpoint manifests.
- Preserve unrelated historical product copies and user files. The legacy audit found no active gesture ML artifacts to delete.

---

### Task 1: Restore a clean baseline and add reproducibility checkpoints

**Files:**
- Modify: `vite.config.mjs`
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `scripts/source-manifest.mjs`
- Create: `gesture/tests/source-manifest.test.mjs`
- Modify: `local-server/tests/package.test.mjs`

**Interfaces:**
- Consumes: current source tree and `dist` build.
- Produces: `createSourceManifest(root, options)` and clean mirrored `dist` output; every later task records a source manifest.

- [ ] **Step 1: Confirm the known mirrored-dist regression is red**

Run: `node --test local-server/tests/package.test.mjs`  
Expected: FAIL because stale `.map` files remain in the mirrored `dist` root.

- [ ] **Step 2: Make the Vite mirror prune only known runtime entries before copying**

Add an explicit list in `vite.config.mjs` and remove those paths from `distRoot` before mirroring:

```js
const mirroredRuntime = [
  'background.js', 'background.js.map', 'content.js', 'content.js.map',
  'handoff-contract.js', 'index.js', 'index.js.map', 'popup.js', 'popup.js.map',
  'index.css', 'popup.css', 'content.css', 'index.html', 'popup.html',
  'manifest.json', 'pdf.worker.mjs', 'chunks', 'icons',
];
for (const name of mirroredRuntime) {
  await rm(path.join(distRoot, name), { recursive: true, force: true });
}
```

- [ ] **Step 3: Rebuild and prove both unpacked-extension paths are clean**

Run: `pnpm build`  
Run: `node --test local-server/tests/package.test.mjs`  
Expected: PASS; neither `dist` nor `dist/extension` contains excluded artifacts.

- [ ] **Step 4: Write a failing source-manifest test**

```js
test('source manifest is stable and excludes generated or secret paths', async () => {
  const first = await createSourceManifest(fixtureRoot);
  const second = await createSourceManifest(fixtureRoot);
  assert.equal(first.tree_sha256, second.tree_sha256);
  assert.deepEqual(first.files.map(file => file.path), ['gesture/shared/example.mjs']);
});
```

Run: `node --test gesture/tests/source-manifest.test.mjs`  
Expected: FAIL because `scripts/source-manifest.mjs` is missing.

- [ ] **Step 5: Implement deterministic source hashing**

```js
export async function createSourceManifest(root, options = {}) {
  const excluded = options.excluded || [
    'node_modules', 'dist', '.viscue-local.env', '.venv-gesture',
    'ml-runs', 'datasets', 'artifacts/manifests', 'artifacts/gesture-replays',
  ];
  const files = await listSourceFiles(root, excluded);
  const rows = await Promise.all(files.map(async file => ({
    path: normalizePath(path.relative(root, file)),
    sha256: sha256(await fs.readFile(file)),
  })));
  return { schema_version: 'viscue-source-manifest/1.0', files: rows, tree_sha256: sha256(JSON.stringify(rows)) };
}
```

The same module exposes a CLI only when invoked directly: positional arguments are `<root> <output>`, it creates the output parent directory, writes canonical two-space JSON plus a trailing newline atomically, and exits non-zero on unreadable inputs or an output path inside the included source set. The planned `artifacts/manifests/` destination is explicitly excluded, preventing self-hashing on repeated checkpoints.

- [ ] **Step 6: Add scripts and generated-path exclusions**

Set package scripts to:

```json
{
  "test": "node --test local-server/tests/*.test.mjs gesture/tests/*.test.mjs",
  "test:gesture": "node --test gesture/tests/*.test.mjs",
  "test:ml": ".venv-gesture/Scripts/python.exe -m pytest ml/tests -q",
  "checkpoint": "node scripts/source-manifest.mjs . artifacts/manifests/source-current.json"
}
```

Add `.venv-gesture/`, `datasets/`, `ml-runs/`, `gesture/runtime/models/`, `artifacts/gesture-replays/`, `ml/sagemaker/config.local.json`, and `artifacts/manifests/source-current.json` to `.gitignore`.

- [ ] **Step 7: Verify baseline and record checkpoint**

Run: `pnpm test`  
Run: `pnpm build`  
Run: `pnpm checkpoint`  
Expected: tests/build exit 0 and `artifacts/manifests/source-current.json` contains no secret/generated paths.

---

### Task 2: Lock taxonomy, runtime schemas, and feature allowlists

**Files:**
- Create: `gesture/shared/taxonomy.mjs`
- Create: `gesture/shared/contracts.mjs`
- Create: `gesture/shared/schema.mjs`
- Create: `gesture/tests/contracts.test.mjs`
- Create: `gesture/LEGACY_ARTIFACT_AUDIT.md`

**Interfaces:**
- Produces: `INTENTS`, `FAMILIES`, `validateRawGesture()`, `validateRuntimeContext()`, `validateResolution()`, `assertProductionFeatureKeys()`.
- Consumes: no model or simulator code.

- [ ] **Step 1: Write failing taxonomy and schema tests**

```js
test('taxonomy contains the approved 30 unique intents', () => {
  assert.equal(INTENTS.length, 30);
  assert.equal(new Set(INTENTS).size, 30);
  assert.equal(FAMILY_BY_INTENT.connect, 'relation');
});

test('runtime schema rejects simulator and label-derived fields', () => {
  assert.throws(() => assertProductionFeatureKeys({ active_tool: 'annotate', scenario_name: 'easy_connect' }), /scenario_name/);
  assert.throws(() => assertProductionFeatureKeys({ is_connect: true }), /is_connect/);
});

test('pressure remains nullable but coordinates and monotonic timestamps are required', () => {
  assert.equal(validateRawGesture(validMouseGesture).ok, true);
  assert.equal(validateRawGesture(nonMonotonicGesture).ok, false);
});
```

Run: `node --test gesture/tests/contracts.test.mjs`  
Expected: FAIL because the shared modules do not exist.

- [ ] **Step 2: Implement the exact taxonomy and family map**

Export the 30 labels from the spec unchanged and freeze all arrays/maps. Treat `unknown` as the abstention label in reports, not a forced semantic prediction.

```js
export const INTENTS = Object.freeze([
  'select_region','lasso_select','apply_instruction','connect','move','resize','group','emphasize','remove','replace',
  'point_to','rough_layout','crop_region','reorder','insert_between','align','distribute','duplicate','rotate','zoom',
  'pan','approve','reject','compare','sequence','flow_direction','bracket_group','annotate','draw_layout','unknown',
]);
```

- [ ] **Step 3: Implement strict runtime validation**

`validateRawGesture()` must require 1–4 strokes, 2–128 points per completed stroke, normalized finite coordinates, nondecreasing `time_ms`, a known pointer type, nullable `[0,1]` pressure, and boolean modifiers. `validateResolution()` must reject any `source`, `target`, `node_id`, or `region_id` field.

- [ ] **Step 4: Document the fresh-start artifact audit**

Record that the active tree contains no gesture dataset, model, checkpoint, ONNX export, feature cache, notebook, or gesture benchmark. Explicitly list inactive product-history directories as preserved and forbidden as training inputs.

- [ ] **Step 5: Run tests and checkpoint**

Run: `pnpm test:gesture`  
Run: `pnpm checkpoint`  
Expected: contract tests pass and manifest changes only contain Task 2 source files.

---

### Task 3: Capture production-valid timestamped pointer sequences

**Files:**
- Create: `gesture/runtime/capture.mjs`
- Create: `gesture/tests/capture.test.mjs`
- Modify: `extension/src/components/nodes/AssetNode.jsx`
- Modify: `extension/src/App.jsx`

**Interfaces:**
- Produces: `GestureCapture`, `pointerPoint(event, rect, startedAt)`, and `onGestureCaptured(rawGesture)`.
- Consumes: browser Pointer Events and the Task 2 raw-gesture schema.

- [ ] **Step 1: Write failing capture tests using plain event fixtures**

```js
test('capture preserves stroke boundaries, pointer type, relative time, pressure, and cancellation', () => {
  const capture = new GestureCapture({ idFactory: () => 'g1', now: clock() });
  capture.down(pointer({ pointerId: 7, pointerType: 'pen', pressure: 0.4, x: 20, y: 30 }), rect);
  capture.move(pointer({ pointerId: 7, pointerType: 'pen', pressure: 0.6, x: 40, y: 50 }), rect);
  const result = capture.up(pointer({ pointerId: 7, pointerType: 'pen', pressure: 0.2, x: 60, y: 70 }), rect);
  assert.equal(result.strokes[0].pointer_type, 'stylus');
  assert.deepEqual(result.strokes[0].points.map(point => point.time_ms), [0, 16, 32]);
});
```

Run: `node --test gesture/tests/capture.test.mjs`  
Expected: FAIL because `GestureCapture` is missing.

- [ ] **Step 2: Implement capture without DOM dependencies**

Normalize `pen` to `stylus`, retain mouse/touch, map trackpad to mouse because browsers do not reliably distinguish it, sample at most once per 8 ms or 0.002 normalized movement, and mark `cancelled: true` on pointer cancellation.

- [ ] **Step 3: Integrate capture into annotation strokes**

Replace `drawing.current = [point]` with a capture instance. Keep the existing visual `points` array for rendering, but store the raw gesture under `stroke.gesture`:

```js
data.onStroke?.(id, {
  id: crypto.randomUUID(),
  tool: data.annotationTool || 'draw',
  points: raw.strokes[0].points.map(point => [point.x, point.y]),
  gesture: raw,
});
```

- [ ] **Step 4: Add a canvas gesture callback without sending or persisting telemetry**

`App.jsx` keeps completed gesture candidates only in the local workspace state required for graph construction. It must not call `fetch`, Chrome messaging, analytics, or local server endpoints when a gesture completes.

- [ ] **Step 5: Verify capture and existing UI build**

Run: `pnpm test:gesture`  
Run: `pnpm build`  
Expected: capture tests pass and Vite exits 0.

---

### Task 4: Implement deterministic geometry, hit testing, and context projection

**Files:**
- Create: `gesture/shared/geometry.mjs`
- Create: `gesture/shared/hit-testing.mjs`
- Create: `gesture/shared/context.mjs`
- Create: `gesture/tests/geometry.test.mjs`
- Create: `gesture/tests/hit-testing.test.mjs`
- Create: `gesture/tests/fixtures/geometry-golden.json`

**Interfaces:**
- Produces: `deriveGeometry(rawGesture)`, `hitTestGesture(geometry, nodes, edges)`, `projectRuntimeContext(appState, hits)`.
- Consumes: Task 2 schemas and React Flow node/edge snapshots converted to plain objects.

- [ ] **Step 1: Write failing golden-vector tests**

```js
test('open line geometry has exact deterministic summaries', () => {
  const geometry = deriveGeometry(lineGesture);
  assert.deepEqual(pick(geometry, ['start_x','start_y','end_x','end_y','path_length','displacement','closed']), {
    start_x: 0.1, start_y: 0.2, end_x: 0.9, end_y: 0.2,
    path_length: 0.8, displacement: 0.8, closed: false,
  });
});

test('hit testing returns authoritative IDs while model features receive only hit types', () => {
  const hits = hitTestGesture(geometry, nodes, edges);
  assert.equal(hits.start.node_id, 'image_a');
  const context = projectRuntimeContext(state, hits);
  assert.equal('node_id' in context.start_hit, false);
  assert.equal(context.start_hit.node_type, 'asset:image');
});
```

Run: `node --test gesture/tests/geometry.test.mjs gesture/tests/hit-testing.test.mjs`  
Expected: FAIL because geometry/hit-test modules are missing.

- [ ] **Step 2: Implement numerically stable geometry**

Compute bbox, duration, path length, displacement, straightness, direction, speed/acceleration quantiles, curvature/turning summaries, closure, intersections, stroke count, and inter-stroke distance. Round serialized features to 8 decimal places but retain full precision internally.

- [ ] **Step 3: Implement deterministic hit testing**

Use node bounds, z-order, selected state, container bounds, handle boxes, edge proximity, and lasso containment. Return authoritative IDs in `binding`, plus a separate ID-free `model_view`.

- [ ] **Step 4: Implement bounded context projection**

Sort nearby nodes by start/end proximity, then z-order and stable ID; retain at most 32. Expose only type, normalized relative geometry, selected/container state, and relationship counts.

- [ ] **Step 5: Run golden tests and checkpoint**

Run: `pnpm test:gesture`  
Run: `pnpm checkpoint`  
Expected: all golden values and ID-separation assertions pass.

---

### Task 5: Build fixed model features, abstaining resolver boundary, and deterministic graph binding

**Files:**
- Create: `gesture/shared/features.mjs`
- Create: `gesture/shared/binding.mjs`
- Create: `gesture/runtime/resolver.mjs`
- Create: `gesture/tests/features.test.mjs`
- Create: `gesture/tests/binding.test.mjs`
- Modify: `extension/src/App.jsx`
- Modify: `local-server/lib/brief.mjs`

**Interfaces:**
- Produces: `buildModelInputs({strokes, geometry, canvasContext, nodes})`, `createAbstention(reason)`, `bindResolvedGesture(resolution, binding)`, graph `operations[]`.
- Consumes: Task 2–4 output.

- [ ] **Step 1: Write failing feature-shape and leakage tests**

```js
test('model inputs have fixed documented dimensions and contain no IDs or ground truth', () => {
  const inputs = buildModelInputs(fixture);
  assert.deepEqual(inputs.shapes, { sequence: [4,128,7], geometry: [48], nodes: [32,14], context: [24] });
  assert.equal(JSON.stringify(inputs).includes('node_A'), false);
  assert.equal(JSON.stringify(inputs).includes('ground_truth'), false);
});
```

- [ ] **Step 2: Write failing binding precedence tests**

```js
test('accepted intent binds deterministic targets and a conflict abstains', () => {
  const event = bindResolvedGesture(acceptedConnect, authoritativeBinding);
  assert.deepEqual([event.source, event.target], ['node_A', 'node_B']);
  assert.throws(() => bindResolvedGesture({ ...acceptedConnect, intent: 'pan' }, explicitResizeHandle), /conflict/);
});
```

Run: `node --test gesture/tests/features.test.mjs gesture/tests/binding.test.mjs`  
Expected: FAIL because features/binding are missing.

- [ ] **Step 3: Implement the exact tensor contract**

Use sequence channels `[x,y,dt,dx,dy,pressure_or_zero,pressure_present]`; four strokes; 128 arc-length-resampled points; masks supplied as separate tensors. Export stable ordered feature-name arrays for all 48 geometry, 14 node, and 24 context dimensions.

- [ ] **Step 4: Implement resolver fallback and binding**

Before a model is installed, `resolveGesture()` always returns:

```js
createAbstention('model_unavailable')
// { family:null, intent:null, confidence:0, accepted:false,
//   reason:'model_unavailable', alternatives:[], model_version:null }
```

Binding accepts only schema-valid accepted resolutions and attaches authoritative IDs/coordinates after prediction.

- [ ] **Step 5: Add graph operations and deterministic prompt rendering**

`App.jsx` adds resolved gesture events to `buildGraph().operations`. `brief.mjs` renders accepted operations using their deterministic source/target names and omits unresolved candidates while preserving a stage warning.

- [ ] **Step 6: Verify algorithm order**

Add an integration assertion recording call order `capture → geometry → features → resolve → bind → graph`; run `pnpm test`. Expected: exact order and no Qwen/Nova/Mistral call before graph binding.

---

### Task 6: Build deterministic personas, canvas worlds, and feasible goals

**Files:**
- Create: `gesture/simulator/prng.mjs`
- Create: `gesture/simulator/personas.mjs`
- Create: `gesture/simulator/worlds.mjs`
- Create: `gesture/simulator/feasibility.mjs`
- Create: `gesture/tests/simulator-personas.test.mjs`
- Create: `gesture/tests/simulator-worlds.test.mjs`

**Interfaces:**
- Produces: `createPrng(seed)`, `generatePersona(personaSeed)`, `generateWorld(worldSeed, persona)`, `feasibleIntents(world)`, `sampleGoal(world, persona, prng)`.
- Consumes: taxonomy and production context schema; produces simulator provenance separately.

- [ ] **Step 1: Write failing reproducibility and diversity tests**

```js
test('same seed reproduces exactly and 100k seeds have stable unique IDs', () => {
  assert.deepEqual(generatePersona(42), generatePersona(42));
  assert.equal(new Set(Array.from({length:100_000}, (_, i) => generatePersona(i).persona_id)).size, 100_000);
});

test('persona latent fields never enter runtime context', () => {
  const sample = generateWorld(10, generatePersona(20));
  assert.equal(JSON.stringify(sample.runtime_context).includes('persona_id'), false);
});
```

- [ ] **Step 2: Write failing feasibility tests for all 30 intents**

Use hand-built worlds proving resize requires a handle, insert-between requires ordered neighbors, apply-instruction requires a note/reference binding, and impossible goals are absent.

- [ ] **Step 3: Implement counter-based deterministic PRNG and personas**

Use a stable 64-bit SplitMix/Xoshiro implementation whose outputs are snapshot-tested. Persona provenance includes device, skill, velocity, jitter, hesitation, correction, overshoot, handedness tendency, viewport, zoom, and density preferences.

- [ ] **Step 4: Implement production-shaped worlds and goal feasibility**

Generate only active extension node/edge kinds and fields. Use pairwise coverage schedules plus weighted rare scenarios. Ground truth remains under `simulation.ground_truth`, never under `runtime_context`.

- [ ] **Step 5: Run simulator unit tests**

Run: `node --test gesture/tests/simulator-personas.test.mjs gesture/tests/simulator-worlds.test.mjs`  
Expected: deterministic seeds, feasibility, and provenance separation pass.

---

### Task 7: Generate raw human-like gestures and hard counterfactuals

**Files:**
- Create: `gesture/simulator/motor.mjs`
- Create: `gesture/simulator/executors.mjs`
- Create: `gesture/simulator/counterfactuals.mjs`
- Create: `gesture/simulator/replay-cli.mjs`
- Create: `gesture/tests/simulator-executors.test.mjs`
- Create: `gesture/tests/counterfactuals.test.mjs`

**Interfaces:**
- Produces: `executeGoal({persona,world,goal,seed}) -> rawGesture`, `makeCounterfactualPair(sample, seed)`.
- Consumes: Task 3 raw schema and Task 6 goals.

- [ ] **Step 1: Write failing raw-event realism tests**

```js
test('arrow execution emits approach-independent down/move/up timing and an arrowhead stroke', () => {
  const gesture = executeGoal(fixture);
  assert.ok(gesture.strokes.length >= 2);
  assert.ok(gesture.strokes[0].points.length >= 8);
  assert.ok(gesture.strokes[0].points.at(-1).time_ms > 0);
});

test('device/persona changes distributions without exposing the persona', () => {
  assert.ok(variance(stylusSamples) < variance(messyMouseSamples));
  assert.equal(JSON.stringify(stylusSamples[0]).includes('persona_id'), false);
});
```

- [ ] **Step 2: Implement motor primitives**

Use minimum-jerk/Bezier trajectories with log-normal speed variation, bounded correlated jitter, dwell, overshoot, correction, closure error, missed acquisition, cancellation, and multi-stroke timing. Derive every geometry value later through `deriveGeometry()`.

- [ ] **Step 3: Implement intent executors and ambiguity**

Executors generate select/lasso/crop, relation arrows, transforms, navigation, markup, and layout gestures. Ambiguity changes context/goal while retaining near-identical geometry.

- [ ] **Step 4: Implement counterfactual pairs**

`makeCounterfactualPair()` must preserve a geometry-distance threshold while changing a feasible context and label; tests assert shape-only baselines cannot separate the pair by construction.

- [ ] **Step 5: Run executor tests and visual replay smoke**

Implement `replay-cli.mjs` as an offline HTML renderer over deterministic simulator output. It accepts `--seed` and `--out`, embeds only normalized synthetic coordinates and labels, escapes all text, creates the output parent directory, and makes no network requests.

Run: `pnpm test:gesture`  
Run: `node gesture/simulator/replay-cli.mjs --seed 42 --out artifacts/gesture-replays/seed-42.html`  
Expected: tests pass and the replay contains no user content or network references.

---

### Task 8: Build dataset shards, protected splits, manifests, and audits

**Files:**
- Create: `gesture/dataset/generate.mjs`
- Create: `gesture/dataset/splits.mjs`
- Create: `gesture/dataset/manifest.mjs`
- Create: `gesture/dataset/audit.mjs`
- Create: `gesture/dataset/cli.mjs`
- Create: `gesture/tests/dataset.test.mjs`
- Create: `gesture/tests/leakage.test.mjs`

**Interfaces:**
- Produces: gzipped JSONL shards, `dataset-manifest/1.0`, `audit-report/1.0`, immutable split membership.
- Consumes: Tasks 2–7 and the Task 1 source manifest.

- [ ] **Step 1: Write failing split-isolation and manifest tests**

```js
test('protected splits have disjoint persona, world, and template groups', async () => {
  const manifest = await buildDataset(smallConfig);
  assertDisjoint(manifest.splits.train.persona_groups, manifest.splits.test.persona_groups);
  assertDisjoint(manifest.splits.train.template_groups, manifest.splits.template_holdout.template_groups);
});

test('manifest hashes every shard and refuses mutation after freeze', async () => {
  const frozen = await freezeManifest(manifest);
  await mutateShard(frozen.shards[0]);
  await assert.rejects(() => verifyManifest(frozen), /hash mismatch/i);
});
```

- [ ] **Step 2: Write failing leakage and shortcut tests**

Test forbidden-key detection, exact/near duplicates, label-derived features, group contamination, duplicated canvas states, missing taxonomy/device/tool cells, and suspicious one-field correlations.

- [ ] **Step 3: Implement streaming generation**

Generate deterministic gzipped JSONL shards with atomic temporary files, per-shard SHA-256, resumable seed ranges, and bounded memory. Store simulator provenance and ground truth outside `model_input`.

- [ ] **Step 4: Implement group-based split assignment**

Assign persona/world/template groups using stable hash ranges. Reserve unseen executor mechanism IDs for template holdout and unseen combinations/malformed cases for OOD.

- [ ] **Step 5: Implement audits and freeze**

Audit exact hashes, locality-sensitive near duplicates, feature allowlist, feasibility, protected-group overlap, distributions, and coverage. `freezeManifest()` refuses any report whose `blocking_findings` is non-empty.

- [ ] **Step 6: Generate and verify the local smoke corpus**

Run:

```powershell
node gesture/dataset/cli.mjs generate --personas 1000 --samples 10000 --seed 20260827 --out datasets/gesture-smoke-v1
node gesture/dataset/cli.mjs audit --dataset datasets/gesture-smoke-v1
node gesture/dataset/cli.mjs freeze --dataset datasets/gesture-smoke-v1
```

Expected: 10,000 records, all 30 intents represented where feasibility allows, zero blocking audit findings, stable rerun manifest hash.

---

### Task 9: Create the pinned ML environment, loaders, metrics, and suspicious baselines

**Files:**
- Create: `ml/pyproject.toml`
- Create: `ml/requirements.txt`
- Create: `ml/viscue_ml/__init__.py`
- Create: `ml/viscue_ml/data.py`
- Create: `ml/viscue_ml/metrics.py`
- Create: `ml/viscue_ml/baselines.py`
- Create: `ml/tests/test_data.py`
- Create: `ml/tests/test_metrics.py`
- Create: `ml/tests/test_baselines.py`

**Interfaces:**
- Produces: `GestureDataset`, `selective_metrics()`, `calibration_metrics()`, `train_suspicious_baselines()`.
- Consumes: frozen Task 8 JSONL shards and feature-name manifests.

- [ ] **Step 1: Pin a fresh environment**

Use:

```text
boto3==1.43.81
sagemaker==3.21.0
numpy==2.5.2
scikit-learn==1.9.0
torch==2.13.0
onnx==1.22.0
onnxruntime==1.29.0
pytest==9.1.1
```

Run: `python -m venv .venv-gesture`  
Run: `.venv-gesture/Scripts/python.exe -m pip install -r ml/requirements.txt`
Run: `.venv-gesture/Scripts/python.exe -m pip install --no-deps -e ml`

`ml/pyproject.toml` defines the local `viscue-ml` package and discovers only `viscue_ml`; the editable install makes every documented `python -m viscue_ml...` command independent of the caller's working-directory import behavior.

- [ ] **Step 2: Write failing loader and metric tests**

```python
def test_loader_reads_only_model_input_and_label():
    row = next(iter(GestureDataset(FIXTURE_MANIFEST, split="train")))
    assert set(row) == {"sequence", "sequence_mask", "geometry", "nodes", "node_mask", "context", "label", "family"}

def test_selective_metrics_use_literal_hand_checked_counts():
    report = selective_metrics(y_true=[0,1,1,0], y_pred=[0,1,0,0], accepted=[1,1,0,0])
    assert report["accepted_precision"] == 1.0
    assert report["coverage"] == 0.5
```

Run: `pnpm test:ml`  
Expected: FAIL because ML modules are missing.

- [ ] **Step 3: Implement streaming loaders and complete metrics**

Validate manifest/shard hashes before reading. Report overall/macro/per-intent/family metrics, Wilson confidence intervals, ECE, Brier score, risk-coverage curve, OOD false accept, and confusion matrices.

- [ ] **Step 4: Implement suspicious baselines**

Train majority, primitive-only, tool-only, start/end-hit-only, metadata-only, geometry-only, and context-only classifiers. Mark `blocking=True` if forbidden metadata beats the approved threshold or a one-field model indicates a deterministic shortcut.

- [ ] **Step 5: Run smoke baselines**

Run: `.venv-gesture/Scripts/python.exe -m viscue_ml.baselines --manifest datasets/gesture-smoke-v1/manifest.json --out ml-runs/smoke-baselines`  
Expected: report exists; no performance result is called production accuracy.

---

### Task 10: Package SageMaker generation/audit jobs with permission and cost guards

**Files:**
- Create: `ml/sagemaker/simulator/Dockerfile`
- Create: `ml/sagemaker/simulator/entrypoint.mjs`
- Create: `ml/sagemaker/jobs.py`
- Create: `ml/sagemaker/preflight.py`
- Create: `ml/viscue_ml/sagemaker_jobs.py`
- Create: `ml/sagemaker/config.example.json`
- Create: `ml/tests/test_sagemaker_jobs.py`
- Create: `ml/sagemaker/README.md`

**Interfaces:**
- Produces: dry-run Processing/Training job specifications, `run_processing_job(config, approved_cost_usd)`, ECR simulator image, S3 dataset prefixes.
- Consumes: AWS local credentials, Docker, Task 1 source bundle, and Task 8 CLI.

- [ ] **Step 1: Write failing boto3 Stubber tests**

```python
def test_processing_job_defaults_to_dry_run_and_has_cost_tags():
    spec = build_processing_spec(CONFIG)
    assert spec["AppSpecification"]["ImageUri"].endswith("viscue-gesture-simulator:v1")
    assert {tag["Key"] for tag in spec["Tags"]} >= {"Project", "DatasetVersion", "CostCenter"}
    with pytest.raises(CostApprovalError):
        submit_processing_job(spec, approved_cost_usd=0)
```

Run: `pnpm test:ml`  
Expected: FAIL because SageMaker job modules are missing.

- [ ] **Step 2: Implement read-only preflight**

Verify caller identity, region, execution role, S3 bucket/versioning/encryption, ECR repository, SageMaker list permissions, Docker availability, service quotas, and absence of credentials in build context. Print booleans/resource aliases only; never print account ID, ARN, keys, or tokens.

- [ ] **Step 3: Implement simulator container**

Use `node:24-bookworm-slim`, copy only `gesture/`, `scripts/source-manifest.mjs`, and a source manifest, run as a non-root user, and write Processing outputs only under `/opt/ml/processing/output`.

- [ ] **Step 4: Implement cost-gated Processing and Training job builders**

Put importable builders in `viscue_ml.sagemaker_jobs` so they cannot shadow the installed AWS `sagemaker` package; keep `ml/sagemaker/jobs.py` as the thin CLI. Estimate `instance_count × max_runtime_hours × configured_hourly_ceiling`; require `approved_cost_usd >= estimate`; set `StoppingCondition.MaxRuntimeInSeconds`; add dataset/source hashes and cost tags; default every CLI to `--dry-run`.

- [ ] **Step 5: Build/push the versioned image and run preflight**

Run:

```powershell
.venv-gesture/Scripts/python.exe ml/sagemaker/preflight.py --config ml/sagemaker/config.local.json
docker build -f ml/sagemaker/simulator/Dockerfile -t viscue-gesture-simulator:v1 .
.venv-gesture/Scripts/python.exe ml/sagemaker/jobs.py publish-image --config ml/sagemaker/config.local.json --tag v1
```

Expected: preflight passes or reports a specific missing permission; image digest is recorded without exposing registry account identifiers in logs.

- [ ] **Step 6: Launch the bounded SageMaker smoke job**

After obtaining explicit approval for the numeric ceiling, submit 10,000 samples on one `ml.m5.large`, max runtime 30 minutes, using `--approved-cost-usd 2.00`. Without that approval, stop after emitting the dry-run specification. Verify output manifest hash matches a local run for the same seeds.

---

### Task 11: Generate and freeze the medium and full synthetic benchmarks

**Files:**
- Create: `ml/sagemaker/dataset_program.py`
- Create: `ml/tests/test_dataset_program.py`
- Create: `docs/gesture/dataset-card-v1.md`
- Create through jobs: private S3 datasets/manifests/reports

**Interfaces:**
- Produces: medium audit corpus, then full 100,000-persona/3–6-million-gesture frozen benchmark.
- Consumes: Task 10 Processing image/job builder and Task 8 audits.

- [ ] **Step 1: Write failing phase-gate tests**

```python
def test_full_generation_requires_medium_audit_and_cost_approval():
    with pytest.raises(PhaseGateError):
        plan_full_generation(medium_report={"blocking_findings": ["template leakage"]}, approved_cost_usd=100)
    with pytest.raises(CostApprovalError):
        plan_full_generation(medium_report=CLEAN_REPORT, approved_cost_usd=0)
```

- [ ] **Step 2: Implement medium program and launch it**

Generate 10,000 personas and 300,000 gestures across multiple deterministic seed shards. Run audits and suspicious baselines. Any blocking finding returns the program to simulator diagnosis.

- [ ] **Step 3: Produce the full-scale estimate checkpoint**

Print shard count, instance type/count, maximum runtime, storage estimate, and cost ceiling. Full jobs remain dry-run until the user supplies a numeric approved ceiling greater than or equal to the estimate.

- [ ] **Step 4: Launch full generation only after the checkpoint is approved**

Generate at least 100,000 personas and between 3,000,000 and 6,000,000 gestures. Each shard is seed-addressable and resumable. Do not regenerate completed valid shards.

- [ ] **Step 5: Audit and freeze**

Require zero blocking findings; freeze manifest/source/generator/geometry/schema hashes. S3 bucket versioning is mandatory and verified again before freeze. If Object Lock was enabled when the bucket was created, apply and record a compliance retention date; otherwise copy the frozen manifest and audit report to a separate versioned release prefix, deny overwrite through the execution role, and record the exact version IDs. Write the dataset card with counts, distributions, exclusions, and synthetic limitations.

---

### Task 12: Train strong classical baselines and diagnose intent separability

**Files:**
- Create: `ml/viscue_ml/classical.py`
- Create: `ml/viscue_ml/separability.py`
- Create: `ml/sagemaker/train_classical.py`
- Create: `ml/tests/test_classical.py`
- Create through jobs: baseline reports/checkpoints

**Interfaces:**
- Produces: calibrated logistic, ExtraTrees, and histogram/boosted-tree baseline reports; separability report.
- Consumes: frozen full manifest only.

- [ ] **Step 1: Write failing reproducibility tests**

```python
def test_classical_run_is_seed_reproducible(tmp_path):
    first = train_classical(FIXTURE, seed=7, out=tmp_path / "a")
    second = train_classical(FIXTURE, seed=7, out=tmp_path / "b")
    assert first["validation"]["macro_f1"] == second["validation"]["macro_f1"]
```

- [ ] **Step 2: Implement baseline training**

Train geometry-only, context-only, and fused logistic/ExtraTrees/boosted candidates with fixed seeds and class-balanced objectives. Do not read test/hard/OOD/template data during fitting or hyperparameter selection.

- [ ] **Step 3: Implement separability analysis**

Report pairwise confusions, conditional entropy by available context, same-geometry/different-context performance, and intents that remain indistinguishable. Recommend abstention/context requirements without changing taxonomy.

- [ ] **Step 4: Launch SageMaker CPU baseline jobs**

Use managed Spot where supported, checkpoint outputs, maximum runtime, and cost ceiling. Save reports keyed by frozen dataset and source hashes.

- [ ] **Step 5: Gate neural work**

Proceed only when baseline reports show no suspicious shortcut/leakage and establish an honest reference score.

---

### Task 13: Train compact sequence and multi-input neural candidates

**Files:**
- Create: `ml/viscue_ml/models/tcn.py`
- Create: `ml/viscue_ml/models/__init__.py`
- Create: `ml/viscue_ml/models/gru.py`
- Create: `ml/viscue_ml/models/transformer.py`
- Create: `ml/viscue_ml/models/fusion.py`
- Create: `ml/viscue_ml/train.py`
- Create: `ml/tests/test_models.py`
- Create: `ml/sagemaker/train_neural.py`

**Interfaces:**
- Produces: deterministic PyTorch checkpoints and validation predictions for TCN, GRU, Transformer, and fused DeepSets candidates.
- Consumes: fixed tensors and train/validation splits only.

- [ ] **Step 1: Write failing shape, masking, and determinism tests**

```python
@pytest.mark.parametrize("name", ["tcn", "gru", "transformer", "fusion"])
def test_model_outputs_30_logits_and_respects_masks(name):
    model = build_model(name, seed=11)
    logits = model(BATCH)
    assert logits.shape == (BATCH_SIZE, 30)
    assert torch.isfinite(logits).all()
```

- [ ] **Step 2: Implement compact candidates**

Cap each model at 2.5 million parameters. The fusion model combines sequence encoder, 48-value geometry MLP, 32-node DeepSets encoder, and 24-value context MLP. Mask padded strokes/nodes before aggregation.

- [ ] **Step 3: Implement reproducible training**

Set Python/NumPy/PyTorch seeds, deterministic algorithms where supported, fixed data order, early stopping on validation selective risk, gradient clipping, class-balanced loss, and checkpoint metadata containing every source/dataset/config hash.

- [ ] **Step 4: Run local tiny overfit and SageMaker training**

First prove the model can overfit 256 fixture samples. Then launch bounded SageMaker jobs; use managed Spot/checkpoints and stop candidates that cannot beat the strongest baseline on validation.

- [ ] **Step 5: Save validation predictions for calibration**

Predictions must include logits, labels, family, sample ID, and OOD membership without protected test labels entering training code.

---

### Task 14: Calibrate abstention, evaluate protected splits, and select the synthetic candidate

**Files:**
- Create: `ml/viscue_ml/calibration.py`
- Create: `ml/viscue_ml/ood.py`
- Create: `ml/viscue_ml/evaluate.py`
- Create: `ml/viscue_ml/select.py`
- Create: `ml/tests/test_calibration.py`
- Create: `ml/tests/test_selection.py`
- Create: `docs/gesture/model-card-synthetic-v1.md`

**Interfaces:**
- Produces: calibrated threshold artifact, protected-split evaluation report, selected `SyntheticQualified` checkpoint/model card.
- Consumes: validation predictions for tuning; protected splits once for final reporting.

- [ ] **Step 1: Write failing calibration/selection tests**

```python
def test_threshold_is_fit_on_validation_only():
    artifact = fit_acceptance_gate(validation_predictions=VALIDATION)
    assert artifact["fit_split"] == "validation"

def test_candidate_cannot_qualify_when_any_safety_gate_fails():
    report = {**PASSING_REPORT, "ood_false_accept_rate": 0.021}
    assert select_candidate([report])["status"] == "Rejected"
```

- [ ] **Step 2: Implement calibration and ambiguity gates**

Compare temperature scaling, per-family thresholds, top-two margin, and compact energy/distance OOD gates. Select on validation accepted precision/risk coverage only.

- [ ] **Step 3: Evaluate every protected split**

Report overall/macro/per-intent/family metrics, confidence intervals, ECE, OOD false accept, coverage, risk-coverage, and confusion matrices for test, hard counterfactual, OOD, and template holdout.

- [ ] **Step 4: Apply qualification gates literally**

Reject any candidate missing a global gate, with no benchmark edits. If no candidate qualifies, keep the best report as `ResearchOnly` and return to model/simulator diagnosis without claiming success.

- [ ] **Step 5: Write the synthetic model card**

State dataset provenance, metrics, failure modes, excluded real-user validation, intended use, forbidden claims, browser limits, and status `SyntheticQualified` or `ResearchOnly`.

---

### Task 15: Export ONNX and implement local browser inference

**Files:**
- Create: `ml/viscue_ml/export_onnx.py`
- Create: `ml/tests/test_onnx_parity.py`
- Create: `gesture/runtime/onnx-resolver.mjs`
- Create: `gesture/runtime/model-manifest.json`
- Create through export: `gesture/runtime/models/gesture-resolver-v1.onnx`
- Create through export: `gesture/runtime/models/gesture-resolver-v1.calibration.json`
- Create: `gesture/tests/onnx-resolver.test.mjs`
- Modify: `package.json`
- Modify: `vite.config.mjs`

**Interfaces:**
- Produces: versioned `.onnx`, calibration artifact, model manifest, `OnnxGestureResolver.resolve(input)`.
- Consumes: selected Task 14 checkpoint and Task 5 tensors.

- [ ] **Step 1: Add ONNX Runtime Web exactly**

Run: `pnpm add onnxruntime-web@1.29.0`

- [ ] **Step 2: Write failing native/ONNX parity tests**

```python
def test_onnx_probabilities_and_decisions_match_native():
    native = predict_native(CHECKPOINT, PARITY_BATCH)
    exported = predict_onnx(ONNX_PATH, PARITY_BATCH)
    assert np.max(np.abs(native.probabilities - exported.probabilities)) < 1e-4
    assert native.accepted.tolist() == exported.accepted.tolist()
```

- [ ] **Step 3: Export an operator-compatible model**

Export fixed tensor names/shapes, opset supported by ONNX Runtime Web 1.29.0, dynamic batch only, and embed no preprocessing that differs from `features.mjs`.

- [ ] **Step 4: Write failing browser resolver tests**

Test lazy single-flight model loading, tensor names/shapes, calibrated output, malformed input abstention, load failure abstention, and no network fallback.

- [ ] **Step 5: Implement browser resolver and model asset copying**

Load packaged model/calibration assets through `chrome.runtime.getURL`, use WASM execution provider, cache one session, and return schema-valid resolutions. Vite copies only the selected model and required WASM runtime assets.

- [ ] **Step 6: Verify size, parity, and latency**

Run Python parity tests, Node resolver tests, and a browser benchmark collecting p50/p95 over at least 1,000 fixture gestures after warm-up. Reject packaging if model exceeds 10 MB or latency gates fail.

---

### Task 16: Integrate resolver execution, graph provenance, UI abstention, and production packaging

**Files:**
- Modify: `extension/src/App.jsx`
- Modify: `extension/src/components/nodes/AssetNode.jsx`
- Modify: `extension/src/components/dialogs/Dialogs.jsx`
- Modify: `extension/src/styles.css`
- Modify: `local-server/lib/brief.mjs`
- Create: `gesture/tests/algorithm-order.test.mjs`
- Create: `gesture/tests/end-to-end.test.mjs`
- Modify: `README.md`
- Modify: `BACKEND.md`
- Modify: `scripts/package-policy.mjs`
- Modify: `extension/manifest.json`

**Interfaces:**
- Produces: production order `capture → geometry → resolve → bind → graph`, visible unresolved gesture behavior, VICSUC 3.4 distribution.
- Consumes: all previous tasks.

- [ ] **Step 1: Write failing end-to-end order and precedence tests**

```js
test('accepted gesture binds before graph compilation and explicit targets win', async () => {
  const result = await executeGestureFixture(connectFixture, deps);
  assert.deepEqual(result.order, ['capture','geometry','features','resolve','bind','graph']);
  assert.equal(result.graph.operations[0].source, 'node_A');
  assert.equal(result.graph.operations[0].target, 'node_B');
});

test('abstention produces no destructive graph mutation', async () => {
  const result = await executeGestureFixture(ambiguousFixture, deps);
  assert.equal(result.graph.operations.length, 0);
  assert.equal(result.ui.reason, 'ambiguous_intent');
});
```

- [ ] **Step 2: Wire inference at the exact runtime boundary**

After capture, derive geometry/hits/context/features, invoke `OnnxGestureResolver`, apply the confidence/OOD gate, bind accepted operations deterministically, and append them to graph state. Never invoke Qwen/Nova for gesture meaning.

- [ ] **Step 3: Add user-safe abstention UI**

Show a non-destructive “Gesture not resolved” notice with alternatives only when useful. Existing explicit tools remain available; no automatic destructive action occurs from an abstained prediction.

- [ ] **Step 4: Compile resolved operations**

Canonical brief rendering includes operation, exact deterministic binding, confidence, and provenance; model alternatives and raw strokes are not sent downstream unless required for a destination operation.

- [ ] **Step 5: Update documentation and version**

Document synthetic-only limitations, local ONNX behavior, SageMaker reproducibility, metrics, status, and future real-human validation. Bump package/manifest to `3.4.0` only if the selected model is `SyntheticQualified`; otherwise ship the runtime behind a disabled experimental flag and retain the current production version.

- [ ] **Step 6: Harden package verification**

Reject datasets, `.pt` checkpoints, training Python, notebooks, SageMaker configs, credentials, evaluation reports, source maps, and any model not listed in `gesture/runtime/model-manifest.json`.

- [ ] **Step 7: Run full verification**

Run:

```powershell
pnpm test
pnpm test:ml
pnpm build
node scripts/verify-package.mjs dist/extension
```

Then run deterministic local-server smoke, configured Bedrock degradation smoke, ONNX browser parity/latency, and extension handoff receipt tests. Expected: zero test failures; known third-party Vite directive warnings may remain but no application warnings/errors.

- [ ] **Step 8: Create the clean production artifact**

Create `artifacts/packaging/Viscue-3.4-Gesture-SyntheticQualified.zip` only when all gates pass. If qualification fails, create no production ZIP and hand off the `ResearchOnly` reports plus exact blockers.

- [ ] **Step 9: Record final reproducibility evidence**

Write final source, dataset, model, calibration, ONNX, and package SHA-256 manifests; SageMaker job aliases; cost summary; metrics; and the no-Git limitation without printing account IDs, ARNs, bucket names, credentials, or endpoint names.

---

## Program stop conditions

Execution stops and reports evidence instead of forcing progress when:

- Medium/full dataset audits find leakage, impossible samples, or suspicious shortcuts.
- SageMaker permissions, encrypted/versioned S3 storage, ECR, or explicit cost ceiling are unavailable.
- No candidate meets synthetic safety gates.
- ONNX parity, artifact size, or browser latency gates fail.
- A requested action would require telemetry or real-user content.

These conditions do not justify changing the benchmark, weakening the target, fabricating metrics, or relabeling a `ResearchOnly` candidate as production-ready.
