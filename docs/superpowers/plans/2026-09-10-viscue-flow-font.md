# Viscue Flow Display Font Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a legally distributable Viscue Flow Display family in Regular and Semibold TTF/WOFF2 formats, with custom Humanist Flow glyphs, CSS, specimens, and automated validation.

**Architecture:** The build script starts from the official OFL Instrument Sans variable font, creates static weight instances, renames and subsets them, then applies deterministic Viscue outline and spacing changes. FontTools produces both desktop and web binaries; a validator reopens every output and verifies naming, glyph coverage, weight, bounds, and custom-glyph fingerprints.

**Tech Stack:** Python 3.12, FontTools with WOFF support, Brotli, skia-pathops, HTML/CSS specimens

**Spec:** `docs/superpowers/specs/2026-09-10-viscue-icon-font-system-design.md`

## Global Constraints

- Create all font deliverables under `viscue-brand-kit/font/`; do not change production CSS in this phase.
- Family name: `Viscue Flow Display`.
- Produce Regular weight 400 and Semibold weight 600 as TTF and WOFF2.
- Keep Instrument Sans for dense body and control text; Viscue Flow Display is for short high-emphasis typography.
- Include printable ASCII, Latin-1 Supplement, smart punctuation, common currency, arrows, and essential mathematical operators.
- Preserve the upstream SIL Open Font License and record every modification in `CHANGES.md`.
- Use `font-display: swap` and local WOFF2 files in the supplied CSS.
- Build outputs must be reproducible and must not depend on a globally installed Python package.

---

## File map

- `viscue-brand-kit/font/requirements.txt` — pinned build dependencies.
- `viscue-brand-kit/font/source/upstream/InstrumentSans[wdth,wght].ttf` — official upstream variable font.
- `viscue-brand-kit/font/source/upstream/OFL.txt` — official upstream license.
- `viscue-brand-kit/font/source/glyph-style.json` — deterministic Humanist Flow transformations and spacing values.
- `viscue-brand-kit/font/ttf/*.ttf` — generated desktop fonts.
- `viscue-brand-kit/font/woff2/*.woff2` — generated web fonts.
- `viscue-brand-kit/font/css/viscue-flow.css` — generated `@font-face` declarations and usage tokens.
- `viscue-brand-kit/font/specimen/index.html` — local visual specimen.
- `viscue-brand-kit/font/LICENSE.txt` — copied OFL license.
- `viscue-brand-kit/font/CHANGES.md` — derivative-family disclosure.
- `viscue-brand-kit/scripts/fetch-font-source.ps1` — pinned upstream acquisition and checksum verification.
- `viscue-brand-kit/scripts/build-font.py` — static instancing, renaming, custom outlines, subsetting, and WOFF2 generation.
- `viscue-brand-kit/scripts/validate-font.py` — binary and glyph validation.
- `viscue-brand-kit/tests/test_font_build.py` — unit and integration tests.
- `viscue-brand-kit/preview/brand-kit.html` — combined icon and type preview.

### Task 1: Pin the upstream source and project-local font toolchain

**Files:**
- Create: `viscue-brand-kit/font/requirements.txt`
- Create: `viscue-brand-kit/scripts/fetch-font-source.ps1`
- Create: `viscue-brand-kit/tests/test_font_build.py`
- Modify: `viscue-brand-kit/.gitignore`

**Interfaces:**
- Produces: `fetch-font-source.ps1` that writes the upstream variable TTF and OFL license only after SHA-256 verification.
- Produces: local environment command `viscue-brand-kit/.venv/Scripts/python.exe`.

- [ ] **Step 1: Write source-presence and license tests**

```python
from pathlib import Path

ROOT = Path(__file__).parents[1]

def test_upstream_source_and_license_exist():
    source = ROOT / "font/source/upstream/InstrumentSans[wdth,wght].ttf"
    license_file = ROOT / "font/source/upstream/OFL.txt"
    assert source.stat().st_size > 100_000
    text = license_file.read_text(encoding="utf-8")
    assert "SIL OPEN FONT LICENSE Version 1.1" in text
    assert "Instrument Sans Project Authors" in text
```

- [ ] **Step 2: Run the test and confirm source files are absent**

Run: `python -m unittest discover -s viscue-brand-kit/tests -p "test_*.py"`  
Expected: FAIL with missing upstream source.

- [ ] **Step 3: Pin the build dependencies**

```text
fonttools[woff]==4.59.2
brotli==1.1.0
skia-pathops==0.8.0.post2
```

- [ ] **Step 4: Implement pinned source acquisition**

Download from the official `Instrument/instrument-sans` repository:

```powershell
$fontUrl = 'https://raw.githubusercontent.com/Instrument/instrument-sans/master/fonts/variable/InstrumentSans%5Bwdth%2Cwght%5D.ttf'
$licenseUrl = 'https://raw.githubusercontent.com/Instrument/instrument-sans/master/OFL.txt'
```

The script stores expected SHA-256 values as literals, downloads to sibling `.download` files, validates both hashes, then uses `Move-Item -LiteralPath` to publish the verified files. It never deletes outside `viscue-brand-kit/font/source/upstream`.

- [ ] **Step 5: Create the local environment and fetch sources**

Run: `python -m venv viscue-brand-kit/.venv`  
Run: `viscue-brand-kit/.venv/Scripts/python.exe -m pip install -r viscue-brand-kit/font/requirements.txt`  
Run: `powershell -ExecutionPolicy Bypass -File viscue-brand-kit/scripts/fetch-font-source.ps1`  
Expected: two verified source files are written.

- [ ] **Step 6: Run the source test**

Run: `viscue-brand-kit/.venv/Scripts/python.exe -m unittest discover -s viscue-brand-kit/tests -p "test_*.py"`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add viscue-brand-kit/.gitignore viscue-brand-kit/font/requirements.txt viscue-brand-kit/font/source/upstream viscue-brand-kit/scripts/fetch-font-source.ps1 viscue-brand-kit/tests/test_font_build.py
git commit -m "build(brand-kit): pin Viscue font source"
```

### Task 2: Build renamed Regular and Semibold static instances

**Files:**
- Create: `viscue-brand-kit/scripts/build-font.py`
- Modify: `viscue-brand-kit/tests/test_font_build.py`
- Generate: `viscue-brand-kit/font/ttf/ViscueFlowDisplay-Regular.ttf`
- Generate: `viscue-brand-kit/font/ttf/ViscueFlowDisplay-Semibold.ttf`

**Interfaces:**
- Produces: `build_weight(source: Path, output: Path, weight: int, style: str) -> None`.
- Produces: `rename_font(font: TTFont, family: str, style: str, weight: int) -> None`.

- [ ] **Step 1: Write static-instance metadata tests**

```python
from fontTools.ttLib import TTFont

def name_value(font, name_id):
    values = {record.toUnicode() for record in font['name'].names if record.nameID == name_id}
    assert len(values) == 1
    return values.pop()

def test_regular_metadata():
    font = TTFont(ROOT / 'font/ttf/ViscueFlowDisplay-Regular.ttf')
    assert name_value(font, 1) == 'Viscue Flow Display'
    assert name_value(font, 2) == 'Regular'
    assert name_value(font, 6) == 'ViscueFlowDisplay-Regular'
    assert font['OS/2'].usWeightClass == 400
    assert 'fvar' not in font

def test_semibold_metadata():
    font = TTFont(ROOT / 'font/ttf/ViscueFlowDisplay-Semibold.ttf')
    assert name_value(font, 2) == 'Semibold'
    assert name_value(font, 6) == 'ViscueFlowDisplay-Semibold'
    assert font['OS/2'].usWeightClass == 600
