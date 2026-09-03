# Viscue Gesture Intent Resolver — Fresh Synthetic Production Rebuild

**Date:** 2026-08-27  
**Status:** Approved direction; written specification pending user review  
**Parent architecture:** `2026-08-26-vicsuc-multimodal-pipeline-design.md`

## 1. Objective

Add a production-oriented Gesture Intent Resolver at the exact boundary between deterministic canvas geometry and deterministic graph binding:

```text
raw pointer events
→ normalized strokes
→ deterministic geometry and hit testing
→ Gesture Intent Resolver
→ calibrated acceptance or abstention
→ deterministic target/region binding
→ Semantic-Spatial Intent Graph
→ selective Qwen/Nova enrichment
→ Mistral compiler
→ reference engine
→ destination
```

The resolver determines what operation a gesture most likely expresses. It never determines exact target IDs, coordinates, regions, or referenced visual content. Deterministic runtime state remains authoritative.

The immediate program is synthetic-only. It will build a fresh, causal simulator and a SageMaker experiment pipeline. No telemetry, real-user gesture collection, image/content upload, or behavioral tracking is included. The result may be described only as a **synthetic-qualified production candidate** until a later, separately approved real-human validation phase.

## 2. Success criteria

User safety has priority over coverage. A confident wrong operation is worse than abstention.

Initial synthetic release gates:

- Accepted precision of at least 95% on the frozen test split at at least 70% coverage.
- Accepted precision of at least 95% on hard-counterfactual and template-holdout splits at at least 50% coverage.
- Stretch accepted precision of 97–99% without leakage or benchmark modification.
- OOD false-accept rate no greater than 2% at the selected production threshold.
- Expected calibration error no greater than 0.03 on validation and test.
- Macro F1, per-intent precision/recall/F1, family metrics, risk-coverage curves, confusion matrices, and confidence intervals are always reported.
- Batch-1 browser inference p95 at or below 25 ms on the agreed reference desktop and at or below 60 ms on the agreed lower-tier device.
- Compressed model artifact target below 10 MB, with a preferred target below 5 MB.
- Native-to-ONNX prediction parity: maximum probability difference below `1e-4`, identical accepted/abstained decisions on the parity suite.
- No automatic production claim is made from synthetic metrics alone.

Thresholds are selected on validation only. Frozen test, hard, OOD, and template-holdout results cannot be used to tune the model or threshold.

## 3. Current implementation map

The active React implementation currently provides:

- `AssetNode.jsx`: normalized annotation points, but no timestamp, pointer type, button state, or pressure sequence.
- `App.jsx`: annotation storage, erasing, React Flow node movement, demonstrated motion sampling, node/cue/relationship state, and `buildGraph()`.
- `buildGraph()`: the current Semantic-Spatial Intent Graph equivalent consumed by the local VICSUC pipeline.
- Local pipeline: reference policy, selective Bedrock enrichment, deterministic canonical brief, optional Mistral wording, reverse verification, and receipt-verified destination handoff.

Current path:

```text
pointer drawing / React Flow dragging
→ stored marks or motion paths
→ buildGraph()
→ VICSUC server pipeline
→ destination handoff
```

There is no active Gesture Intent Resolver, confidence gate, production geometry feature layer, ONNX runtime, gesture simulator, gesture dataset, checkpoint, or gesture benchmark. Historical product copies and legacy UI files exist, but no active old gesture ML artifacts were found. They are not training inputs and will not be deleted under this ML cleanup unless a separate cleanup scope explicitly names them.

## 4. Scope

### Included

- Production pointer-event capture contract.
- Deterministic gesture geometry and hit-test feature construction.
- Resolver input/output schemas.
- Fresh causal persona, canvas, goal, and gesture simulator.
- Fresh versioned dataset and immutable benchmark splits.
- Leakage, duplication, feasibility, and coverage audits.
- Reproducible baseline and neural model experiments in SageMaker.
- Calibration, OOD detection, ambiguity handling, and abstention.
- ONNX export, native/ONNX parity, and browser latency testing.
- Browser inference API separated from React UI components.
- Deterministic binding and graph integration.
- End-to-end algorithm-order tests.
- Synthetic-only documentation and model card.

### Excluded

- Telemetry or real-user gesture collection.
- Consent screens, behavioral uploads, or pilot-user storage.
- User images, video, documents, filenames, text, URLs, or destination chats in SageMaker.
- Cloud inference for ordinary production gestures.
- Reusing the existing SageMaker endpoint/model as a warm start.
- Reusing any historical synthetic dataset, model, feature cache, checkpoint, benchmark, or metric.
- Screenshot/VLM gesture interpretation.
- Unsupported novelty, patentability, or “world first” claims.

