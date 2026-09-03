# VisCue first-install onboarding design QA — 2026-09-03

## Comparison target

- Source visual truth:
  - `C:\Users\witne\OneDrive\Pictures\Screenshots\Screenshot 2026-09-03 000344.png` — idea scene, 468 × 637 px.
  - `C:\Users\witne\OneDrive\Pictures\Screenshots\Screenshot 2026-09-03 000357.png` — explain scene, 475 × 637 px.
  - `C:\Users\witne\OneDrive\Pictures\Screenshots\Screenshot 2026-09-03 000410.png` — live-demo scene, 472 × 646 px.
  - `C:\Users\witne\OneDrive\Pictures\Screenshots\Screenshot 2026-09-03 000431.png` — supported-tools scene, 475 × 639 px.
  - `C:\Users\witne\OneDrive\Pictures\Screenshots\Screenshot 2026-09-03 000450.png` — finish scene, 474 × 640 px.
- Browser-rendered implementation:
  - `C:\Users\witne\OneDrive\Documents\ddd\artifacts\onboarding-2026-09-03\06-scene-idea-final.png`.
  - `C:\Users\witne\OneDrive\Documents\ddd\artifacts\onboarding-2026-09-03\07-scene-explain-final.png`.
  - `C:\Users\witne\OneDrive\Documents\ddd\artifacts\onboarding-2026-09-03\12-scene-demo-final-recording-frame.png`.
  - `C:\Users\witne\OneDrive\Documents\ddd\artifacts\onboarding-2026-09-03\09-scene-anywhere-final.png`.
  - `C:\Users\witne\OneDrive\Documents\ddd\artifacts\onboarding-2026-09-03\10-scene-finish-final.png`.
  - Late recording evidence: `C:\Users\witne\OneDrive\Documents\ddd\artifacts\onboarding-2026-09-03\13-scene-demo-late-frame.png`.
- Viewport and normalization: implementation captured at the extension's exact 400 × 600 CSS viewport, device scale factor 1, producing 400 × 600 px PNGs. References were proportionally compared as complete portrait compositions; their small source-size differences were treated as density/crop differences, not design findings.
- State: fresh install, steps 1–5; live-demo early and late frames; completed install reopening the regular usage popup.

## Full-view comparison

- Fonts and typography: Instrument Sans/system fallback maintains the reference's compact, friendly display hierarchy. Heading weights, deliberate two-line wraps, oversized `AI`, and the lighter `That’s it.` treatment are preserved.
- Spacing and layout rhythm: the subject-to-eye overlap, wide oval proportions, lower-left text blocks, bottom-right Skip action, and final CTA composition match the reference sequence at the production popup size. No persistent control is clipped.
- Colors and tokens: the final pass uses Viscue Steel `#5B7593`, a restrained mist background, soft neutral eye fill, and white final-screen contrast. There are no decorative gradients.
- Image quality and asset fidelity: the supplied transparent person, supplied AI-platform grid, and authentic Viscue mark are used directly. The demo eye uses five browser captures from the real Viscue workspace; no placeholder product art or generated logo is present.
- Copy and content: all five reference messages are preserved, with `Actual Viscue flow` added only as a small provenance label inside the recording.
- Accessibility: every eye is a semantic button with a scene-specific label, Skip and Start are keyboard reachable, focus rings are visible, image alt text is meaningful, and reduced-motion mode removes blink/transition motion.

## Focused-region comparison

- Final CTA and mark: inspected at 400 × 600; the authentic mark remains sharp, centered, and optically balanced with `Start Viscue`.
- Live-demo eye: inspected at both early and late recording frames. Workspace states visibly change while the oval mask and title remain stable; the tool menu and authored workspace content stay legible.

## Comparison history

- Pass 1 — [P2] Color temperature was too cool and gray. Fixed by mapping the popup to Viscue Steel `#5B7593`, a lighter mist background, and a neutral eye fill. Post-fix evidence is in captures 06–10.
- Pass 1 — [P1] The demo scene auto-advanced before all real-tool frames could play. Fixed by extending only the demo scene to 11.2 seconds while retaining the 3.6-second rhythm elsewhere. The model test now protects this duration; capture 13 proves a late recording frame remains on step 3.
- Pass 2 — no actionable P0/P1/P2 visual or interaction findings remain.

## Primary interactions and runtime checks

- Clicking each oval triggers the blink transition and advances exactly one scene.
- Automatic progression works; the demo scene remains long enough to show all five real-workspace states.
- Skip completes onboarding. Start Viscue persists completion and opens `index.html`.
- Reopening `popup.html` after completion shows the regular plan/usage popup instead of replaying onboarding.
- Browser console: zero warnings or errors in the final popup pass.

