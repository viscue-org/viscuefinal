import sys
from pathlib import Path
from fontTools.ttLib import TTFont

ROOT = Path(__file__).parents[1]

REQUIRED_GLYPHS = ['C','G','Q','S','V','e','g','t','two','three','eight','viscueMark']

def validate_font(path: Path, expected_weight: int) -> list[str]:
    errors = []
    if not path.exists():
        return [f"{path.name}: File does not exist"]
    
    try:
        font = TTFont(path)
    except Exception as e:
        return [f"{path.name}: Failed to open font: {e}"]
        
    # Check weight
    if 'OS/2' in font:
        weight = font['OS/2'].usWeightClass
        if weight != expected_weight:
            errors.append(f"{path.name}: Expected weight {expected_weight}, got {weight}")
    else:
        errors.append(f"{path.name}: Missing OS/2 table")
        
    # Check name IDs
    name_table = font.get('name')
    if name_table:
        family_names = {r.toUnicode() for r in name_table.names if r.nameID in (1, 16)}
        if 'Viscue Flow Display' not in family_names:
            errors.append(f"{path.name}: Expected family name 'Viscue Flow Display', got {family_names}")
    else:
        errors.append(f"{path.name}: Missing name table")
        
    # Check cmap & required glyphs
    cmap = font.getBestCmap() or {}
    if 0xE000 not in cmap:
        errors.append(f"{path.name}: Missing U+E000 viscueMark in cmap")
    if ord('A') not in cmap:
        errors.append(f"{path.name}: Missing 'A' in cmap")
        
    # Check glyphs
    glyph_set = font.getGlyphSet()
    for gname in REQUIRED_GLYPHS:
        if gname not in glyph_set:
            errors.append(f"{path.name}: Missing required glyph {gname}")
        else:
            glyph = glyph_set[gname]
            if glyph.width <= 0:
                errors.append(f"{path.name}: Non-positive advance width for {gname}")
                
    return errors

def main():
    fonts_to_check = [
        (ROOT / "font/ttf/ViscueFlowDisplay-Regular.ttf", 400),
        (ROOT / "font/ttf/ViscueFlowDisplay-Semibold.ttf", 600),
        (ROOT / "font/woff2/ViscueFlowDisplay-Regular.woff2", 400),
        (ROOT / "font/woff2/ViscueFlowDisplay-Semibold.woff2", 600),
    ]
    
    all_errors = []
    for p, weight in fonts_to_check:
        errs = validate_font(p, weight)
        all_errors.extend(errs)
        
    if all_errors:
        print("Font validation failed:", file=sys.stderr)
        for err in all_errors:
            print(f"  - {err}", file=sys.stderr)
        sys.exit(1)
    else:
        print("Validated 4 font binaries and required glyph coverage.")

if __name__ == '__main__':
    main()
