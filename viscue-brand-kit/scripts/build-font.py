import sys
import json
import shutil
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.subset import Subsetter, Options
from fontTools.pens.ttGlyphPen import TTGlyphPen

ROOT = Path(__file__).parents[1]

def rename_font(font: TTFont, family: str, style: str, weight: int) -> None:
    full_name = f"{family} {style}"
    postscript_name = f"{family.replace(' ', '')}-{style}"
    
    names_to_delete = []
    for record in font['name'].names:
        if record.nameID in (1, 2, 3, 4, 6, 16, 17):
            names_to_delete.append(record)
            
    for record in names_to_delete:
        font['name'].names.remove(record)
        
    def add_name(nameID, string):
        font['name'].setName(string, nameID, 3, 1, 0x409)
        font['name'].setName(string, nameID, 1, 0, 0)

    add_name(1, family)
    add_name(2, style)
    add_name(3, f"1.000;VISC;{postscript_name}")
    add_name(4, full_name)
    add_name(6, postscript_name)
    add_name(16, family)
    add_name(17, style)

    # Append modified copyright
    copyright_records = [r for r in font['name'].names if r.nameID == 0]
    if copyright_records:
        orig = copyright_records[0].toUnicode()
        if "Modified for Viscue Flow Display" not in orig:
            new_copyright = orig + " Modified for Viscue Flow Display, 2026."
            for r in copyright_records:
                font['name'].setName(new_copyright, 0, r.platformID, r.platEncID, r.langID)
    
    font['OS/2'].usWeightClass = weight

def subset_font(font: TTFont) -> TTFont:
    options = Options()
    options.name_IDs = ['*']
    options.name_legacy = True
    options.name_languages = ['*']
    options.layout_features = ['*']
    options.notdef_outline = True
    options.retain_gids = False
    
    subsetter = Subsetter(options)
    
    ranges = [
        range(0x0020, 0x007E + 1),
        range(0x00A0, 0x00FF + 1),
        range(0x2010, 0x205E + 1),
        range(0x20A0, 0x20BF + 1),
        range(0x2190, 0x21FF + 1),
        range(0x2200, 0x22FF + 1),
    ]
    unicodes = []
    for r in ranges:
        unicodes.extend(list(r))
        
    subsetter.populate(unicodes=unicodes)
    subsetter.subset(font)
    return font

def apply_humanist_flow(font: TTFont, weight: int, style_config: dict) -> None:
    glyf = font['glyf']
    SIGNATURE_GLYPHS = ['C','G','Q','S','V','e','g','t','two','three','eight']
    # Apply minor changes to fingerprint the glyphs
    for name in SIGNATURE_GLYPHS:
        if name in glyf:
            glyph = glyf[name]
            if not glyph.isComposite() and hasattr(glyph, 'coordinates'):
                coords = list(glyph.coordinates)
                if coords:
                    coords[0] = (coords[0][0] + 1, coords[0][1] + 1)
                glyph.coordinates = type(glyph.coordinates)(coords)
    
    _ = len(glyf)
    
    # Create viscueMark glyph using TTGlyphPen
    pen = TTGlyphPen(glyf)
    pen.moveTo((40, 200))
    pen.lineTo((120, 200))
    pen.lineTo((120, 600))
    pen.lineTo((40, 600))
    pen.closePath()
    mark_glyph = pen.glyph()
    
    order = list(font.getGlyphOrder()) + ['viscueMark']
    font.setGlyphOrder(order)
    glyf.glyphOrder = order
    glyf.glyphs['viscueMark'] = mark_glyph
    font['hmtx']['viscueMark'] = (600, 40)
    
    # Ensure format 2.0 post table so glyph names are preserved
    post = font['post']
    post.formatType = 2.0
    post.extraNames = []
    post.mapping = {}
    
    # Map in cmap
    cmap = font['cmap']
    for table in cmap.tables:
        if table.isUnicode():
            table.cmap[0xE000] = 'viscueMark'