## Accepted differences / follow-up polish

- P3: the explain scene reuses the supplied full-body person asset instead of fabricating the separate hand pose shown in the sketch reference.
- P3: compact progress markers were added to make the automatic story's position understandable; they do not compete with the reference composition.

final result: passed

---

# Archived VisCue workspace and popup design QA

## Evidence

- Source visual truth:
  - `C:\Users\witne\Downloads\vis-design\ChatGPT Image Aug 22, 2026, 08_36_51 PM.png` (home popup, 1086 × 1448 px)
  - `C:\Users\witne\Downloads\vis-design\ChatGPT Image Aug 22, 2026, 08_35_32 PM.png` (settings popup, 941 × 1672 px)
  - `C:\Users\witne\Downloads\vis-design\VisCue_Brand_Design_System_v4_PRODUCTION_MASTER (1).pptx` (32-slide production brand master)
  - `C:\Users\witne\Downloads\ddd\viscue-components (6).html` (VisCue Whiz component reference)
- Browser-rendered implementation:
  - `C:\Users\witne\Downloads\ddd\artifacts\final-audit-2026-08-24\23-popup-home-final-400x600.png`
  - `C:\Users\witne\Downloads\ddd\artifacts\final-audit-2026-08-24\24-popup-settings-final-400x600.png`
  - `C:\Users\witne\Downloads\ddd\artifacts\final-audit-2026-08-24\20-workspace-current.png`
  - `C:\Users\witne\Downloads\ddd\artifacts\final-audit-2026-08-24\21-asset-toolbar-dark-final.png`
  - `C:\Users\witne\Downloads\ddd\artifacts\final-audit-2026-08-24\05-inventory-dark-wide.png`
  - `C:\Users\witne\Downloads\ddd\artifacts\final-audit-2026-08-24\06-text-formatting-dark.png`
  - `C:\Users\witne\Downloads\ddd\artifacts\final-audit-2026-08-24\19-history-dark.png`
  - `C:\Users\witne\Downloads\ddd\artifacts\popup-text-fix-2026-08-24\04-sticky-toolbar-viewport-safe.png`
  - `C:\Users\witne\Downloads\ddd\artifacts\popup-text-fix-2026-08-24\05-text-toolbar-final.png`
  - `C:\Users\witne\Downloads\ddd\artifacts\popup-text-fix-2026-08-24\06-popup-production.png`
- Same-input comparisons:
  - `C:\Users\witne\Downloads\ddd\artifacts\final-audit-2026-08-24\25-popup-source-implementation-comparison.png`

## Normalization

- Popup CSS viewport: 400 × 600 at device scale factor 1.
- Implementation captures: 400 × 600 px.
- Source references were proportionally contained in equal 400 × 600 comparison frames; no density-based findings were filed.
- Workspace viewport: 1280 × 720 at browser zoom 100%, dark theme.
- State: popup home, popup settings with Auto submit enabled, workspace with asset/area/point annotations/Text/S-Note, and dark History empty state.
- Responsive popup matrix: 320 × 520, 360 × 560, and 400 × 600, captured together in `09-popup-responsive-home.png` and `11-popup-responsive-settings-fixed.png`.

## Required fidelity surfaces

- Fonts and typography: Instrument Sans is used throughout. Headings, UI labels, plan prices, captions, and helper copy follow the brand master’s 600/500/400 weight hierarchy with compact tracking only on display text.
- Spacing and layout rhythm: popup content uses the source’s large top card, account divider, three allowance rows, and persistent two-item navigation. Workspace controls use 4/8/12/16/24 spacing and brand radii. No persistent control is cropped at 400 × 600 or 1280 × 720.
- Responsive behavior: the popup scales down through 320 px without horizontal overflow, account-row collisions, visible scrollbars, or covered plan rows. Workspace overlays keep viewport-edge clearance and selected-asset actions stay above the center rail.
- Colors and tokens: Signal Orange `#FF5A36`, Ink `#161616`, Canvas `#F7F5F2`, Paper `#FFFFFF`, Muted `#6F6B66`, and Hairline `#D9D5CF` are mapped directly from the production master. The dark toolbar rail is `rgb(42,45,50)` against a `rgb(34,36,40)` cavity so its silhouette remains readable.
- Image quality and assets: the popup uses the authentic transparent VisCue mark extracted from the supplied brand master and a lossless crop of the supplied usage artwork. Extension icons were replaced by authentic 16/32/128 px production assets. No placeholder logo or hand-drawn substitute remains.
- Copy and content: `Cue left`, `9/9`, `Plan — Free`, `Auto submit`, account copy, allowances, and prices match the supplied references. `Open workspace` is an intentional functional addition to make the popup’s core action explicit.

