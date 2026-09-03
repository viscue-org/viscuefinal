# Gesture artifact audit

Date: 2026-08-27

## Scope and result

The active workspace was inspected for gesture datasets, model files, checkpoints,
ONNX exports, feature caches, notebooks, and gesture benchmarks. None were found.
The active gesture tree contains only the shared runtime contracts/taxonomy,
contract tests, and this audit document; there is no active gesture simulator or
training pipeline.

The audit covered file and directory names containing `gesture`, `dataset`,
`model`, `checkpoint`, `onnx`, `feature-cache`, `benchmark`, notebook extensions,
and common model-checkpoint extensions (`.pt`, `.pth`, `.ckpt`, `.safetensors`).
The only matching source documents are the current gesture design and
implementation-plan documents under `docs/superpowers/`; those are specifications,
not training artifacts.

## Preserved, inactive product history

The following directories and archives are preserved as unrelated product history
and are forbidden as training or benchmark inputs:

- `Viscue-2.0-Production/` and `Viscue-2.0-Production.zip`
- `Viscue-3.0-React-Production/` and `Viscue-3.0-React-Production.zip`
- `Viscue-3.1-React-Production/` and `Viscue-3.1-React-Production.zip`
- `Viscue-3.2-React-Production/` and `Viscue-3.2-React-Production.zip`
- `Viscue-3.2-React-Production-Backend-Docs.zip`
- `Viscue-Local-Product.zip`
- `artifacts/` (prior UI/packaging/QA captures)
- `dist/` (generated extension output)

These paths may contain UI code, screenshots, source maps, or packaged product
files, but they are not gesture supervision and must not be mined for model
inputs, labels, metrics, or checkpoints. No files were deleted.

## Training-input rule

Future synthetic gesture work may use only newly generated, versioned artifacts
whose provenance is recorded by the gesture pipeline. Historical product copies,
their archives, generated `dist/`, and prior `artifacts/` remain outside the
training boundary unless a separate, explicit scope approves a new audit.