```

- [ ] **Step 2: Run metadata tests before implementing the build**

Run: `viscue-brand-kit/.venv/Scripts/python.exe -m unittest viscue-brand-kit.tests.test_font_build`  
Expected: FAIL because static TTF files are absent.

- [ ] **Step 3: Implement static instancing and renaming**

Use `fontTools.varLib.instancer.instantiateVariableFont` with `wdth=95` and `wght=400` or `600`. Remove variable tables after instancing. Replace name IDs 1, 2, 3, 4, 6, 16, and 17 consistently; set `OS/2.usWeightClass`; preserve the original copyright string and append `Modified for Viscue Flow Display, 2026.`

- [ ] **Step 4: Subset to the promised character repertoire**

Build the Unicode set from `U+0020–007E`, `U+00A0–00FF`, `U+2010–205E`, `U+20A0–20BF`, `U+2190–21FF`, and `U+2200–22FF`, retaining `.notdef`, OpenType layout, kerning, and name tables. The source repertoire may omit individual code points in the broader symbol ranges; record and test an explicit required set rather than claiming every code point in each range.

- [ ] **Step 5: Build and run tests**

Run: `viscue-brand-kit/.venv/Scripts/python.exe viscue-brand-kit/scripts/build-font.py`  
Expected: both TTF files are written.

Run: `viscue-brand-kit/.venv/Scripts/python.exe -m unittest viscue-brand-kit.tests.test_font_build`  
Expected: PASS for metadata and weight tests.

- [ ] **Step 6: Commit**

```bash
git add viscue-brand-kit/scripts/build-font.py viscue-brand-kit/font/ttf viscue-brand-kit/tests/test_font_build.py
git commit -m "feat(brand-kit): build Viscue font weights"
```

### Task 3: Apply the custom Humanist Flow glyph system

**Files:**
- Create: `viscue-brand-kit/font/source/glyph-style.json`
- Modify: `viscue-brand-kit/scripts/build-font.py`
- Modify: `viscue-brand-kit/tests/test_font_build.py`
- Regenerate: `viscue-brand-kit/font/ttf/*.ttf`

**Interfaces:**
- Produces: `apply_humanist_flow(font: TTFont, weight: int, style: dict) -> None`.
- Produces: private-use glyph `viscueMark` mapped to `U+E000`.

- [ ] **Step 1: Write custom-glyph fingerprint tests**

```python
SIGNATURE_GLYPHS = ['C','G','Q','S','V','e','g','t','two','three','eight','viscueMark']

def glyph_fingerprint(font, name):
    glyph = font.getGlyphSet()[name]
    pen = RecordingPen()
    glyph.draw(pen)
    return tuple(pen.value)

def test_signature_glyphs_differ_from_upstream_instances():
    custom = TTFont(ROOT / 'font/ttf/ViscueFlowDisplay-Regular.ttf')
    upstream = build_upstream_test_instance(weight=400, width=95)
    for name in SIGNATURE_GLYPHS[:-1]:
        assert glyph_fingerprint(custom, name) != glyph_fingerprint(upstream, name), name
    assert custom.getBestCmap()[0xE000] == 'viscueMark'
```

- [ ] **Step 2: Run the fingerprint test before custom transformations**

Run: `viscue-brand-kit/.venv/Scripts/python.exe -m unittest viscue-brand-kit.tests.test_font_build`  
Expected: FAIL because signature outlines still match upstream and `U+E000` is absent.

- [ ] **Step 3: Define the transformation values**

```json
{
  "terminalRoundRadius": {"400": 34, "600": 42},
  "cueCutWidth": {"400": 76, "600": 84},
  "cueCutHeight": {"400": 38, "600": 46},
  "openCounterShift": {"400": 22, "600": 18},
  "softCornerRadius": {"400": 28, "600": 34},
  "displayTracking": -12,
  "markCodepoint": "E000"
}
```

- [ ] **Step 4: Implement custom outlines and spacing**

Use decomposed outlines and skia-pathops boolean operations. Round the exposed terminals of `C`, `G`, `e`, and `t`; open `G` and `e` counters by the configured shift; soften the internal joins of `V`, `S`, `2`, `3`, and `8`; give `Q` a short horizontal cue tail. Draw `viscueMark` from the logo geometry as an open C/eye with a separate horizontal cue dash. Keep default letters readable; reserve the literal logo construction for `U+E000`.

Adjust side bearings for all signature glyphs so left and right bearings remain at least 30 units. Add kerning checks for `VC`, `VI`, `CU`, `UE`, `Flow`, `Visual`, `Cue`, and `Intent`.

- [ ] **Step 5: Rebuild and run signature tests**

Run: `viscue-brand-kit/.venv/Scripts/python.exe viscue-brand-kit/scripts/build-font.py`  
Run: `viscue-brand-kit/.venv/Scripts/python.exe -m unittest viscue-brand-kit.tests.test_font_build`  
Expected: PASS, including fingerprint, cmap, side-bearing, and kerning checks.

- [ ] **Step 6: Commit**

```bash
git add viscue-brand-kit/font/source/glyph-style.json viscue-brand-kit/scripts/build-font.py viscue-brand-kit/font/ttf viscue-brand-kit/tests/test_font_build.py
git commit -m "feat(brand-kit): add Humanist Flow glyph language"
```

### Task 4: Produce WOFF2, CSS, licensing, and font specimen

**Files:**
- Modify: `viscue-brand-kit/scripts/build-font.py`
- Generate: `viscue-brand-kit/font/woff2/ViscueFlowDisplay-Regular.woff2`
- Generate: `viscue-brand-kit/font/woff2/ViscueFlowDisplay-Semibold.woff2`
- Generate: `viscue-brand-kit/font/css/viscue-flow.css`
- Create: `viscue-brand-kit/font/LICENSE.txt`
- Create: `viscue-brand-kit/font/CHANGES.md`
- Create: `viscue-brand-kit/font/specimen/index.html`
- Modify: `viscue-brand-kit/tests/test_font_build.py`

**Interfaces:**
- Produces: CSS custom property `--font-viscue-display`.
- Produces: local specimen that visibly reports whether the custom face loaded.

- [ ] **Step 1: Write WOFF2 and CSS tests**

```python
def test_webfonts_and_css():
    for style in ('Regular', 'Semibold'):
        font = TTFont(ROOT / f'font/woff2/ViscueFlowDisplay-{style}.woff2')
        assert font.flavor == 'woff2'
    css = (ROOT / 'font/css/viscue-flow.css').read_text(encoding='utf-8')
    assert css.count('@font-face') == 2
    assert "font-display: swap" in css
    assert "--font-viscue-display" in css
```

- [ ] **Step 2: Run tests before creating web outputs**

Run: `viscue-brand-kit/.venv/Scripts/python.exe -m unittest viscue-brand-kit.tests.test_font_build`  
Expected: FAIL because WOFF2 and CSS outputs are absent.

- [ ] **Step 3: Generate WOFF2 and CSS**

Set `TTFont.flavor = 'woff2'` for web output. Generate two `@font-face` blocks with weights 400 and 600, `font-style: normal`, and `font-display: swap`, followed by:

```css
:root {
  --font-viscue-display: "Viscue Flow Display", "Instrument Sans", Inter, system-ui, sans-serif;
}
```

- [ ] **Step 4: Add licensing and change disclosure**

Copy the verified upstream OFL text unchanged to `LICENSE.txt`. `CHANGES.md` identifies the source repository and pinned source hash, confirms the new family name, lists the 12 signature glyphs, explains the width and weight instancing, and states that the derivative remains under SIL OFL 1.1.

- [ ] **Step 5: Build the specimen**

Show Regular and Semibold headings, uppercase and lowercase alphabets, numerals, punctuation, ambiguous-character strings (`Il1`, `O0`, `rn/m`), product phrases, and the `U+E000` logo glyph. Pair samples with Instrument Sans body copy to demonstrate the intended display/body separation.

- [ ] **Step 6: Run font tests**

Run: `viscue-brand-kit/.venv/Scripts/python.exe viscue-brand-kit/scripts/build-font.py`  
Run: `viscue-brand-kit/.venv/Scripts/python.exe -m unittest viscue-brand-kit.tests.test_font_build`  
Expected: PASS for TTF, WOFF2, CSS, license, and specimen presence.

- [ ] **Step 7: Commit**

```bash
git add viscue-brand-kit/font viscue-brand-kit/scripts/build-font.py viscue-brand-kit/tests/test_font_build.py
git commit -m "feat(brand-kit): publish Viscue Flow webfonts"
```

### Task 5: Add full font validation and assemble the combined brand preview

**Files:**
- Create: `viscue-brand-kit/scripts/validate-font.py`
- Modify: `viscue-brand-kit/tests/test_font_build.py`
- Create: `viscue-brand-kit/preview/brand-kit.html`
- Modify: `viscue-brand-kit/README.md`
- Modify: `viscue-brand-kit/package.json`

**Interfaces:**
- Produces: `validate_font(path: Path, expected_weight: int) -> list[str]`.
- Produces: `npm run build:font` and `npm run validate:font` wrappers around the project-local Python environment.

- [ ] **Step 1: Write validation failure tests**

Create in-memory or temporary copies with a wrong family name, wrong weight, missing `U+E000`, missing `A`, and an intentionally empty signature glyph. Assert each case returns a specific error containing the font filename and failed rule.

- [ ] **Step 2: Run tests before implementing the validator**

Run: `viscue-brand-kit/.venv/Scripts/python.exe -m unittest viscue-brand-kit.tests.test_font_build`  
Expected: FAIL on missing validator imports.

- [ ] **Step 3: Implement complete validation**

For all four binaries, verify font reopening, name IDs, style, weight, required cmap entries, non-empty required outlines, positive advance widths, glyph bounds within the font head limits, signature fingerprints, OFL presence, and matching TTF/WOFF2 glyph order.

- [ ] **Step 4: Assemble the combined preview and complete README usage**

The combined preview shows the Viscue logo, selected Humanist Flow typography, and representative icons for canvas, annotation, relationship, vision, prompt, and execution. The README documents CSS import, TTF installation, the logo glyph `&#xE000;`, display/body separation, accessibility, licensing, and build commands.

- [ ] **Step 5: Run complete font verification**

Run: `npm --prefix viscue-brand-kit run build:font`  
Expected: `Built Viscue Flow Display Regular 400 and Semibold 600.`

Run: `npm --prefix viscue-brand-kit run validate:font`  
Expected: `Validated 4 font binaries and required glyph coverage.`

Run: `viscue-brand-kit/.venv/Scripts/python.exe -m unittest discover -s viscue-brand-kit/tests -p "test_*.py"`  
Expected: all font tests pass with zero failures.

- [ ] **Step 6: Commit**

```bash
git add viscue-brand-kit/scripts/validate-font.py viscue-brand-kit/tests/test_font_build.py viscue-brand-kit/preview/brand-kit.html viscue-brand-kit/README.md viscue-brand-kit/package.json
git commit -m "test(brand-kit): validate Viscue font family"
```