## 5. Intent taxonomy

The starting taxonomy has 30 product intents and cannot be silently changed to improve metrics.

| Family | Intents |
| --- | --- |
| Selection | `select_region`, `lasso_select`, `crop_region` |
| Relation | `apply_instruction`, `connect`, `point_to`, `replace`, `insert_between`, `sequence`, `flow_direction` |
| Transform | `move`, `resize`, `reorder`, `align`, `distribute`, `duplicate`, `rotate` |
| Navigation | `zoom`, `pan` |
| Markup | `emphasize`, `remove`, `approve`, `reject`, `annotate` |
| Layout | `rough_layout`, `draw_layout`, `compare`, `bracket_group`, `group` |
| Abstention | `unknown` is a decision state, not necessarily an ordinary semantic class |

An intent-separability audit will identify pairs that production-valid evidence cannot reliably distinguish. The product response is additional explicit context or abstention, not label merging without approval.

## 6. Runtime contracts

### 6.1 Raw gesture

```json
{
  "gesture_id": "uuid",
  "schema_version": "gesture-runtime/1.0",
  "strokes": [
    {
      "pointer_id": 1,
      "pointer_type": "mouse",
      "button": 0,
      "points": [
        { "x": 0.21, "y": 0.43, "time_ms": 0, "pressure": null }
      ]
    }
  ],
  "modifiers": { "alt": false, "ctrl": false, "meta": false, "shift": false }
}
```

Coordinates are normalized in the appropriate canvas or target coordinate system. Timestamps are monotonic from gesture start. Pressure is nullable and cannot be required because mouse/trackpad support varies. The runtime records pointer type, stroke boundaries, button, pointer count, cancellation, and available pressure without fabricating absent values.

### 6.2 Deterministic geometry

The shared geometry module computes before inference:

- Start/end/delta, bounding box, width, height, duration, point and stroke counts.
- Path length, displacement, straightness, direction, angle, speed and acceleration summaries.
- Curvature, turning-angle summaries, closure distance, self-intersections, and stroke relationships.
- Start/end node and region hits, handle hits, boundary crossings, overlap, containment, target proximity, selected-node overlap, and same-container state.
- Node movement, resize-handle acquisition, lasso containment, and ordered-neighbor geometry where applicable.

All hit IDs remain outside the learned model output. The model may receive type/count/relative-geometry features but never label-derived flags.

### 6.3 Production context

The input includes only pre-prediction facts available in the extension:

- Active tool and canvas mode.
- Pointer/device class and modifiers.
- Selected-node count and selected node types.
- Nearby node set with normalized type, position, dimensions, selected state, container relation, and existing edge summaries.
- Start/end hit types and relative positions.
- Existing instruction/reference binding counts.
- Current graph edge and object-order summaries.

Raw content, user text, image pixels, filenames, URLs, destination chats, persona IDs, scenario/template IDs, generator parameters, feasibility labels, and ground truth are forbidden inference features.

### 6.4 Resolver output

```json
{
  "schema_version": "gesture-resolution/1.0",
  "family": "relation",
  "intent": "connect",
  "confidence": 0.982,
  "accepted": true,
  "reason": null,
  "alternatives": [
    { "intent": "sequence", "confidence": 0.011 },
    { "intent": "flow_direction", "confidence": 0.004 }
  ],
  "model_version": "gesture-resolver/1.0.0"
}
```

Abstention returns `intent: null`, `accepted: false`, and a reason such as `ambiguous_intent`, `low_confidence`, `ood`, `invalid_input`, or `model_unavailable`. Target IDs never appear in the learned output.

## 7. Deterministic binding and graph integration

After an accepted prediction, deterministic binding uses the original hit-test result and geometry to create a resolved graph operation:

```json
{
  "operation": "connect",
  "source": "node_A",
  "target": "node_B",
  "stroke_ids": ["stroke_1"],
  "coordinates": { "start": [0.2, 0.4], "end": [0.8, 0.5] },
  "confidence": 0.982,
  "provenance": {
    "kind": "gesture_resolver",
    "model_version": "gesture-resolver/1.0.0",
    "geometry_version": "gesture-geometry/1.0.0"
  }
}
```

If the prediction abstains, the graph records an unresolved gesture or the UI keeps the existing explicit tool behavior. The learned resolver cannot override an explicit user-selected target, handle, crop box, cue endpoint, or preserve constraint.