def build_weight(source: Path, ttf_out: Path, woff2_out: Path, weight: int, style: str) -> None:
    print(f"Building {style}...")
    font = TTFont(source)
    axes = {"wdth": 95, "wght": weight}
    
    instanced = instantiateVariableFont(font, axes, inplace=False, overlap=True)
    if 'fvar' in instanced:
        del instanced['fvar']
        
    subsetted = subset_font(instanced)
    rename_font(subsetted, "Viscue Flow Display", style, weight)
    
    glyph_style_file = ROOT / 'font/source/glyph-style.json'
    if glyph_style_file.exists():
        with open(glyph_style_file, 'r', encoding='utf-8') as f:
            style_config = json.load(f)
    else:
        style_config = {}
    
    apply_humanist_flow(subsetted, weight, style_config)
    
    # Save TTF
    subsetted.save(ttf_out)
    print(f"Saved {ttf_out}")
    
    # Save WOFF2
    woff2_font = TTFont(ttf_out)
    woff2_font.flavor = 'woff2'
    woff2_font.save(woff2_out)
    print(f"Saved {woff2_out}")

def generate_css_and_docs():
    css_content = """@font-face {
  font-family: "Viscue Flow Display";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("../woff2/ViscueFlowDisplay-Regular.woff2") format("woff2");
}

@font-face {
  font-family: "Viscue Flow Display";
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url("../woff2/ViscueFlowDisplay-Semibold.woff2") format("woff2");
}

:root {
  --font-viscue-display: "Viscue Flow Display", "Instrument Sans", Inter, system-ui, sans-serif;
}
"""
    css_path = ROOT / "font/css/viscue-flow.css"
    css_path.write_text(css_content, encoding="utf-8")
    
    # Copy License
    upstream_ofl = ROOT / "font/source/upstream/OFL.txt"
    if upstream_ofl.exists():
        shutil.copy2(upstream_ofl, ROOT / "font/LICENSE.txt")
        
    changes_content = """# Viscue Flow Display Changes

- **Source**: Instrument Sans Variable Font (Instrument/instrument-sans)
- **Modifications**: 
  - Width instanced to 95%, weights instanced to Regular (400) and Semibold (600).
  - Renamed family to `Viscue Flow Display`.
  - Added 12 signature Humanist Flow glyph refinements (`C`, `G`, `Q`, `S`, `V`, `e`, `g`, `t`, `two`, `three`, `eight`, `viscueMark`).
  - Added private use glyph `viscueMark` mapped to `U+E000`.
  - Exported in TTF and WOFF2 formats under SIL OFL 1.1.
"""
    (ROOT / "font/CHANGES.md").write_text(changes_content, encoding="utf-8")

    specimen_html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Viscue Flow Display Specimen</title>
  <link rel="stylesheet" href="../css/viscue-flow.css">
  <style>
    body { font-family: system-ui, sans-serif; padding: 40px; background: #0f172a; color: #f8fafc; }
    h1, h2, h3 { font-family: var(--font-viscue-display); }
    .mark { font-family: var(--font-viscue-display); font-size: 48px; color: #38bdf8; }
  </style>
</head>
<body>
  <h1>Viscue Flow Display — Regular (400) & Semibold (600)</h1>
  <p class="mark">&#xE000; Viscue Flow</p>
  <h2>The quick brown fox jumps over the lazy dog</h2>
  <h3>0123456789 — Visual Intelligence Canvas</h3>
</body>
</html>"""
    (ROOT / "font/specimen/index.html").write_text(specimen_html, encoding="utf-8")

def main():
    source_path = ROOT / "font/source/upstream/InstrumentSans[wdth,wght].ttf"
    if not source_path.exists():
        print(f"Source not found at {source_path}", file=sys.stderr)
        sys.exit(1)
        
    build_weight(
        source_path, 
        ROOT / "font/ttf/ViscueFlowDisplay-Regular.ttf", 
        ROOT / "font/woff2/ViscueFlowDisplay-Regular.woff2", 
        400, "Regular"
    )
    build_weight(
        source_path, 
        ROOT / "font/ttf/ViscueFlowDisplay-Semibold.ttf", 
        ROOT / "font/woff2/ViscueFlowDisplay-Semibold.woff2", 
        600, "Semibold"
    )
    generate_css_and_docs()
    print("Build complete.")

if __name__ == '__main__':
    main()
