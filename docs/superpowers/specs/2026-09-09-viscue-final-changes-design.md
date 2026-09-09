# Viscue Final Changes: Quota, Workspace Relationships, Vision Gate, and Reference Engine

**Date:** 2026-09-09

**Status:** Approved direction; written specification pending final user review

**Product:** Viscue 3.3

**Purpose:** Consolidate the requested fixes and architecture rules for quota refresh, multi-node workspace editing, text and visual relationships, vision routing, reference selection, gesture-model quality, and final prompt synthesis.

## 1. Product status

Viscue's core application framework, account and signup flows, canvas workspace, and primary interaction tools are established after approximately six months of development. This change does not replace those foundations.

The current product focus is accuracy and reliability in four areas:

- annotation targeting and description quality;
- relationship creation between text and visual nodes;
- selection, dragging, dropping, and isolated text editing;
- faithful graph-to-prompt compilation with correct reference attachments.

## 2. Governing principles

1. Explicit user actions, text, selections, coordinates, and connections are authoritative.
2. Deterministic geometry and graph facts must not be replaced by model guesses.
3. A model is called only when its output is necessary for the requested result.
4. Generation/edit language can be passed through faithfully without first describing the visual.
5. When vision is necessary, local region detail and parent-image context are combined.
6. Final attachment selection occurs after prompt compilation so relevance is measured against the actual compiled request.
7. Missing model evidence cannot erase or weaken an explicit annotation or relationship.
8. Quota enforcement is server-authoritative, atomic, and identical for Free, Plus, and Pro apart from allowance.
9. Synthetic evaluation is reported as synthetic evidence and remains separate from real-human validation.

## 3. Current root causes

### 3.1 Quota refresh

The existing Supabase functions group usage by a UTC calendar date and report the next 00:00 UTC boundary. This is not a rolling 24-hour refresh. The account website also renders a server snapshot without scheduling a refresh when `resetsAt` is reached.

Expired reservations are not reclaimed inside `reserve_cue` before availability is calculated. A terminated request can therefore reduce the visible daily balance until another cleanup mechanism or date boundary intervenes.

### 3.2 Text and visual relationships

`TextNode.jsx` exposes handle IDs named `top`, `target`, `source`, and `bottom`, while the quick-add flow creates edges targeting `left`, `right`, `top`, or `bottom`. The right-side quick add therefore points to a target handle that does not exist.

`App.jsx` does not pass an `onConnect` handler to React Flow. Dragging a visible handle to another handle cannot persist a user-created relationship.

Text relationships created through the plus button support only right and bottom directions. They do not provide a consistent four-sided interaction model or editable flow labels.

### 3.3 Multi-selection and text editing

The canvas configures Shift as a selection key but also disables selection-on-drag. Interaction between panning and marquee selection is therefore unclear and unreliable.

Text values are controlled directly from the shared nodes array. The workspace context is recreated during text updates because `onAddConnectedText` is not stable. Editing one text node can consequently re-render every context consumer. Auto-resizing also updates node internals on each shared-state change, increasing the chance of cursor, selection, and edge-position disruption.

### 3.4 Vision and reference ordering

The current pipeline selects references before perception and prompt compilation. It then sends every selected visual with media to perception when Bedrock is available. There is no implemented deterministic vision-calling gate.

The current Titan relevance result is recorded as a stage but is not used to rank the final attachment set against the compiled Mistral prompt.

## 4. Target end-to-end pipeline

```text
User canvas action and Cue
        |
        v
Workspace extraction
  nodes + text + coordinates + explicit edges + gesture operations
        |
        v
Deterministic vision-calling gate
  no-vision edit path OR routed visual inspection
        |
        v
Semantic graph assembly
  authoritative user facts + optional grounded visual evidence
        |
        v
Prompt compilation
  Mistral preferred; deterministic canonical compiler fallback
        |
        v
Final reference engine
  required-reference rules + prompt relevance + impact + relationship + quality
        |
        v
Protected-fact verification
        |
        v
Destination handoff
  selected attachments first, verified prompt second
```

The quota reservation wraps the paid processing path. It is created before the first provider call, committed only when compilation succeeds, and released idempotently on controlled failure.

## 5. Rolling 24-hour quota refresh