## 8. Causal synthetic environment

The simulator models `human → interface → goal → action`, not `label → features`.

### 8.1 Persona population

Generate at least 100,000 deterministic, seed-addressable personas spanning:

- Mouse, trackpad, stylus, and touch.
- Novice, regular, and power-user skill.
- Slow, medium, and fast movement.
- Smoothness, jitter, hesitation, overshoot, undershoot, correction, and accidental motion.
- Direct, cautious, messy, precise, incomplete, and correction-heavy behavior.
- Relevant handedness tendencies, viewport scale, zoom, and device pixel ratio.

Persona parameters influence gesture generation but are stored only in simulation provenance. Persona identifiers and latent motor parameters never become model inputs.

### 8.2 Canvas world

Generate production-shaped states containing images, videos, extracted frames, documents, webpages, notes, instructions, shapes, containers, selections, relationships, ordering, and empty regions. Vary sparse/dense layout, overlap, sizes, grouping, existing relationships, tool/mode, modifiers, and valid/invalid targets.

Every sampled intent passes an explicit feasibility predicate. Examples: resize requires a resizable target/handle; insert-between requires a meaningful ordered neighborhood; apply-instruction requires instruction/reference structure; sequence requires a plausible sequence context.

### 8.3 Goal selection

Goals are sampled from feasible actions in the world, with controlled long-tail coverage. Ambiguous, accidental, incomplete, and counterfactual cases are generated intentionally and tagged in ground truth only.

### 8.4 Gesture execution

The simulator produces raw timestamped strokes through device- and persona-specific motor processes:

- Target acquisition and dwell.
- Velocity profiles and direction changes.
- Curvature and corrections.
- Arrowheads and multi-stroke relationships.
- Lasso/box closure imperfections.
- Drag/resize overshoot and correction.
- Pointer cancellation, incomplete release, misclicks, and accidental strokes.

The production geometry module processes the raw events. Geometry summaries are never generated directly from the label.

### 8.5 Coverage strategy and scale

The target corpus is 3–6 million gestures across at least 100,000 personas. Exhaustive Cartesian enumeration is prohibited because it creates enormous repetition. Coverage combines:

- Pairwise/t-wise combinatorial sampling across devices, tools, node states, layouts, and persona factors.
- Class/family minimums after feasibility filtering.
- Targeted rare and safety-critical scenarios.
- Same-geometry/different-context hard counterfactuals.
- Unseen combinations and mechanisms for OOD/template holdout.

Generation proceeds through quality gates: a small deterministic smoke corpus, a medium audit corpus, then the full frozen corpus. Failed audits block scale-up.

## 9. Dataset schema and provenance

Each example separates runtime features from simulation provenance and ground truth:

```text
sample_id
schema_version
generator_version
geometry_version
split
persona_provenance        # simulator/audit only
template_provenance       # simulator/audit only
pre_state                 # production-shaped canvas state
raw_strokes               # production-valid events
derived_geometry          # shared deterministic output
runtime_context           # production-valid context
ground_truth              # family/intent; never a feature
quality_flags             # correction/incomplete/accidental/ambiguous
```

S3 storage uses a private, versioned prefix such as:

```text
s3://<private-bucket>/viscue/gesture/v1/
  source/
  datasets/<dataset-version>/
  manifests/<dataset-version>/
  experiments/<experiment-id>/
  models/<model-version>/
  reports/<report-version>/
```

The frozen manifest records schema/generator/geometry versions, seed ranges, split membership, counts, class distributions, file hashes, job identifiers, and source commit/diff identity. Because the current workspace has no Git metadata, the implementation must also generate a source-tree hash manifest for reproducibility.

## 10. Split isolation

Create these splits from scratch:

- `train`
- `validation`
- `test`
- `hard_counterfactual`
- `ood`
- `template_holdout`

Splits are group-based, not row-random. Personas, generator mechanisms/templates, canvas seeds, and parameter families are isolated as appropriate. Template holdout uses gesture-generation mechanisms absent from training. Hard counterfactuals preserve similar geometry while changing valid context and intent. OOD includes unseen device/context/mechanism combinations and malformed/accidental inputs.

Once audits pass, test/hard/OOD/template manifests are immutable. Changing them requires a new dataset major version and invalidates comparisons to the prior benchmark.

## 11. Scientific integrity and leakage audits

Automated audits must detect:

