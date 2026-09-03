# Figma Workspace Restoration Design

## Objective

Restore the Viscue 3.3 workspace presentation so it follows the approved MCPVIS Figma file while preserving the current, tested feature logic and backend protocol.

The Figma file at `NfQ9Zmh2p69p5T2eBAfSg4` is the visual source of truth for the workspace shell, navigation placement, toolbar states, history surface, asset selection, and light/dark presentation. Existing Viscue 3.3 behavior is the functional source of truth.

## Evidence and Root Cause

- The local server and gesture suites pass all 148 tests.
- The Vite production build succeeds.
- The current application contains the full Viscue 3.3 asset, annotation, history, compilation, verification, and handoff flows.
- The Figma layout differs most strongly from the current presentation shell and bottom toolbar.
- Several direct rewrites were recently applied to `extension/src/viscue-web-components.js` and its styling. These changes enlarged the toolbar, exposed labels that are absent from the design, and changed the workspace hierarchy without evidence that the backend or data model was damaged.

Therefore, restoration must isolate presentation changes and avoid reverting the application or backend wholesale.

## Product Architecture

### Visual source of truth

The workspace is a full-viewport canvas with three persistent navigation anchors:

1. A compact destination pill in the upper-left corner.
2. A compact utility cluster in the upper-right corner for appearance, history, and closing the workspace.
3. A sculpted, bottom-centered command dock containing the primary tools and a separate `Cue` action.

The center of an empty light workspace displays the staggered message `Show What You Mean` and a rounded `Click here` affordance. The message must not compete with content after an asset is added.

The approved base palette is steel blue `#50697f`, white `#ffffff`, and light gray `#d9d9d9`, with Instrument Sans as the intended visual reference. The implementation may use the nearest locally available font fallback when loading the reference font would require a new remote dependency.

### Workspace behavior

The canvas remains backed by the existing React Flow graph and state model. Nodes, edges, selection, keyboard commands, persistence, plan limits, and compilation inputs remain unchanged.

The shell is responsible only for:

- presenting the correct workspace mode;
- routing tool selections to existing actions;
- revealing contextual actions for the active node or asset;
- displaying loading, error, disabled, selected, and persisted-history states;
- remaining usable at extension side-panel and wider desktop sizes.

### Command dock

The base dock is icon-first and uses tooltips plus accessible names instead of persistent text labels. It contains:

- Select/hand tool;
- Assets menu;
- Annotate menu;
- Text menu;
- Undo/history control;
- separate `Cue` action.

Only one primary tool may appear selected at a time. Opening a menu must preserve the current canvas selection, close mutually exclusive menus, and allow Escape or an outside click to return to the base dock.

### Feature organization

#### Assets

The Assets menu clearly exposes image, video, document, webpage URL, and current-page capture inputs. After insertion, existing contextual capabilities remain available where applicable: crop, exact-time video frame extraction, time-range editing, document/web extraction, motion recording, Preserve/lock, copy, and delete.

#### Annotate

The Annotate menu exposes point instruction, area selection, freehand drawing/highlight, and erase modes. These modes continue to write into the existing graph and compilation payload rather than introducing a second annotation model.

#### Text

The Text menu exposes plain text and sticky note creation. Formatting or node-specific controls remain contextual to the selected text node.

#### History

History opens as the centered, rounded steel-blue surface shown in Figma. It lists persisted snapshots with a clear restore action and existing secondary actions such as deletion or sharing when supported. Undo and redo remain available without forcing the full history surface to open.

#### Cue

`Cue` starts the existing review and compilation path. It must preserve the established sequence:

1. Validate the current graph and plan limits.
2. Build the VICSUC request.
3. Compile through the local server and configured provider routing.
4. Attach and verify the result.
5. Perform the handoff and display receipt integrity/status.

The visual restoration must not change request schemas, provider routing, deterministic fallback, or receipt verification.

## Responsive and Accessibility Requirements

- Preserve the composition at the 417-by-250 Figma reference ratio while scaling for the real extension viewport.
- Keep the dock centered and utilities reachable without overlapping content.
- Menus may reposition above the dock when horizontal space is constrained.
- Every icon-only action requires an accessible name, keyboard focus treatment, and tooltip.
- Color cannot be the only indication of selection, disabled state, or failure.
- Focus order follows upper-left destination, canvas, command dock, Cue, and upper-right utilities in a predictable loop.
- Motion respects `prefers-reduced-motion`.

## State and Error Handling

The shell must visibly distinguish:

- empty, populated, and selected-asset canvases;
- idle, selected, disabled, loading, success, and failure actions;
- light and dark appearance;
- open Assets, Annotate, Text, and History surfaces;
- plan-limit overflow;
- local-server unavailable and provider-degraded compilation;
- verification or handoff failure.

Existing error messages and recovery actions must be retained. Presentation changes may shorten labels in the dock but must not discard diagnostic details in dialogs or status panels.

## Implementation Boundaries

- Do not replace React Flow, the graph schema, local persistence, local-server routes, gesture logic, provider adapters, or handoff verification.
- Do not restore an older complete application build, because it would discard Viscue 3.3 behavior.
- Prefer focused React components and CSS tokens over additional monolithic rewrites of `viscue-web-components.js`.
- Reuse the current icon system or local SVG assets; do not add a network-only runtime dependency.
- Preserve Chrome Manifest V3 compatibility.

## Verification

Completion requires all of the following:

- Existing 148 Node tests still pass.
- The production extension build succeeds.
- Interaction tests cover dock selection, mutually exclusive menus, Escape/outside dismissal, history opening, appearance switching, empty-state dismissal, and Cue routing.
- Visual checks compare light empty, selected asset, history, dark, and each compact menu state against the captured Figma references.
- A manual smoke flow confirms asset insertion, annotation, text, undo/redo, history restore, compilation, verification, and handoff wiring.

## Approved Decision

The approved approach is to preserve the working Viscue 3.3 logic and rebuild its presentation layer to match Figma. Advanced features remain available through compact menus and contextual actions so the workspace is visually minimal without becoming functionally incomplete.
