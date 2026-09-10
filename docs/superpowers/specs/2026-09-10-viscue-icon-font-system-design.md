# Viscue Icon and Typeface System Design

Date: 2026-09-10  
Status: Approved visual direction; implementation pending document review

## Objective

Create a self-contained `viscue-brand-kit` for Viscue containing a custom product icon library and a custom display typeface. The kit must express the existing open eye/C logo, cue dash, visual linking, annotation, and idea-flow concepts while remaining legible inside a dense canvas workspace.

The selected direction is **Humanist Flow**, based on the user's final recorded selection in the visual comparison. Its character is friendly, connected, slightly organic, and precise enough for product use.

## Deliverable structure

```text
viscue-brand-kit/
  README.md
  icons/
    svg/
    react/
      ViscueIcon.jsx
      icons.js
      index.js
    metadata/
      icons.json
    preview/
      index.html
  font/
    source/
    ttf/
    woff2/
    css/
      viscue-flow.css
    specimen/
      index.html
    LICENSE.txt
    CHANGES.md
  preview/
    brand-kit.html
  scripts/
    build-font.py
    validate-icons.mjs
    validate-font.py
```

The folder is additive. This phase does not replace icons or typography inside the production application. It supplies reviewed, importable assets and a migration map for a later integration task.

## Logo interpretation

The master logo remains a rounded steel-blue tile containing a white open eye/C contour and a short cue dash. The system extracts four reusable traits from it:

1. Open contours that imply an entry, exit, or continuation.
2. Rounded terminals derived from the logo stroke.
3. Short horizontal cue marks used sparingly as focus or action signals.
4. Soft, connected curves that communicate visual thinking rather than mechanical tooling.

The primary brand color is `#5B7593`. Icons use `currentColor` by default so the application can control active, inactive, dark-mode, and accessible states.

## Icon system

### Geometry

- Canvas: `24 × 24` viewBox.
- Default stroke: `1.8`, round caps, round joins.
- Optical bounds: most marks remain within `2.5–21.5`.
- Default style: outline, no fill.
- Filled surfaces are limited to the brand mark and meaningful status indicators.
- Each icon must remain recognizable at 16, 20, 24, and 32 CSS pixels.
- Product-specific icons use the open contour or cue terminal only when it improves meaning; the motif is not added decoratively to every symbol.

### Library scope

The initial library contains 72 icons: 44 direct replacements for actions already represented in the workspace and 28 Viscue-specific concepts.

#### Existing workspace actions

`moon`, `more-stack`, `grid`, `database`, `close`, `plus`, `check`, `chevron-down`, `search`, `settings`, `sliders`, `copy`, `download`, `upload`, `share`, `save`, `link`, `lock`, `eye-off`, `trash`, `bold`, `italic`, `underline`, `align-left`, `align-center`, `image`, `file-text`, `globe`, `sticky-note`, `reset`, `wand`, `history`, `video`, `collapse`, `annotate`, `area`, `pencil`, `eraser`, `text`, `cursor`, `annotation-tool`, `text-tool`, `undo`, `redo`.

#### Viscue-specific additions

`brand-mark`, `cue`, `vision`, `vision-region`, `vision-bypass`, `prompt`, `prompt-synthesis`, `semantic-graph`, `importance`, `gesture`, `reference-engine`, `execute`, `relation`, `one-to-many`, `many-to-one`, `branch`, `merge`, `flow`, `decision`, `group`, `ungroup`, `crop`, `frame`, `hand-pan`, `camera`, `duplicate`, `unlock`, `eye`.

### File and API contract

Each icon is available as:

- A standalone kebab-case SVG using `currentColor`.
- A named React export using PascalCase, for example `VisionRegionIcon`.
- A metadata entry containing name, category, keywords, intended use, and whether the symbol is Viscue-specific.

The React wrapper accepts `size`, `strokeWidth`, `title`, `className`, and normal SVG properties. Decorative icons default to `aria-hidden="true"`; providing `title` changes the output to a named accessible graphic.

### Preview and migration support

The icon preview groups symbols by category, supports visual inspection on light and dark surfaces, and shows 16/20/24/32 pixel sizes. The README includes a mapping from every current `LucideIcons.jsx` export to its custom Viscue replacement.

## Typeface system

### Family and use