- Exact and approximate raw-sequence duplicates.
- Duplicate/near-duplicate feature vectors and canvas states.
- Persona, seed, template, and mechanism overlap across protected splits.
- Simulator-only fields in the runtime feature schema.
- Label-derived or feasibility-derived features.
- Impossible intent/world combinations.
- Suspicious single-field and metadata-only predictive power.
- Deterministic class shortcuts and unrealistic distributions.
- Missing taxonomy/device/tool/context coverage.
- Hash or manifest mismatch.

Required suspicious baselines include label-frequency, primitive-shape-only, active-tool-only, start/end-hit-only, metadata-only, geometry-only, and context-only classifiers. Unexpectedly high performance triggers investigation and blocks the benchmark freeze.

## 12. Model experiment program

Experiments progress from interpretable baselines to compact multi-input candidates:

1. Deterministic rules and majority/frequency baselines.
2. Logistic regression and calibrated linear baselines.
3. ExtraTrees and boosted-tree geometry/context baselines.
4. Compact sequence CNN/TCN.
5. GRU/LSTM sequence encoder.
6. Lightweight Transformer sequence encoder.
7. Multi-input fusion: stroke encoder + geometry MLP + DeepSets node/context encoder.
8. Hierarchical family→intent heads only if frozen validation evidence supports them.

Primary candidate shape:

```text
masked/resampled raw strokes → compact TCN or Transformer
geometry vector             → small MLP
nearby-node set             → DeepSets encoder
runtime context             → embeddings + MLP
                                  ↓
                           gated feature fusion
                                  ↓
                    family + exact-intent logits
                                  ↓
                     calibration + OOD/abstention
```

The final architecture is selected by frozen validation performance, selective risk, OOD behavior, ONNX operator support, size, and latency—not by model complexity or a prior experiment.

## 13. Calibration and abstention

Raw softmax probability is not treated as calibrated confidence. The experiment program compares temperature scaling and class/family-aware validation thresholds. OOD scoring may compare energy, embedding-distance, and ensemble-disagreement methods that remain compact enough for browser use.

Acceptance requires:

- Valid runtime input.
- In-distribution/OOD gate pass.
- Top probability above the selected threshold.
- Top-vs-second margin above the ambiguity threshold.
- Any family/intent-specific safety gate.

Thresholds optimize accepted precision subject to useful coverage. `unknown` is primarily produced by the decision gate; accidental/incomplete examples still teach representation and rejection behavior.

## 14. SageMaker architecture

SageMaker is used for reproducible generation, audits, training, and evaluation. Ordinary extension inference remains local.

### Processing jobs

- Generate medium/full dataset partitions using immutable source bundles.
- Run geometry replay and dataset audits.
- Build frozen manifests and evaluation reports.
- Store outputs in private S3 prefixes.

### Training jobs

- Run baselines and neural experiments with fixed container/source versions.
- Use managed Spot Training where interruption-safe and checkpointed.
- Apply maximum runtime/wait limits and cost/allocation tags.
- Record hyperparameters, dataset manifest hash, metrics, checkpoint hash, and environment details.

### Evaluation jobs

- Evaluate all protected splits from their immutable manifests.
- Produce machine-readable metrics, confusion matrices, calibration/risk-coverage data, and a human-readable model card.
- Never modify the benchmark in response to model performance.

### Registry

Register only candidates that pass leakage, parity, latency, and synthetic metric gates. Registry status remains `SyntheticQualified`; it cannot become `ProductionApproved` before later real-human validation.

The existing SageMaker endpoint/model is not used as a warm start. The program creates fresh versioned jobs and does not require a permanent inference endpoint.

## 15. Browser deployment

The chosen checkpoint exports to ONNX. `onnxruntime-web` runs the ordinary resolver using WASM by default for broad extension compatibility; WebGPU is an optional measured optimization, not a requirement.

Runtime boundary:

```js
resolveGesture({ strokes, geometry, canvasContext, nodes })
  -> { family, intent, confidence, accepted, reason, alternatives }
```

The runtime module owns preprocessing, model loading, inference, calibration, and failure normalization. React components call the interface and never depend on tensor names or architecture details. Model load/inference failure abstains and preserves explicit existing tool behavior.

The production package includes only the chosen model, runtime assets, schema/model cards, and required ONNX Runtime files. Training data, simulator code, SageMaker credentials, checkpoints, experiment logs, and evaluation internals are excluded from the Chrome distribution.

## 16. Failure-first behavior

