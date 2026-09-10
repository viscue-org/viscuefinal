# Viscue Brand Kit - Icon Library

The canonical Viscue icon system, designed with **Humanist Flow** principles. Friendly, connected, slightly organic, and engineered for high legibility across dense canvas and product interfaces.

- **72 unique icons**: 44 workspace actions + 28 Viscue-specific concept icons.
- **ViewBox**: `0 0 24 24` with default stroke `1.8`, round caps, and round joins.
- **Color Inheritance**: Fully unstyled `currentColor` strokes for seamless theme adaptation.
- **Surfaces**: Available as standalone SVGs, React components, and metadata.

---

## Installation & Imports

### React Usage

Import named icons or the generic `ViscueIcon` component:

```jsx
import { VisionRegionIcon, CueIcon, MoonIcon } from 'viscue-brand-kit/icons/react';
import { ViscueIcon } from 'viscue-brand-kit/icons/react/ViscueIcon.js';

// Using named exports
function Toolbar() {
  return (
    <div className="toolbar">
      <VisionRegionIcon size={20} />
      <CueIcon size={20} strokeWidth={2} />
      <MoonIcon size={20} title="Switch to dark mode" />
    </div>
  );
}

// Using generic component by name
function DynamicAction({ actionName }) {
  return <ViscueIcon name={actionName} size={24} />;
}
```

### Standalone SVG Usage

SVG files are located in `icons/svg/<name>.svg`. You can import them directly into HTML, Vite, Webpack, or CSS:

```html
<img src="viscue-brand-kit/icons/svg/brand-mark.svg" width="24" height="24" alt="Viscue">
```

Or inline:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
  <path d="M15 8.5a5 5 0 1 0 0 7" />
  <line x1="12" y1="12" x2="17.5" y2="12" />
</svg>
```

---

## Accessibility Guidelines

By default, all Viscue icons are marked with `aria-hidden="true"` as decorative UI elements:

```html
<svg viewBox="0 0 24 24" aria-hidden="true" ...>
```

When an icon conveys standalone meaning (e.g. an icon button without text), provide the `title` prop. The component automatically emits `role="img"`, removes `aria-hidden`, and injects an accessible `<title>` tag:

```jsx
<ViscueIcon name="vision" title="Vision Analysis" />
<!-- Renders: <svg role="img" ...><title>Vision Analysis</title>...</svg> -->
```

---

## Commands & Build Pipeline

```bash
# Build standalone SVGs, React exports, metadata, and index
npm --prefix viscue-brand-kit run build:icons

# Run XML, viewBox, bounding box, and count validation
npm --prefix viscue-brand-kit run validate:icons

