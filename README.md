# Viscue

Viscue is a React-powered Chrome extension that opens a full-page spatial canvas for building precise visual instructions for AI chats.

## What is included

- A Vite + React Manifest V3 Chrome extension with a persistent full-page React Flow workspace.
- Composer entry points for ChatGPT, Gemini, Claude, Copilot, Perplexity and Grok.
- Asset support for multiple images, videos, documents, webpage URLs and current-page captures.
- Drag-to-Annot connections, free Text nodes, Pen/Highlighter/Eraser drawing, image cropping, type-specific selection actions, zoom, fit, clear, undo and redo.
- Production video intent flow: exact-time frame extraction, start/end intent ranges, native-resolution derived frames, and `FRAME_OF` / `AT_TIME` provenance that survives parent deletion safely.
- Ordered automatic handoff: Viscue attaches every required reference, waits until uploads finish, inserts the compiled intent, and only then enables or performs final submission.
- A local VICSUC orchestrator that routes still visuals to Qwen, video to Amazon Nova, relevance to Titan multimodal embeddings, and optional prompt wording to Mistral through Bedrock.
- A provider-neutral commercial font-identification gateway. Exact font names remain unknown unless a configured provider exceeds the acceptance threshold.
- Reverse-failure verification and destination receipts. Provider failures degrade to deterministic output; required-reference or handoff-integrity failures block safely.

## Run locally

1. Open a PowerShell window in this directory and import the supplied AWS CSV files **locally**:

   ```powershell
   & 'C:\Users\witne\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\local-server\configure-local.mjs `
     -AccessKeyCsv 'C:\Users\witne\Downloads\newtryvis_accessKeys.csv' `
     -BedrockKeyCsv 'C:\Users\witne\Downloads\newtryvis-bedrock-api-keys.csv'
   ```

   This writes `.viscue-local.env`, which is ignored by Git. Review it before starting the service. Do not move either CSV into `extension/`.

2. Start the local compiler service:

   ```powershell
   & 'C:\Users\witne\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\local-server\server.mjs
   ```

3. Build the production extension:

   ```powershell
   & 'C:\Users\witne\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' install
   & 'C:\Users\witne\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' build
   ```

4. In Chrome, open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked**, and select the [`dist/extension`](./dist/extension) folder.

5. Open a supported AI chat. Click **Open Viscue** beside its composer or use the extension icon. Viscue opens as a full-page React application in a Chrome tab.

## Core workflow

1. Use **Asset** to add multiple Images, Videos, Documents, Webpage URLs, or a current-page capture.
2. Use **Annot → Annotate**, press the exact point on an Asset, drag outward, and release where the connected Text instruction should appear.
3. Use **Text**, then click anywhere on the canvas to add a free instruction.
4. Use **Annot → Pen / Highlighter / Eraser** for direct markup on the selected Asset.
5. Select an Image or extracted frame to access **Crop**, **Annot**, and **Delete**.
6. Select a Video to access **Extract frame**, **Edit video**, **Annot**, and **Delete**. Edit video sets the exact temporal range used for understanding; Extract frame creates a clean, editable image with its timestamp and parent-video lineage.
7. Choose **Send intent**, then **Prepare VICSUC review**. Review selected/trimmed references and every stage status before attaching anything.
8. Continue the handoff. Viscue attaches clean originals, waits for readiness, verifies the exact prompt and destination conversation, and only then optionally submits.

## VICSUC reference policy

- Free allows 2 physical references, Pro 10, and Plus 20. A frame whose parent video is present counts with that parent rather than as a second physical reference.
- Cues, cross-reference relationships, motion intent, and Preserve roles make a reference required. If required references exceed the plan, compilation blocks before any provider call.
- Optional references are ranked deterministically and may be trimmed. Required references are never silently removed.
- User-authored roles, coordinates, regions, timestamps, and relationships are authoritative. Model output is evidence with provenance and confidence; unknown facts stay unknown.

## Video algorithm contract

- Uploading a video stores it without inventing scene meaning.
- **Extract frame** captures the current native video pixels, exact `time_ms`, parent resolution, and a SHA-256 content hash.
- The derived frame is represented as `FRAME_OF` the video and `AT_TIME` the captured timestamp. Crop and Annot operate on that clean still.
- **Edit video** records an intent-bounded start/end range. It does not destructively rewrite the source video or pretend Viscue is a production video editor.
- If a parent video is deleted, extracted frames remain available and are marked detached, so downstream compilation never claims a missing parent is still attached.

## Model and font configuration

The companion service supports `AWS_BEARER_TOKEN_BEDROCK` or SigV4 with `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`. `configure-local.mjs` writes these default routes to the local environment file:

| Variable | Purpose |
| --- | --- |
| `QWEN_MODEL_ID` | Qwen3-VL still-image, region, object, OCR, and layout evidence. |
| `NOVA_PRO_MODEL_ID` | Primary video understanding and still-image fallback. |
| `NOVA_LITE_MODEL_ID` | Video fallback. |
| `TITAN_EMBED_MODEL_ID` | Image/text relevance. |
| `BEDROCK_MODEL_ID` | Mistral wording compiler; deterministic canonical wording remains the fallback. |
| `FONT_PROVIDER_URL` / `FONT_PROVIDER_API_KEY` | Optional commercially licensed font API. |
| `FONT_MATCH_THRESHOLD` | Exact-match threshold, default `0.90`. |

Use `GET http://127.0.0.1:8787/capabilities` to see configured model routes without exposing credentials. MixFont Lens is intentionally not bundled because its published weights are noncommercial. When the font service is absent or uncertain, Viscue emits generic typography guidance rather than inventing a font family.

## Verification and packaging

```powershell
pnpm test
pnpm build
node .\scripts\verify-package.mjs dist\extension
```

The verifier rejects source maps, environment/CSV files, tests, legacy side-panel artifacts, credential assignments, an incorrect manifest version, or missing runtime files.

## Security boundary

The extension calls only `http://127.0.0.1:8787`. It never reads CSV files or stores AWS credentials. The local service accepts requests only from localhost and Chrome extension origins. Before sharing or packaging the project, remove `.viscue-local.env` and rotate any credentials that may have been exposed outside your machine.