The custom family is named **Viscue Flow Display**. It is intended for brand headlines, onboarding titles, empty states, feature headings, marketing surfaces, and short high-emphasis labels. Existing Instrument Sans remains the body and dense-control face because long-form readability is more important than making every letter visibly branded.

### Visual character

- Humanist geometric sans construction.
- Soft bowls and open counters inspired by the open eye/C logo.
- Rounded stroke endings paired with occasional horizontal cue cuts.
- Slight forward energy without slanting the whole alphabet.
- Distinctive `C`, `G`, `Q`, `S`, `V`, `e`, `g`, `t`, `2`, `3`, and `8`.
- Clear differentiation between `I`, `l`, `1`, `O`, and `0`.
- Moderate width and restrained contrast for comfortable headline scanning.

The design avoids novelty-letter substitutions, extreme geometric circles, illegible open forms, and decorative details that disappear below 24 pixels.

### Font deliverables

- `ViscueFlowDisplay-Regular.ttf` and `.woff2` at weight 400.
- `ViscueFlowDisplay-Semibold.ttf` and `.woff2` at weight 600.
- CSS `@font-face` declarations using `font-display: swap`.
- Printable ASCII, Latin-1 Supplement, smart quotes, common currency symbols, arrows, mathematical operators, and essential UI punctuation.
- A specimen covering headlines, mixed case, numerals, punctuation, real Viscue product copy, and comparison against Instrument Sans body text.

### Construction and licensing

The font will be created as an original Viscue modification layer over the SIL Open Font License version of Instrument Sans. Unmodified glyphs provide broad language coverage and reliable spacing; signature glyphs and terminals are redrawn for Viscue Flow Display. The output is renamed so it cannot conflict with the upstream family.

The kit includes the upstream SIL Open Font License, a `CHANGES.md` identifying the modified family and changed glyphs, and no reserved-font-name claim. Font binaries are built reproducibly with FontTools and Brotli installed in a project-local Python virtual environment.

## Build flow

### Icons

1. Store one canonical geometry definition per icon.
2. Generate standalone SVG files and React exports from the same definitions.
3. Generate `icons.json` and the preview from that same source.
4. Validate every generated file before accepting the build.

This prevents raw SVG, React, and documentation versions from drifting apart.

### Font

1. Acquire the official OFL Instrument Sans font source and preserve its license.
2. Rename the family and metadata to Viscue Flow Display.
3. Apply the custom glyph and terminal transformations defined by the source script.
4. Generate Regular and Semibold TTF files.
5. Produce WOFF2 versions and CSS declarations.
6. Validate tables, glyph coverage, naming, and browser loading.

## Validation

### Icon checks

- Exactly 72 unique icon names.
- Every SVG parses as XML and uses a `24 × 24` viewBox.
- No embedded text, raster image, external URL, script, hardcoded black, or hardcoded white in utility icons.
- Geometry remains inside the viewBox.
- React export count matches the SVG and metadata counts.
- Server-side rendering produces one SVG for every component.
- Preview inspection at 16, 20, 24, and 32 pixels on light and dark backgrounds.

### Font checks

- Both TTF and WOFF2 files reopen successfully through FontTools.
- Family, subfamily, PostScript, and unique identifiers use the Viscue name consistently.
- All promised characters are present in both weights.
- Regular reports weight 400 and Semibold reports weight 600.
- The browser specimen loads local WOFF2 files without fallback.
- No glyph exceeds font bounds or produces an empty outline where an outline is required.
- Test strings verify ambiguous characters and Viscue-specific signature glyphs.

## Failure handling

Build scripts stop with a nonzero exit code for duplicate icon names, malformed paths, missing font source, missing license, invalid font tables, absent required glyphs, or mismatched generated-file counts. Generated files are written only after validation succeeds, avoiding partially updated kits.

## Acceptance criteria

The task is complete when:

1. `viscue-brand-kit` contains all documented folders and files.
2. Seventy-two custom icons are available as standalone SVGs and React components.
3. Both Viscue Flow Display weights are available as TTF and WOFF2.
4. The combined preview and font specimen open locally and show the selected Humanist Flow identity.
5. Automated icon and font validation passes with zero failures.
6. The README documents installation, React use, plain SVG use, CSS font use, accessibility, licensing, and the current-to-custom icon migration map.