# Run automated unit test suite
npm --prefix viscue-brand-kit test
```

---

## 44-Row Workspace Migration Map

Mapping existing workspace icons (from Lucide / Phosphor) to the new Viscue Humanist Flow library:

| Current Workspace Icon | New Viscue Name | React Component Export | Category | Description |
| :--- | :--- | :--- | :--- | :--- |
| `moon` | `moon` | `MoonIcon` | `system` | Dark / night mode toggle |
| `more-stack` | `more-stack` | `MoreStackIcon` | `action` | Layered sheet / card stack |
| `grid` | `grid` | `GridIcon` | `canvas` | 4-quadrant layout alignment grid |
| `database` | `database` | `DatabaseIcon` | `system` | SQLite / server persistence |
| `x` / `close` | `close` | `CloseIcon` | `system` | Dismiss modal or cancel selection |
| `plus` | `plus` | `PlusIcon` | `action` | Add node or create canvas item |
| `check` | `check` | `CheckIcon` | `action` | Success confirmation checkmark |
| `chevron-down` | `chevron-down` | `ChevronDownIcon` | `system` | Dropdown arrow indicator |
| `search` | `search` | `SearchIcon` | `system` | Canvas search and query lookup |
| `settings-2` / `settings` | `settings` | `SettingsIcon` | `system` | Preferences and configuration |
| `sliders-horizontal` | `sliders` | `SlidersIcon` | `system` | Slider controls and filters |
| `copy` | `copy` | `CopyIcon` | `action` | Duplicate selection to clipboard |
| `download` | `download` | `DownloadIcon` | `action` | Export canvas asset |
| `upload` | `upload` | `UploadIcon` | `action` | Import asset onto canvas |
| `share-2` / `share` | `share` | `ShareIcon` | `action` | Share link / canvas collaboration |
| `save` | `save` | `SaveIcon` | `action` | Save state to history archive |
| `link-2` / `link` | `link` | `LinkIcon` | `action` | Edge hyperlink connection |
| `lock` | `lock` | `LockIcon` | `system` | Lock node transform |
| `eye-off` | `eye-off` | `EyeOffIcon` | `system` | Conceal / hide layer |
| `trash-2` / `trash` | `trash` | `TrashIcon` | `action` | Remove asset or delete edge |
| `bold` | `bold` | `BoldIcon` | `format` | Bold font weight |
| `italic` | `italic` | `ItalicIcon` | `format` | Italic font style |
| `underline` | `underline` | `UnderlineIcon` | `format` | Underline text format |
| `align-left` | `align-left` | `AlignLeftIcon` | `format` | Left text alignment |
| `align-center` | `align-center` | `AlignCenterIcon` | `format` | Center text alignment |
| `image` | `image` | `ImageIcon` | `media` | Image asset card |
| `file-text` | `file-text` | `FileTextIcon` | `media` | Text / document asset card |
| `globe-2` / `globe` | `globe` | `GlobeIcon` | `system` | Webpage capture node |
| `sticky-note` | `sticky-note` | `StickyNoteIcon` | `canvas` | Sticky memo note |
| `rotate-ccw` / `reset` | `reset` | `ResetIcon` | `action` | Revert changes or reset view |
| `wand-sparkles` / `wand` | `wand` | `WandIcon` | `action` | AI prompt synthesis with cue |
| `history` | `history` | `HistoryIcon` | `action` | Timeline / version snapshots |
| `video` | `video` | `VideoIcon` | `media` | Video stream / recording card |
| `collapse` | `collapse` | `CollapseIcon` | `canvas` | Dock or collapse canvas panel |
| `annotate` | `annotate` | `AnnotateIcon` | `canvas` | Speech markup with cue dash |
| `area` | `area` | `AreaIcon` | `canvas` | Area bounding box with cue focal |
| `pencil` | `pencil` | `PencilIcon` | `canvas` | Freehand drawing tool |
| `eraser` | `eraser` | `EraserIcon` | `canvas` | Eraser wipe tool |
| `text` | `text` | `TextIcon` | `format` | Typography letter T |
| `cursor` | `cursor` | `CursorIcon` | `canvas` | Canvas selection arrow with cue |
| `annotation-tool` | `annotation-tool` | `AnnotationToolIcon` | `canvas` | Pen annotation stylus |
| `text-tool` | `text-tool` | `TextToolIcon` | `canvas` | Text I-beam cursor tool |
| `undo` | `undo` | `UndoIcon` | `action` | Step backward in history |
| `redo` | `redo` | `RedoIcon` | `action` | Step forward in history |

---

## 28 Viscue-Specific Concept Additions

| Product Icon Name | React Component Export | Visual Motif & Semantic Meaning |
| :--- | :--- | :--- |
| `brand-mark` | `BrandMarkIcon` | Master rounded tile with open eye/C contour and cue dash |
| `cue` | `CueIcon` | Signature horizontal cue action and focus marker |
| `vision` | `VisionIcon` | Open contour eye perception mark |
| `vision-region` | `VisionRegionIcon` | Region of interest: 4 crop corners enclosing open eye |
| `vision-bypass` | `VisionBypassIcon` | Skip passthrough arc bypassing the cue focus line |
| `prompt` | `PromptIcon` | Terminal prompt angle with cue dash |
| `prompt-synthesis` | `PromptSynthesisIcon` | 3 converging input vectors unifying into 1 output |
| `semantic-graph` | `SemanticGraphIcon` | 3 connected relational graph nodes |
| `importance` | `ImportanceIcon` | Central weighted node with cross focus ticks |
| `gesture` | `GestureIcon` | Continuous fluid motion path |
| `reference-engine` | `ReferenceEngineIcon` | Stacked reference plates converging on target frame |
| `execute` | `ExecuteIcon` | Run / trigger triangular glyph with cue dash lead-in |
| `relation` | `RelationIcon` | Bilateral edge linking two nodes |
| `one-to-many` | `OneToManyIcon` | Root node branching into 3 diverging channels |
| `many-to-one` | `ManyToOneIcon` | 3 converging channels merging into single node |
| `branch` | `BranchIcon` | Workflow path branching into parallel node |
| `merge` | `MergeIcon` | Parallel workflow path unifying into master stream |
| `flow` | `FlowIcon` | Fluid S-curve directional flow arrow |
| `decision` | `DecisionIcon` | Softened decision diamond with dual exits |
| `group` | `GroupIcon` | Clustered group bounding enclosures |
| `ungroup` | `UngroupIcon` | Separated frames with diverging path |
| `crop` | `CropIcon` | Interlocking crop boundary marks |
| `frame` | `FrameIcon` | Artboard canvas frame with crosshair guidelines |
| `hand-pan` | `HandPanIcon` | Open hand canvas navigation gesture |
| `camera` | `CameraIcon` | Viewfinder snapshot camera |
| `duplicate` | `DuplicateIcon` | Offset layered cards with additive marker |
| `unlock` | `UnlockIcon` | Open shackle padlock |
| `eye` | `EyeIcon` | Full open eye inspection silhouette |