### 5.1 Product behavior

- Free: 9 Cues per rolling 24-hour window.
- Plus: 28 Cues per rolling 24-hour window.
- Pro: 99 Cues per rolling 24-hour window.
- A user's first accepted reservation after an expired window starts a new window.
- `window_ends_at` equals `window_started_at + interval '24 hours'`.
- When the window expires, the next account-summary or reservation transaction atomically opens a fresh window with zero consumed and zero reserved Cues.
- Plan changes retain usage already consumed in the active window. Remaining is `max(0, effective allowance - consumed - reserved)`.
- Unused Cues do not roll over.

### 5.2 Data model

Replace calendar-day authority with an active usage-window model:

```text
usage_windows
  id uuid primary key
  user_id uuid not null
  window_started_at timestamptz not null
  window_ends_at timestamptz not null
  status active|closed
  consumed integer not null default 0
  reserved integer not null default 0
  partial unique index on user_id where status = active

cue_reservations
  id uuid primary key
  user_id uuid not null
  usage_window_id uuid not null
  request_key text not null
  status reserved|committed|released|expired
  created_at timestamptz not null
  expires_at timestamptz not null
```

Existing `usage_daily` rows remain immutable migration history. At deployment, a current-day row becomes one transition window beginning at that day's 00:00 UTC and ending exactly 24 hours later, with its consumed and reserved counts preserved. This prevents duplicate Cues during migration. A user without current usage gets no window until the first accepted reservation.

### 5.3 Atomic reservation behavior

`get_account_summary` and `reserve_cue` use the same server-owned helper to:

1. lock the user's active window;
2. expire stale `reserved` reservations and decrement `reserved` exactly once;
3. close an elapsed window;
4. create the next 24-hour window when an accepted reservation requires it;
5. derive the active plan from server-controlled subscription rows;
6. calculate allowance and remaining capacity;
7. reserve or return the authoritative summary.

Before the first Cue, account summary returns the full allowance with `windowStartedAt: null` and `resetsAt: null`; the UI says that the 24-hour window starts with the next Cue. Once a window exists, the extension and website use `resetsAt` from the server. They schedule a refresh at that timestamp, refresh again when becoming visible, and never manufacture quota locally. The compile endpoint remains authoritative if a client display is stale.

## 6. Workspace relationship system

### 6.1 Supported relationships

| Source | Target | Semantic meaning | Graph representation |
| --- | --- | --- | --- |
| Visual | Text | Text annotates or instructs a visual/region | existing Cue binding |
| Text | Text | Brainstorming or flowchart direction | `FLOWS_TO` |
| Visual | Visual | Transfer, compare, or cross-asset edit relation | `CROSS_ASSET_ANNOTATION` |
| Text | Visual | A text step applies to or leads to a visual | `APPLIES_TO` |

One node can have multiple incoming and outgoing relationships. Valid branching, merging, and cycles are allowed because brainstorming workflows are not always directed acyclic graphs.

### 6.2 Connection interaction

- Every text node exposes four canonical handle IDs: `top`, `right`, `bottom`, and `left`.
- Each quick-add plus button uses the exact source and target handle IDs rendered by the nodes.
- Plus buttons are available on all four sides of the selected text node.
- Quick add creates one neighboring text node and one valid `FLOWS_TO` edge in a single undoable transaction.
- Dragging any valid node handle to another valid handle is persisted through React Flow `onConnect`.
- Connection type is derived deterministically from source and target node types.
- Self-connections and exact duplicate edges are rejected with a visible explanation.
- Multiple distinct relationships between the same nodes are allowed only when their semantic type or label differs.
- Text-flow edges support an optional short label such as `yes`, `no`, `then`, `else`, or a user-authored relationship description.
- Deleting a node removes its incident edges. Deleting an edge never deletes either endpoint.

React Flow's controlled state remains the interaction authority. Handle IDs are never inferred from their visual position.

### 6.3 Graph serialization

Every serialized relationship contains stable endpoint IDs, handle IDs, direction, type, optional label/instruction, and provenance:

```json
{
  "id": "edge_uuid",
  "type": "FLOWS_TO",
  "sourceId": "text_a",
  "sourceHandle": "right",
  "targetId": "text_b",
  "targetHandle": "left",
  "label": "then",
  "provenance": {
    "kind": "explicit_connection",
    "confidence": 1.0
  }
}
```

