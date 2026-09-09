# Viscue Final Changes: Quota, Unified Instructions, Annotation, Text Flows, Vision Gate, and Reference Engine

**Date:** 2026-09-09

**Status:** Final consolidated specification pending user review

**Product:** Viscue 3.3

**Purpose:** Consolidate the requested fixes and architecture rules for quota refresh, low-friction annotation and markup, sketch and comment inputs, text-first brainstorming and flow creation, multi-node workspace editing, text and visual relationships, vision routing, reference selection, gesture-model quality, and final prompt synthesis.

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
10. Users express intent before choosing structure: one contextual instruction composer replaces a toolbar of competing annotation modes.
11. Text, markup, selection, sketch, and relationships are complementary evidence inside one instruction, not isolated workflows the user must assemble manually.
12. Automatic interpretation is confidence-gated, visibly previewed, reversible, and never destroys the raw user input.

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

### 3.5 Annotation and brainstorming cognitive load

The current annotation toolbar exposes Point, Whole image, Area, Draw, and Erase as peer modes. This requires the user to understand Viscue's internal representation before expressing an idea. The hidden corner-click shortcut can silently change a point into a whole-asset target, and the Area gesture captures a freehand path but stores only its rectangular bounds. Both behaviors weaken predictability because the saved meaning does not visibly match the action.

Annotation, markup, comments, sketches, text notes, and graph relationships also behave as separate objects that users must connect manually. That is too much assembly for a rapid brainstorming workflow. The target experience is one continuous loop: select, mark, sketch, or type in any order; Viscue combines the evidence into one instruction and shows its interpretation.

## 4. Target end-to-end pipeline

```text
User canvas action and Cue
        |
        v
Workspace extraction
  nodes + text + coordinates + explicit edges + selections + markup + sketches
        |
        v
Instruction resolution
  target scope + reference roles + text-flow structure + confidence
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

### 6.4 One contextual instruction composer

Viscue exposes one persistent composer using plain language such as `Tell Viscue what you want...`. Point, Region, Whole image, Link, and Flowchart are not required top-level modes.

The composer adapts to current context:

| Current context | Default behavior | Visible summary |
| --- | --- | --- |
| Nothing selected | Create an idea, note, sketch request, or text-described flow | `New idea` |
| One text node selected | Continue, branch, rewrite, or relate that idea | `Continuing from: <title>` |
| One visual selected | Create an instruction applying to that visual | `1 visual selected` |
| Multiple visuals selected | Create one instruction over the selected reference set | `<n> visuals selected` |
| Mixed text and visual selection | Explain a semantic or generation relationship across all selected nodes | `<n> items selected` |
| Existing region or markup selected | Add or edit the instruction attached to that spatial evidence | `Applies to: <plain-language target>` |

Selecting nodes never forces immediate execution. The instruction remains an editable draft until the user triggers the existing Cue action.

### 6.5 Annotation, comment, markup, and sketch meanings

The four concepts remain distinct internally while sharing the same composer:

| Concept | Meaning | Starts where | Stored authority |
| --- | --- | --- | --- |
| Instruction/comment | What the user wants, asks, or explains | Composer attached to current selection | User-authored text |
| Markup | Where or how an instruction applies within an existing visual | Existing image, video frame, document page, or webpage capture | Raw stroke, point, region, arrow, and normalized coordinates |
| Selection | Which existing nodes or assets participate | Workspace nodes or visible asset regions | Stable selected node and asset IDs |
| Sketch | What a desired composition, movement, shape, or new result should resemble | Blank canvas or explicit `Sketch idea` action | Separate visual-reference node and raw strokes |

A sketch is never silently treated as an editing mask. Markup over an existing asset is never silently treated as desired output content. Context establishes the default meaning; a visible interpretation lets the user correct it.

The interface uses plain-language scope labels:

- `This subject`
- `This area`
- `Whole image`
- `At this spot`
- `Current frame · 00:13.2`
- `Range · 00:13.2–00:16.8`

Technical labels such as `bounding box`, `semantic subject`, or `scope enum` do not appear in the primary workflow.

### 6.6 Low-friction spatial interaction

- Activating the instruction interaction displays one hint: `Click what you mean, then type.`
- Clicking inside an existing visual records a point first. Viscue may suggest a nearby detected subject but does not silently replace the point.
- Dragging over an existing visual records an area and displays a translucent fill, strong outline, and resize handles that match the stored region.
- A freehand stroke remains a freehand path. A derived bounding box may support routing but cannot replace the visible or serialized path.
- Clicking the asset frame or choosing the visible `Whole image` correction applies to the full asset. Corner proximity is never a hidden whole-image command.
- For video, playback pauses at the current frame when spatial markup begins. The default temporal scope is that frame. `Extend duration` exposes explicit range handles.
- After the gesture, the composer opens automatically. The target highlight remains visible while the user writes.
- The interpreted scope is shown before save. High-confidence interpretations apply automatically; medium-confidence cases show at most two contextual choices; low-confidence cases preserve the original point or area without guessing.
- Undo restores the complete previous instruction state, including text, targets, strokes, inferred roles, and relationships.

Markup primitives remain contextual controls inside the composer or selected visual, not permanent primary-toolbar modes. The minimal set is point, region, freehand, arrow, undo, and clear. Erasing part of a stroke is available only while editing markup; deleting a saved annotation uses ordinary object deletion.

### 6.7 Multi-reference instructions without manual wiring

Multi-selection is the primary way to create one instruction involving several images, videos, text nodes, or sketches. After the user writes, the resolver proposes roles such as `subject`, `style`, `layout`, `destination`, `preserve`, or `comparison` and displays one readable relationship summary.

Example:

```text
User input: Use the woman from image 1, the lighting from image 2,
and the layout from this sketch.

