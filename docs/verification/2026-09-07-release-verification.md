# Viscue Release Verification Report

**Date:** 2026-09-07  
**Version:** 3.3.0  
**Status:** PASSED  
**Scope:** Chrome extension Workspace, gesture runtime, reference preflights, multimodal compiler, model routing, production packaging, and target synchronization.

---

## 1. Test Matrix Summary

| Test Suite | Command | Total Tests | Passed | Failed | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Extension Unit Tests** | `node --test extension/tests/*.test.mjs` | 59 | 59 | 0 | **PASS** |
| **Gesture Runtime Tests** | `node --test gesture/tests/*.test.mjs` | 118 | 118 | 0 | **PASS** |
| **Local Server / Pipeline** | `node --test local-server/tests/*.test.mjs` | 49 | 49 | 0 | **PASS** |
| **Web Compiler & Auth** | `pnpm --dir web test` | 70 | 70 | 0 | **PASS** |
| **Gesture ML (Pytest)** | `pnpm test:ml` | 21 | 21 | 0 | **PASS** |
| **Total Automated Tests** | | **317** | **317** | **0** | **100% PASS** |

---

## 2. Model Routing & AI Integration Verification

| Subsystem / Model | Provider / Route | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Local Gesture Model** | ONNX Runtime (`gesture-resolver-v1.onnx`) | **VERIFIED** | 0.60 calibrated acceptance threshold, rejects non-finite logits, tested via `scripts/test-gesture-pipeline-e2e.mjs`. |
| **Still-Image Perception** | Qwen 3 VL (`qwen.qwen3-vl-235b-a22b`) | **VERIFIED** | Direct visible evidence extraction, verified via `scripts/test-ai.mjs`. |
| **Perception Fallback** | Amazon Nova Pro (`amazon.nova-pro-v1:0`) | **VERIFIED** | Vision fallback, verified via `scripts/test-nova.mjs`. |
| **Video Fallback** | Amazon Nova Lite (`amazon.nova-lite-v1:0`) | **VERIFIED** | Video fallback, verified via `scripts/test-nova.mjs`. |
| **Relevance Scoring** | Amazon Titan (`amazon.titan-embed-image-v1`) | **VERIFIED** | 1024-dimension embeddings, verified via `scripts/test-ai.mjs`. |
| **Multimodal Compiler** | Mistral Large 3 (`mistral.mistral-large-3-675b-instruct`) | **VERIFIED** | Converse API call, reverse verification for protected facts, deterministic fallback. |

---

## 3. Product Packaging & Distribution

- **Extension Build:** `pnpm build` completed in ~30s with Vite 7.3.6.
- **Web App Build:** `pnpm web:build` completed with Next.js 16.3.4 (Turbopack), optimizing 22 static/dynamic routes.
- **Package Policy Inspection:** `node scripts/verify-package.mjs dist/extension`
  - Total verified production files: **34**
  - Forbidden paths (`.env`, `.map`, `.csv`, `test/`): **0 found**
  - Credential assignments: **0 found**
  - Manifest version: **3.3.0 (verified)**
  - Runtime files present: `manifest.json`, `index.html`, `index.js`, `background.js`, `content.js`, `content.css`, `popup.html`, `popup.js`, `handoff-contract.js`.

---

## 4. Browser UI & User Flow Automation

Automated browser testing executed via `browser_subagent`:
1. **First-time launch:** Navigated to `index.html?destination=ChatGPT`. The blocking modal *"Choose your ChatGPT plan"* appeared with one-time setup copy and platform options (Free, Plus, Team, Pro, Business, Enterprise).
2. **Capability Selection:** Selected "Plus" plan. Limit updated dynamically to 10 visual references. Clicked "Continue to Workspace" to dismiss.
3. **Workspace Canvas:** Canvas loaded with ChatGPT destination pill.
4. **History Drawer:** Opened History panel. Confirmed title "History", "Import" button, and "Close history" button. Confirmed the dummy cleaner/broom button is completely removed.
5. **Popup Settings:** Navigated to `popup.html`. Opened Settings tab. Confirmed "AI platform plan" settings control is editable with ChatGPT subscription dropdown set to Plus.

---

## 5. Deployment & Target Synchronization Readiness

- **Git Remote:** `origin` points to `https://github.com/viscue-org/viscuefinal.git`. Branch `codex/history-popup-flows`.
- **Vercel:** Configuration synchronized in `vercel.json` with Next.js 16 App Router build.
- **Supabase:** Schema and RPC migrations verified. Bearer authentication client enforced.
- **Dodo Payments:** Checkout and webhook routes configured and covered by automated test suite (`checkout/route.test.ts`, `dodo/route.test.ts`).