An accepted gesture-model relationship includes calibrated model confidence in provenance. It cannot replace an explicit endpoint or handle chosen by the user.

## 7. Multi-selection, dragging, dropping, and editing

### 7.1 Selection contract

- Shift plus left-drag draws a partial-intersection marquee.
- Control/Command plus click adds or removes a node from the current selection.
- Dragging any selected node moves the full selected group while preserving relative positions.
- Space plus left-drag, middle-drag, or right-drag pans the workspace without modifying selection.
- Clicking an empty pane without a modifier clears selection.
- Delete/Backspace removes all selected, unlocked nodes and their incident edges in one undoable action.
- Locked nodes remain selected but do not move or delete; the UI reports how many locked nodes were skipped.
- Dropped files are placed at the pointer's flow-space location and do not unexpectedly move existing selected nodes.

### 7.2 Isolated text editing

- Each `TextNode` owns a local draft while its textarea is active.
- Editing updates only the active node. It cannot replace, clear, resize, or deselect another text node.
- The first edit in a focus session creates one undo snapshot. Keystrokes do not create one snapshot each.
- Draft changes synchronize to graph state with a short debounce; blur and Cue submission flush immediately.
- Textarea pointer events remain `nodrag` and `nowheel` so selecting text cannot move the node.
- Node height changes call `useUpdateNodeInternals(id)` only for that node.
- Workspace callbacks and context values are memoized so one node's keystroke does not re-render every node unnecessarily.
- Multi-selection can remain visible while one text node is the active editor; typing changes only the active editor.

## 8. AI vision-calling logic

### 8.1 Deterministic gate

The gate classifies the requested operation, not a finite list of exact phrases.

```text
IF the request is a generation/edit instruction that the destination model can
perform from user text + attachment + target coordinates/relationship
THEN do not call the Viscue vision model
ELSE call the vision route required by the visual type
```

The no-vision generation/edit class includes ordinary variations of:

- make it larger, smaller, clearer, darker, lighter, or a named color;
- move, align, remove, replace, copy, rotate, crop, emphasize, or restyle it;
- modify the main character, background, foreground, subject, object, or selected region;
- transfer a named style, layout, color, or visual property through an explicit connection;
- follow an explicit flowchart or relationship instruction.

Terms such as `main character` do not by themselves force Viscue perception. The destination receives the relevant attachment and the user-authored wording. Viscue does not spend a vision call merely to paraphrase what the destination model can inspect.

Vision is required when Viscue must inspect content to create a faithful prompt or score, including:

- identify, read, count, compare, describe, or locate an unnamed visual entity;
- resolve an ambiguous target when neither coordinates nor an explicit connection identify it;
- extract content-dependent attributes that the user did not provide;
- determine which of multiple possible regions satisfies a semantic condition;
- understand video action, temporal change, or event sequence not already specified by the user;
- recover missing relationship context needed before prompt compilation.

If a request is safely expressible without vision, low confidence in an optional classifier does not trigger a provider call. If the gate is genuinely ambiguous, it chooses the vision path and records the reason.

### 8.2 Provider routing

| Visual type | Primary processing route |
| --- | --- |
| Still image, rendered document page, webpage capture | Qwen vision route on Amazon Bedrock |
| Extracted still video frame with no temporal question | Qwen vision route on Amazon Bedrock |
| Video clip, temporal range, motion, or event sequence | Amazon Nova video route on Bedrock |

Configured provider fallback remains explicit in the execution ledger. A fallback result is never presented as primary-model success.

### 8.3 Visual input scope

When vision is called:

- A whole-image question processes the whole image.
- A region annotation processes a high-detail crop plus reduced parent-image context.
- The crop includes bounded padding so an imprecise annotation does not cut off the subject.
- A cross-image relation processes only the relevant source and target visuals or annotated regions, maintaining separate asset IDs.
- A video request processes the user-selected temporal range or bounded sample frames, not an unrestricted original video.
- Whole-image evidence is cached by content hash and model version.
- Region evidence is cached by content hash, normalized bounds, temporal range, and model version.

