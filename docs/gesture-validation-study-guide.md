# VIS CUE Human Gesture Validation Study Protocol

## 1. Executive Summary & Objectives

The VIS CUE Gesture Resolver (`gesture-resolver-v1.onnx`) provides real-time, on-device classification of canvas interaction strokes into structured intent primitives (such as `connect`, `lasso_select`, `move`, `point_to`, `crop_region`, etc.). 

This study protocol defines the methodology for human subject evaluation to empirically validate:
1. **Classification Accuracy & Wilson 95% Confidence Intervals**: Precision and recall across all supported gesture classes.
2. **Selective Precision & Abstention Boundaries**: Ensuring ambiguous or low-confidence gestures reliably abstain (`reason: "ambiguous_intent"` or `"low_confidence"`) rather than misrouting intent.
3. **Out-of-Distribution (OOD) Rejection**: Rejection rate of non-gesture interactions (e.g., accidental clicks, nervous mouse jiggles, resting palm inputs).
4. **Confidence Calibration**: Verifying that predicted model probabilities match empirical success rates (Expected Calibration Error < 5%).
5. **Local Privacy Invariance**: Demonstrating that zero raw coordinates, video frames, or imagery are transmitted off the participant's machine.

---

## 2. Statistical Sample Sizing (Wilson 95% CI)

To establish statistical confidence without excessive participant burden, sample sizes are calculated using the Wilson Score Interval:

$$\tilde{p} = \frac{p + \frac{z^2}{2n}}{1 + \frac{z^2}{n}}, \quad \text{Margin of Error} = \frac{z}{1 + \frac{z^2}{n}} \sqrt{\frac{p(1-p)}{n} + \frac{z^2}{4n^2}}$$

- **Target Confidence Level**: 95% ($z = 1.96$).
- **Minimum Target Accuracy**: 90% ($p = 0.90$).
- **Target Margin of Error**: $\le \pm 3.0\%$.
- **Required Sample Size**: $N \ge 384$ total trials across participant cohorts (minimum 25 trials per core intent class across at least 15 unique participants with diverse input hardware: mouse, trackpad, stylus, touchscreen).

---

## 3. Participant Cohorts & Hardware Stratification

Participants are recruited across three input modalities:
1. **Precision Pointing**: Desktop mouse (optical/laser, variable DPI).
2. **Capacitive Touchpad**: Laptop trackpads (Windows Precision Touchpad, macOS Trackpad).
3. **Direct Stylus / Pen**: Active digitizers (Surface Pen, Wacom, Apple Pencil via WebPointer API).

Each participant completes:
- **Phase 1: Warmup & Calibration** (5 unrecorded trials).
- **Phase 2: Intent-Guided Tasks** (25 trials covering 5 core taxonomy categories).
- **Phase 3: Out-of-Distribution Stress Test** (10 non-gesture trials: diagonal scrolls, nervous twitches, hesitation pauses).

---

## 4. Evaluation Tasks Protocol

### Task A: Spatial Reference & Association (`connect`)
- **Stimulus**: Two asset cards displayed on canvas separated by 300px.
- **Instruction**: Draw a single continuous connecting arc from Asset A to Asset B to specify an edit relationship.
- **Success Criteria**: Classifier produces `family: "relation"`, `intent: "connect"`, `confidence >= 0.70`.

### Task B: Bounded Region Selection (`lasso_select` / `select_region`)
- **Stimulus**: A cluster of text notes and images.
- **Instruction**: Draw a freehand loop around the target items to select them as a group.
- **Success Criteria**: Classifier produces `family: "selection"`, `intent: "lasso_select"` or `"select_region"`.

### Task C: Direct Deictic Pointing (`point_to`)
- **Stimulus**: An image containing multiple fine-grained sub-elements.
- **Instruction**: Tap or flick an arrow directly targeting a specific element in the corner.
- **Success Criteria**: Classifier produces `family: "relation"`, `intent: "point_to"` with hit coordinates properly bound.

### Task D: Non-Gesture Rejection (OOD Test)
- **Stimulus**: Normal canvas manipulation without drawing intentions.
- **Instruction**: Perform accidental double-clicks, micro-jitters (< 10px), and rapid diagonal drag-scrolls.
- **Success Criteria**: Classifier produces `accepted: false`, `reason: "ood"` or `"low_confidence"`.

---

## 5. Privacy & Data Handling Guarantee

1. **Local Execution**: All validation trials run inside the local browser via `ort-wasm-simd` inside `validation-lab.mjs`.
2. **Zero Ingestion**: Raw coordinate arrays (`points: [{x, y, time_ms}]`) are processed in volatile heap memory and discarded immediately after feature extraction.
3. **Export Sanitization**: The export functions (`exportValidationReport`) serialize only high-level summary metrics (Wilson intervals, confusion matrices, F1 scores) and strip all canvas identifiers and coordinate streams.
