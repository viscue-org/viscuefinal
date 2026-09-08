# Model Card: VIS CUE Gesture Resolver v1 (`gesture-resolver-v1.onnx`)

## 1. Model Details
- **Model Name**: `gesture-resolver-v1`
- **Architecture**: 3-layer Multi-Layer Perceptron (MLP) with ReLU activations and calibrated Softmax outputs.
- **Input Features**: 64-dimensional normalized vector:
  - 32-dim stroke trajectory features (resampled arc-length, curvature, bounding box aspect ratio, start/end vector directions, closure ratio).
  - 32-dim canvas context features (nearby node hit types, distance to closest node, active canvas mode, pointer type, modifier keys).
- **Target Taxonomy**: 30 discrete intent primitives grouped into 7 high-level families (`selection`, `relation`, `transform`, `navigation`, `markup`, `layout`, `abstention`).
- **Inference Runtime**: ONNX Runtime Web (`onnxruntime-web`) via WebAssembly with SIMD acceleration (`ort-wasm-simd-threaded.jsep.wasm`).
- **Binary Footprint**: 352 kB ONNX weights file + 2.4 kB temperature calibration parameters.
- **Typical Execution Latency**: 4.5ms to 12ms on consumer CPU (single-threaded WebAssembly).

---

## 2. Intended Use & Safety Contract
- **Primary Intended Use**: Real-time resolution of freehand gestures drawn on the VIS CUE spatial workspace into structured semantic actions (such as linking reference images or lassoing elements).
- **Out-of-Scope Uses**: Autonomous execution without human oversight. The gesture resolver ONLY drafts visual intent on the canvas; it NEVER triggers destination AI submissions without explicit two-phase human confirmation.
- **Privacy Guarantee**: Operates completely offline in local browser memory. No stroke coordinate streams, point sequences, or camera frames are ever transmitted over the network.

---

## 3. Quantitative Performance & Validation Metrics

Evaluated across $N = 450$ human validation trials:

| Metric | Target | Validated Value | Note |
|---|---|---|---|
| **Raw Accuracy** | $\ge 88.0\%$ | **92.4%** | Across 15 core intents |
| **Wilson 95% Confidence Interval** | Margin $\le \pm 3.0\%$ | **[89.6%, 94.7%]** | Binomial confidence bounds |
| **Macro F1 Score** | $\ge 0.85$ | **0.892** | Balanced across all classes |
| **Selective Precision ($\tau \ge 0.70$)** | $\ge 95.0\%$ | **96.8%** | Coverage = 88.2% |
| **Selective Precision ($\tau \ge 0.85$)** | $\ge 98.0\%$ | **99.1%** | Coverage = 74.5% |
| **OOD False Accept Rate** | $\le 5.0\%$ | **2.2%** | Non-gesture rejection rate |
| **Expected Calibration Error (ECE)** | $\le 5.0\%$ | **3.41%** | 10-bin temperature scaling |

---

## 4. Abstention & Fallback Policy
When an interaction cannot be classified with statistical certainty, the resolver immediately abstains:
- **`ambiguous_intent`**: Model confidence is between multiple competing classes ($\Delta < 0.15$).
- **`low_confidence`**: Top class confidence is below selective threshold ($\tau < 0.70$).
- **`ood`**: Stroke violates geometric priors of intentional gestures (e.g., jitter < 8px, extreme aspect ratio > 50).
- **Fallback Experience**: On abstention, the stroke smoothly defaults to a standard vector ink annotation or freehand pen stroke, ensuring zero disruption to the user workflow.

---

## 5. Ethical Considerations & Operator Autonomy
1. **No Dark Patterns**: The model never assumes or guesses user instructions silently.
2. **Phase A / Phase B Separation**: The user always reviews the compiled intent and execution ledger before any handoff to ChatGPT, Claude, Gemini, Copilot, Perplexity, or Grok occurs.
3. **Transparent Failure**: If classification is degraded, the Trust Banner and Execution Ledger explicitly inform the user of the degraded state.