This hybrid region-plus-context design preserves local detail without discarding global scene information. General scene descriptions are fallback context. Evidence prioritizes the annotated subject, relevant primary character/object, visible attributes, spatial context, and confidence.

### 8.4 Normalized evidence

Vision output is evidence, not a free-form replacement prompt:

```json
{
  "assetId": "asset_uuid",
  "region": [0.20, 0.15, 0.55, 0.80],
  "subject": "central character in a red coat",
  "attributes": ["red coat", "front-facing"],
  "spatialContext": "foreground center",
  "importance": 0.86,
  "confidence": 0.91,
  "provider": "qwen",
  "modelVersion": "configured-model-id"
}
```

Unknown facts remain unknown. The system never invents an object merely to satisfy a requested schema.

## 9. Semantic graph assembly

The semantic graph merges:

- node identity, type, position, size, lock/preserve state, and visual metadata;
- user-authored text and edge labels;
- explicit Cue coordinates, areas, and temporal ranges;
- deterministic manual relationships;
- accepted gesture intent and calibrated relationship confidence;
- optional Qwen/Nova evidence with provenance and confidence;
- derived video-frame and document-page provenance.

User-authored values win conflicts. Model observations may enrich an unnamed region but cannot rewrite text, coordinates, selected endpoints, or preserve constraints.

## 10. Prompt compilation

Mistral receives the complete semantic graph and available grounded evidence before final attachment selection. It produces concise generation/edit instructions while preserving:

- exact filenames or stable user-visible asset names;
- coordinates, regions, timestamps, and temporal ranges;
- text-flow ordering and edge labels;
- cross-image source and target direction;
- preserve/lock constraints;
- user-authored wording when paraphrase could alter meaning.

Mistral does not have authority to create node IDs, edges, required references, or unsupported visual facts. The deterministic canonical compiler remains the fallback when Mistral is unavailable or its output fails protected-fact verification.

## 11. Final reference engine

### 11.1 Stage ordering

The final reference engine begins after Mistral prompt generation, or after deterministic prompt fallback. A cheap pre-compilation scope filter may exclude visuals with no selection, connection, annotation, preserve state, or relevance to the original user instruction; that filter is not the final attachment decision.

The engine then:

1. enumerates image, video, frame, document-page, and webpage visuals in scope;
2. reads deterministic dimensions, encoded transport size, type, and graph connectivity;
3. reads explicit and gesture-derived relationship strength;
4. reads vision importance only when the visual was legitimately processed by the vision gate;
5. measures semantic relevance against the compiled prompt;
6. applies required-reference rules;
7. ranks optional references and selects within the effective destination limit;
8. returns selected and trimmed manifests with score explanations.

### 11.2 Authority boundaries

- Pixel dimensions and encoded byte size come from media metadata, not the gesture model.
- Manual connections have relationship confidence `1.0`.
- Accepted gesture connections contribute their calibrated confidence.
- The gesture model cannot invent an endpoint, file size, or importance score.
- Vision importance is optional evidence and cannot demote an explicitly required reference.
- Destination capability and Viscue plan limits are enforced independently and server-side.

### 11.3 Required references

A visual is required when it is:

- directly annotated by a non-empty instruction;
- an endpoint of an explicit cross-visual relationship used by the prompt;
- explicitly locked/preserved;
- named by an authoritative user instruction whose meaning depends on attachment.

If required references exceed the effective attachment limit, compilation blocks and asks the user to remove or merge references. The engine never silently trims required evidence.

Every visual explicitly named by the verified compiled prompt must appear in the selected manifest. A prompt cannot refer to a visual that will not be attached. If this invariant would exceed the attachment limit, compilation blocks instead of sending an incomplete prompt.

### 11.4 Optional impact score

Optional references use a normalized score over available signals:

```text
30% explicit intent strength
25% relationship strength
20% vision importance, when vision legitimately ran
15% relevance to the compiled prompt
10% usable visual quality and resolution
```

When vision did not run, the 20% vision weight is removed and the remaining available weights are normalized to 100%. A no-vision generation edit is therefore not penalized.

Ties are resolved deterministically by required status, workspace order, and stable asset ID. Encoded byte size is a transport constraint, not a proxy for semantic importance.

### 11.5 Output manifest

Each decision records enough non-sensitive evidence to explain the result:

```json
{
  "id": "asset_uuid",
  "selected": true,
  "required": false,
  "score": 0.78,
  "signals": {
    "explicitIntent": 0.8,
    "relationship": 0.9,
    "visionImportance": null,
    "promptRelevance": 0.7,
    "visualQuality": 0.6
  },
  "reason": "Strong connection to a selected flow and relevant to the compiled prompt"
}
```

## 12. Gesture model and synthetic data

### 12.1 Role

The gesture model resolves user intent patterns, relationship gestures, deletion sequences, annotation entry/exit trajectories, and other supported gesture families. Deterministic hit testing binds accepted intent to real nodes and handles.

### 12.2 Dataset update

The next synthetic-data revision expands production-shaped cases for:

- text-to-text chains, branches, merges, and cycles;
- visual-to-text Cue relationships;
- text-to-visual and visual-to-visual relationships;
- multiple images with similar subjects;
- main-character, foreground, background, and unnamed-subject requests;
- incomplete, reversed, overshot, corrected, and cancelled connections;
- crowded canvases, overlapping nodes, varied zoom, and multi-selection;
- mouse, trackpad, stylus, and touch behavior;
- same gesture geometry with different valid canvas contexts;
- no-vision versus vision-required gate examples, stored outside gesture-model inference features.

Generation remains causal: persona and canvas context produce an action; ground-truth labels do not generate shortcut features.

### 12.3 Quality and evaluation gates

- Reject impossible gesture/world combinations before dataset publication.
- Audit exact and near duplicates across protected splits.
- Keep persona, seed, template, and mechanism groups isolated across train and protected evaluation splits.
- Report accepted precision, coverage, macro F1, per-intent recall, confusion matrices, OOD false-accept rate, calibration error, and p50/p95 latency.
- Compare the new model against the currently shipped model on the same frozen protected sets.
- Publish per-intent deltas so an overall gain cannot hide relationship regressions.
- Require ONNX parity and browser latency checks before packaging.
- Keep model status `SyntheticQualified` until separate real-human validation passes.

## 13. Failure and fallback behavior

- Quota unavailable or exhausted: fail before calling any provider and preserve the local workspace.
- Vision gate says no vision: record a `skipped` perception stage with deterministic reason `generation_edit_sufficient`.
- Qwen/Nova failure: retain user facts, mark perception degraded, and continue only when the prompt remains faithful without invented evidence.
- Ambiguous target with failed required vision: block and ask the user to annotate or name the target more precisely.
- Mistral failure or protected-fact loss: use the deterministic canonical prompt.
- Reference score unavailable: rank from explicit intent, graph relationships, and stable deterministic order.
- Required references above limit: block; do not silently remove one.
- Invalid or duplicate edge: reject it without changing existing nodes or relationships.
- Text sync failure: keep the active local draft and show that it has not yet been committed.

## 14. Verification strategy

Implementation follows red-green-refactor test-driven development.

### 14.1 Quota tests

- rolling boundary immediately before, at, and after exactly 24 hours;
- all three plan allowances;
- concurrent final reservation at the limit;
- stale reservation expiry and idempotent decrement;
- plan upgrade/downgrade within an active window;
- account summary and reserve path returning the same window and reset time;
- website and extension refresh at `resetsAt`.

### 14.2 Workspace tests

- every plus button creates an edge using rendered handle IDs;
- manual visual/text and text/text connections persist;
- branching, merging, cycles, duplicate rejection, and self-edge rejection;
- Shift marquee, Control/Command additive selection, and group drag;
- locked-node behavior inside mixed selections;
- editing one text node leaves all other text values, selection, positions, and sizes unchanged;
- undo/redo for a text edit, quick-add pair, group move, and group delete;
- saved/restored workspaces preserve every relationship field.

### 14.3 Vision-gate tests

- broad paraphrase fixtures for generation edits remain no-vision;
- `main character` generation edits remain no-vision when the attachment and user relationship are sufficient;
- identification, comparison, OCR, ambiguous target, and temporal-understanding requests route to vision;
- images route to Qwen and temporal video routes to Nova;
- annotated regions send crop plus parent context;
- cross-image relations preserve separate asset identities;
- cached evidence invalidates after content, bounds, temporal range, or model-version change.