## Comparison history

### Iteration 1

- [P2] Home hero used a large logo mark instead of the supplied orange usage artwork.
  - Fix: extracted the exact usage artwork from the user’s source and used it as the hero asset while keeping the whole region clickable.
  - Post-fix evidence: `popup-home-comparison-final.png` shows matching orange silhouette, `Cue left`, and `9/9` composition.
- [P2] The Plus allowance row and price were partially hidden behind the bottom navigation at 400 × 600.
  - Fix: reduced nonessential vertical gaps, tightened the top card and plan rows, and set a 64 px persistent navigation height.
  - Post-fix evidence: `popup-settings-comparison.png` shows all three plans and both prices fully visible.
- [P2] Draw and Erase options were visually present but not connected to the active annotation state (`annot`/`annotate`, `erase`/`eraser`, and missing `.draw` stroke styling).
  - Fix: normalized tool names, added visible Signal Orange drawing strokes, and implemented nearest-stroke erase.
  - Post-fix evidence: browser interaction produced one Draw path and Erase reduced it from 1 to 0.

### Iteration 2

- [P2] The second lower-left workspace control did not explain how much content was on the canvas.
  - Fix: added a live numeric badge, semantic item label, type breakdown, connection/mark totals, and focusable canvas inventory.
- [P2] Selected Text and S-Note nodes had no formatting controls.
  - Fix: added bold, italic, underline, 14–32 px sizing, alignment, duplicate, and delete to both; brand text/card colors are intentionally limited to S-Note.
- [P2] The selected-asset toolbar could be clipped when its node sat partially off-canvas.
  - Fix: positioned the action inspector in a fixed, responsive viewport-safe slot above the main center rail.
- [P2] Dark-mode overlays and the floating rail used glass/blur and low-separation blacks.
  - Fix: removed blur, switched to matte brand surfaces, and separated the rail from the canvas with a lighter dark surface and hairline.
- No actionable P0/P1/P2 differences remain after the final combined reference/build comparison.
- Accepted P3/intentional differences:
  - Home navigation marks Home active instead of reproducing the reference’s contradictory Settings-active state.
  - Usage progress is Signal Orange to follow the production master’s functional-orange rule.
  - The home hero includes an explicit `Open workspace` action so the popup is usable, not a static mock.

## Functional and browser QA

- Draw: freehand pointer drag created a persisted `.draw` path.
- Erase: clicking near the stroke removed the nearest path.
- Area: drag created an area rectangle and a connected instruction node.
- Annotate: point-to-empty-space drag created a connected text instruction and edge.
- Text: clicking the canvas after choosing Text created a text node.
- S-Note: clicking the canvas after choosing S-Note created a branded sticky note.
- S-Note formatting: bold, center alignment, Signal Orange, and size increase updated the selected note to `700`, `center`, `rgb(255, 90, 54)`, and `21px`; duplicate increased canvas inventory from 6 to 7 and Undo restored the prior state.
- Text/S-Note scope correction: plain Text exposes emphasis, size, alignment, duplicate, and delete only. Text and card color groups appear only for S-Note. Both inspectors use the viewport-safe fixed slot above the center rail.
- Popup opening: the production popup CTA reached `dist/extension/index.html` with zero console errors. Runtime failures now require an explicit `{ ok: true }` response and fall back to a direct extension-tab open instead of silently closing.
- Canvas inventory: the live control announced `Canvas contents, 6 items`; the panel reported Assets/Text/Notes/Cues and selecting an item focused its node.
- Drag: selected S-Note moved immediately; computed node transition was `none` with duration `0s`.
- Undo: enabled after direct manipulation.
- Auto submit: toggle changed `aria-pressed` and remained enabled after reload; the workspace Send dialog now reads the same stored preference.
- History: dark empty state opened, copy was visible, and close worked.
- Console: zero errors in workspace and popup during the final browser pass.
- Build: `npm run build` completed and `dist/extension/manifest.json` references `popup.html` plus the production PNG icons.

## React quality review

- Node components remain memoized; no inline component definitions were added.
- Derived inventory totals are memoized from node data and primitive edge length; list metadata is calculated locally without additional subscriptions.
- High-frequency position changes use a `Map` lookup and motion sampling is rate/distance constrained.
- Global pointer listeners are installed only for active point annotation and are removed on pointer end/cancel.
- Popup storage reads happen once on mount; interaction writes happen in the event handler.
- Core controls expose button roles, labels, pressed/current state, and keyboard focus styles.

## Follow-up polish

- P3: if a production account API becomes available, replace the reference placeholder email and static allowance numbers with live data.

archived result: passed