| Failure | Required behavior |
| --- | --- |
| Missing/malformed pointer sequence | Abstain with `invalid_input`; do not mutate graph |
| Model/ONNX load failure | Abstain or use explicit deterministic tool behavior |
| Low confidence or small top-two margin | Abstain with `ambiguous_intent` |
| OOD gesture/context | Abstain with `ood` |
| Prediction conflicts with explicit target/tool | Explicit deterministic evidence wins |
| Target binding incomplete | Keep unresolved; model cannot invent IDs |
| Dataset feasibility violation | Reject sample and fail affected generation audit |
| Split/persona/template leakage | Block benchmark freeze and all serious training |
| Suspicious metadata baseline | Investigate and block freeze until explained |
| SageMaker interruption | Resume from checkpoint or fail without partial promotion |
| Candidate misses precision gate | Increase abstention or reject candidate; do not change benchmark |
| ONNX parity/latency failure | Do not ship candidate |
| Real-user validation absent | Keep `SyntheticQualified`; no production accuracy claim |

## 17. Testing strategy

### Runtime and geometry

- Pointer event capture and normalization across mouse/touch/stylus fixtures.
- Deterministic geometry golden vectors and invariants.
- Hit-test and binding tests proving targets remain deterministic.
- Resolver contract, malformed input, abstention, and fallback tests.
- Algorithm-order tests proving inference occurs after geometry and before graph binding.

### Simulator and dataset

- Seed reproducibility and source-tree hash tests.
- Persona/canvas feasibility and raw-event realism invariants.
- Production-schema allowlist tests.
- Split isolation, duplicate, near-duplicate, leakage, and coverage tests.
- Counterfactual tests showing similar shapes can map to different intents through context.

### Models and deployment

- Reproducible baseline snapshots against frozen manifests.
- Metrics and confidence-interval validation.
- Calibration and risk-coverage tests.
- Native/ONNX parity across every protected split sample subset.
- Browser model load, inference, memory, size, and p50/p95 latency tests.
- End-to-end graph operation tests with accepted and abstained gestures.

## 18. Delivery phases

1. Runtime schemas, timestamped capture, deterministic geometry, and binding boundary.
2. Fresh causal simulator and small deterministic smoke corpus.
3. Production-feature allowlist, feasibility tests, leakage audits, and split builder.
4. Medium audit corpus; suspicious baselines; simulator diagnosis.
5. Full 100,000-persona, 3–6 million-gesture frozen benchmark in SageMaker.
6. Classical and neural experiment ladder.
7. Calibration, abstention, OOD, hard and template-holdout evaluation.
8. ONNX export, parity, browser latency, and packaging.
9. Graph/runtime integration and end-to-end VICSUC verification.
10. Synthetic model card, limitations, reproducibility manifest, and future real-user validation handoff.

Each phase has an explicit test/audit gate. The implementation does not jump directly to full-scale generation or neural training.

## 19. Definition of done

- No historical gesture dataset/model/checkpoint/metric is used.
- Production pointer capture and deterministic geometry contracts exist.
- Fresh causal simulator and versioned schema exist.
- At least 100,000 personas and 3–6 million gestures are generated only after smaller audits pass.
- Protected benchmark splits are immutable and hash-manifested.
- Leakage, feasibility, duplication, shortcut, and coverage audits pass.
- Baseline and candidate experiments are reproducible in SageMaker.
- Closed-set and selective metrics, calibration, OOD, hard, and template-holdout results are documented honestly.
- A candidate passes the stated synthetic precision, coverage, OOD, calibration, size, parity, and latency gates.
- ONNX Runtime Web inference works in the Chrome extension.
- Resolver executes after deterministic geometry and before deterministic binding.
- Resolved operations populate the Semantic-Spatial Intent Graph with provenance.
- Qwen, Nova, Mistral, and reference/session responsibilities remain separated.
- Production package contains no training data, credentials, source maps, notebooks, or experimental artifacts.
- Model is labelled `SyntheticQualified`, with real-human validation explicitly deferred.

## 20. Primary technical references

- [Amazon SageMaker Processing](https://docs.aws.amazon.com/sagemaker/latest/dg/processing-job.html)
- [Amazon SageMaker CreateTrainingJob API](https://docs.aws.amazon.com/sagemaker/latest/APIReference/API_CreateTrainingJob.html)
- [Amazon SageMaker Managed Spot Training](https://docs.aws.amazon.com/sagemaker/latest/dg/model-managed-spot-training.html)
- [Amazon SageMaker training data access](https://docs.aws.amazon.com/sagemaker/latest/dg/model-access-training-data.html)
- [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)