### 14.4 Reference and prompt tests

- prompt compilation completes before final reference ranking;
- explicit required references survive every optional score variation;
- no-vision visuals are not penalized by a missing vision score;
- manual and gesture relationship scores obey their authority boundaries;
- ranking is stable for ties;
- attachment limits block required overflow and trim only optional references;
- final prompt changes when relevant graph relationships change;
- filenames, coordinates, timestamps, labels, and preserve constraints survive Mistral compilation and reverse verification.

### 14.5 Release checks

- root, web, gesture, and ML test suites;
- extension and web production builds;
- deterministic browser scenarios for selection, connection, persistence, compilation, and handoff;
- opt-in bounded live checks for Qwen, Nova, Titan, Mistral, and authenticated quota behavior;
- package and secret scanning;
- migration verification in a non-production Supabase environment before promotion.

## 15. Rollout sequence

1. Add pure relationship, vision-gate, and reference-score models with unit tests.
2. Repair canonical handles, manual connection persistence, and graph serialization.
3. Add isolated text drafts and multi-selection/group-motion behavior.
4. Add the rolling quota migration and refresh scheduling.
5. Insert the deterministic vision gate and Qwen/Nova routing.
6. Reorder compilation so final reference ranking follows Mistral or deterministic prompt generation.
7. Add impact and relationship scoring with decision explanations.
8. Expand and audit the synthetic gesture corpus; train and compare candidates without replacing the shipped model automatically.
9. Run browser, provider, quota, build, security, and packaging verification.
10. Promote database, web, API, and extension artifacts only from the same verified source revision.

## 16. Acceptance criteria

1. Every plan refreshes to its full allowance exactly when its rolling 24-hour window expires.
2. Server enforcement and every client display report the same remaining count and reset time.
3. Users can connect visuals to text and text to multiple text nodes through quick-add and drag-to-connect.
4. All four text-node plus buttons create correctly anchored, persistent relationships.
5. Users can marquee-select, add to selection, drag groups, and delete groups without corrupting locked nodes.
6. Editing one text node cannot change or destabilize another text node.
7. Ordinary generation/edit instructions, including main-character edits, do not call Viscue vision when user text and graph targeting are sufficient.
8. Content inspection routes images to Qwen and temporal video to Nova.
9. Region inspection uses both the annotated crop and parent context.
10. Multi-image relationships retain distinct source and target identities in evidence, graph, prompt, and attachments.
11. Mistral or its deterministic fallback finishes before the final reference engine runs.
12. Final attachment selection uses required rules plus explicit intent, relationship, optional vision impact, compiled-prompt relevance, and visual quality.
13. Required references are never silently trimmed.
14. Prompt verification preserves all authoritative text, coordinates, temporal facts, filenames, relationship labels, and constraints.
15. Gesture-model promotion requires protected-split improvements, no critical per-intent regression, ONNX parity, browser latency compliance, and honest synthetic-only labeling.

## 17. Non-goals

- Asking vision to paraphrase every generation instruction.
- Describing every image in the workspace by default.
- Letting Mistral or a vision model invent graph endpoints.
- Treating file byte size as semantic importance.
- Allowing model scores to override explicit user selections or required relationships.
- Uploading original workspace media, gesture recordings, or synthetic training data to application storage.
- Claiming production gesture accuracy from synthetic evaluation alone.

## 18. Research basis

- React Flow controlled interaction, connections, handles, and multi-selection: <https://reactflow.dev/learn/concepts/adding-interactivity>, <https://reactflow.dev/learn/customization/handles>, <https://reactflow.dev/api-reference/react-flow>
- Region-level visual grounding: <https://arxiv.org/abs/2307.03601>
- Combined local and global visual context: <https://arxiv.org/abs/2407.16198>
- High-resolution detail and token/cost trade-offs: <https://llava-vl.github.io/blog/2024-01-30-llava-next/>
- Multi-image reasoning limitations: <https://arxiv.org/abs/2406.12742>
- Multi-image pixel-grounded reasoning: <https://arxiv.org/abs/2412.15209>
- Supabase database-function and security-definer guidance: <https://supabase.com/docs/guides/database/functions>, <https://supabase.com/docs/guides/database/postgres/row-level-security>