Visible interpretation:
Image 1: Subject  |  Image 2: Lighting  |  Sketch 1: Layout
```

Accepted roles create stable graph edges automatically. Users can click a role chip to correct it. Manual connector dragging remains an advanced shortcut, not a prerequisite.

### 6.8 Text-first brainstorming and flow construction

Text nodes are first-class semantic graph nodes. A user can type or paste a paragraph, bullet list, numbered sequence, or conditional explanation. Viscue proposes a reversible flow without requiring the user to choose shapes, gates, or connector types.

Common language maps to graph semantics:

| Language pattern | Proposed graph meaning |
| --- | --- |
| `then`, `next`, numbered steps | `FLOWS_TO` sequence |
| `if`, `when`, `otherwise`, `else` | decision with labeled branches |
| `because`, `causes`, `therefore` | causal relationship |
| `depends on`, `requires`, `blocked by` | dependency |
| `compared with`, `versus` | comparison |
| `use image`, `same character`, `style from` | typed reference relationship |

The generated structure first appears as an undoable preview. The system reuses user wording, avoids unnecessary splitting, and never converts an uncertain sentence into a destructive graph edit.

Each saved text node exposes visible `+ Next` and `+ Branch` actions. Optional keyboard acceleration is:

- Enter from a completed compact idea card: create the next connected card.
- Tab from a completed compact idea card: create a child branch.
- Shift+Enter while editing: insert a line break.
- Escape: finish editing without creating another node.

The shortcut behavior applies only to compact flow cards and is shown in the composer hint. Expanded paragraph notes retain standard multiline editing behavior.

Text relationships are stored by stable node and edge IDs. Editing content, resizing a card, moving a selection, or running automatic layout cannot recreate the node or detach its edges. Automatic layout respects manually pinned positions and can be reverted as one transaction.

### 6.9 Unified instruction bundle

Every Cue-ready instruction serializes its evidence in one bundle:

```json
{
  "id": "instruction_uuid",
  "text": "Put the character from image 1 into the marked area in image 2",
  "targetIds": ["image_1", "image_2"],
  "markups": [
    { "assetId": "image_1", "kind": "freehand", "points": [] },
    { "assetId": "image_2", "kind": "area", "bounds": [0.55, 0.20, 0.85, 0.78] }
  ],
  "sketchIds": [],
  "relationships": [
    { "type": "SUBJECT_FROM", "sourceId": "image_1", "targetId": "image_2" }
  ],
  "interpretation": {
    "summary": "Character from image 1 to marked area in image 2",
    "confidence": 0.93,
    "status": "accepted"
  }
}
```

Raw text, geometry, stroke paths, and selected IDs remain authoritative even when the interpreted summary changes.

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
- apply an edit to an authoritative user-drawn point, area, path, arrow, or selected asset set;
- use an explicit sketch as a composition or layout reference when no additional content identification is required.

Terms such as `main character` do not by themselves force Viscue perception. The destination receives the relevant attachment and the user-authored wording. Viscue does not spend a vision call merely to paraphrase what the destination model can inspect.

Vision is required when Viscue must inspect content to create a faithful prompt or score, including:

- identify, read, count, compare, describe, or locate an unnamed visual entity;
- resolve an ambiguous target when neither coordinates nor an explicit connection identify it;
- extract content-dependent attributes that the user did not provide;
- determine which of multiple possible regions satisfies a semantic condition;
- understand video action, temporal change, or event sequence not already specified by the user;
- recover missing relationship context needed before prompt compilation.
- resolve whether a point refers to a particular semantic subject after the user requests subject-level targeting;
- interpret visually ambiguous freehand markup whose meaning cannot be established from geometry, context, and instruction text.

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
- A sketch remains a separately identified reference and is never merged into the target image before evidence extraction.
- Freehand markup is supplied as geometry and, when supported, as an overlay copy; the unmodified parent visual remains available as context.
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
- instruction bundles containing selected targets, raw markup, sketches, interpreted reference roles, and confidence state;
- proposed or accepted text-flow nodes, decision branches, causal links, dependencies, and comparisons.

User-authored values win conflicts. Model observations may enrich an unnamed region but cannot rewrite text, coordinates, selected endpoints, or preserve constraints.

## 10. Prompt compilation

Mistral receives the complete semantic graph and available grounded evidence before final attachment selection. It produces concise generation/edit instructions while preserving:

- exact filenames or stable user-visible asset names;
- coordinates, regions, timestamps, and temporal ranges;
- text-flow ordering and edge labels;
- cross-image source and target direction;
- preserve/lock constraints;
- user-authored wording when paraphrase could alter meaning.
- the distinction between markup as spatial guidance and sketch as desired visual guidance;
- accepted multi-reference roles such as subject, style, layout, destination, comparison, and preserve;
- text-to-flow structure, decision labels, and causal direction.

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

Gesture interpretation follows context before shape. A circle drawn over an existing image is candidate markup; a similar circle inside a blank sketch node is sketch content. Geometry alone cannot decide between edit target, desired output shape, deletion, or relationship intent.

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
- point, box, freehand, circle, underline, cross-out, and arrow markup paired with confirming or contradicting text;
- sketch-versus-markup cases with identical strokes but different start surfaces;
- text-to-flow sequences, branches, dependencies, comparisons, and deliberately ambiguous prose;
- multi-reference instructions where roles are explicit, implicit, corrected, or cancelled;
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
- Ambiguous markup meaning: preserve the raw geometry and ask one contextual clarification instead of guessing.
- Low-confidence text-flow parse: keep the source text intact and show a preview rather than mutating the graph.
- Sketch/markup classification conflict: use the start surface as the default, show the interpreted role, and allow one-click correction.
- Automatic relationship failure: retain all selected nodes in the instruction bundle and expose editable role chips; never discard a selected reference.

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
- selecting one or many visuals opens one composer with the correct target chips;
- point, area, whole-asset, freehand, and arrow inputs retain matching visible and serialized geometry;
- corner clicks never silently become whole-asset annotations;
- freehand paths are not replaced by derived rectangular bounds;
- sketch strokes and image markup remain separate reference types;
- high-, medium-, and low-confidence target resolution produce the specified automatic, two-choice, and preserve-without-guessing states;
- one instruction can bind multiple text, visual, video, and sketch nodes without manual edge drawing;
- role corrections update graph semantics without changing raw user text or selections;
- text paragraphs, lists, and conditions produce reversible sequence and branch previews;
- `+ Next`, `+ Branch`, compact-card shortcuts, and multiline-note behavior do not conflict;
- editing, resizing, moving, grouping, or auto-layout cannot detach text-flow edges.

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
2. Introduce the unified instruction-bundle schema and migrate existing annotations without changing their raw coordinates or text.
3. Replace competing primary annotation modes with the contextual composer, matching spatial feedback, and reversible scope resolution.
4. Repair canonical handles, manual connection persistence, and graph serialization.
5. Add multi-reference role inference, role correction, and automatic edge creation.
6. Add text-to-flow parsing, reversible previews, `+ Next`, `+ Branch`, and stable graph-aware editing.
7. Add isolated text drafts and multi-selection/group-motion behavior.
8. Add the rolling quota migration and refresh scheduling.
9. Insert the deterministic vision gate and Qwen/Nova routing.
10. Reorder compilation so final reference ranking follows Mistral or deterministic prompt generation.
11. Add impact and relationship scoring with decision explanations.
12. Expand and audit the synthetic gesture corpus; train and compare candidates without replacing the shipped model automatically.
13. Run browser, provider, quota, build, security, and packaging verification.
14. Promote database, web, API, and extension artifacts only from the same verified source revision.

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
16. Users can select, mark, sketch, or type in any order and receive one visible, editable instruction interpretation.
17. The primary workflow does not require choosing Point, Region, Lasso, Link, Text, Eraser, or Flowchart modes.
18. Point, region, freehand, whole-asset, video-frame, and video-range targeting always show feedback matching the stored meaning.
19. A sketch remains a separate generative reference and is never silently converted into a mask or markup target.
20. One instruction can include multiple images, videos, text nodes, and sketches with editable semantic roles.
21. Text or pasted prose can generate reversible sequences, decisions, branches, causal links, dependencies, and comparisons.
22. Users can extend a flow through visible `+ Next` and `+ Branch` actions without manually drawing connectors.
23. Editing or moving any text node cannot break its text-to-text, text-to-visual, or visual-to-text relationships.
24. Low-confidence interpretation preserves raw input and requests at most one contextual correction.

## 17. Non-goals

- Asking vision to paraphrase every generation instruction.
- Describing every image in the workspace by default.
- Letting Mistral or a vision model invent graph endpoints.
- Treating file byte size as semantic importance.
- Allowing model scores to override explicit user selections or required relationships.
- Uploading original workspace media, gesture recordings, or synthetic training data to application storage.
- Claiming production gesture accuracy from synthetic evaluation alone.
- Requiring casual users to understand annotation geometry or graph-edge types before expressing intent.
- Shipping a permanent seven-tool annotation toolbar as the primary experience.
- Treating markup, sketch, comment text, and relationship lines as interchangeable inputs.
- Automatically changing a user's raw selection, stroke, text, or sketch without visible confirmation and undo.
- Requiring users to wire every multi-reference or text-flow relationship manually.

## 18. Research basis

- React Flow controlled interaction, connections, handles, and multi-selection: <https://reactflow.dev/learn/concepts/adding-interactivity>, <https://reactflow.dev/learn/customization/handles>, <https://reactflow.dev/api-reference/react-flow>
- Region-level visual grounding: <https://arxiv.org/abs/2307.03601>
- Combined local and global visual context: <https://arxiv.org/abs/2407.16198>
- High-resolution detail and token/cost trade-offs: <https://llava-vl.github.io/blog/2024-01-30-llava-next/>
- Multi-image reasoning limitations: <https://arxiv.org/abs/2406.12742>
- Multi-image pixel-grounded reasoning: <https://arxiv.org/abs/2412.15209>
- Supabase database-function and security-definer guidance: <https://supabase.com/docs/guides/database/functions>, <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Figma point and region comments: <https://help.figma.com/hc/en-us/articles/360041068574-Add-comments-to-files>
- Miro object-attached comments and board interaction: <https://help.miro.com/hc/en-us/articles/360017730873-Comments>
- Frame.io anchored, frame-based, range-based, and markup-supported comments: <https://help.frame.io/en/articles/9105251-commenting-on-your-media>
- Adobe Firefly text, brush, and region markup: <https://helpx.adobe.com/firefly/web/work-with-images/edit-images/use-ai-markup.html>
- Adobe Photoshop selection-guided generative editing: <https://helpx.adobe.com/photoshop/desktop/make-selections/refine-modify-selections/use-selections-for-generative-editing.html>
- OpenAI Sketch and image comments launch: <https://openai.com/index/introducing-chatgpt-images-2-5/>
- OpenAI image comments, multi-selection, targeted refinement, and reference-role guidance: <https://learn.chatgpt.com/docs/image-generation>
- OpenAI selected-area artifact annotation: <https://learn.chatgpt.com/docs/artifacts-viewer>
- WCAG dragging alternatives and minimum target guidance: <https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html>, <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>

## 19. Research synthesis and product decision

The supplied comparative research supports four high-confidence market patterns:

1. click-to-anchor and drag-to-region are widely understandable;
2. saved annotations need persistent, asset-relative anchors;
3. translucent fills, outlines, pins, and hover states are essential feedback;
4. advanced freehand and shape primitives are valuable when they appear contextually.

The supplied recommendation for separate Point, Region, Lasso, Link, Text, and Eraser toolbar tools is intentionally not adopted as the default. It resembles professional document-markup and labeling software, but it conflicts with Viscue's goal of reducing mode decisions and fatigue for casual brainstorming. Those primitives remain available inside the selected context while one composer owns the primary workflow.

The final product decision is a confidence-gated hybrid:

- natural language is the primary expression of intent;
- selection and markup provide authoritative spatial grounding;
- sketches provide desired visual or compositional guidance;
- multi-selection defines the participating reference set;
- text parsing proposes flow and logic structure;
- graph edges preserve accepted relationships;
- models enrich ambiguous semantics only when deterministic evidence is insufficient;
- every interpretation is visible, editable, reversible, and subordinate to raw user input.
