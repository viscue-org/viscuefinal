from pathlib import Path
import unittest

ROOT = Path(__file__).parents[1]

class FontBuildTests(unittest.TestCase):
    def test_upstream_source_and_license_exist(self):
        source = ROOT / "font/source/upstream/InstrumentSans[wdth,wght].ttf"
        license_file = ROOT / "font/source/upstream/OFL.txt"
        self.assertTrue(source.exists(), "Upstream source font missing")
        self.assertTrue(license_file.exists(), "Upstream license missing")
        self.assertGreater(source.stat().st_size, 100_000, "Source font size too small")
        text = license_file.read_text(encoding="utf-8")
        self.assertIn("SIL OPEN FONT LICENSE Version 1.1", text)
        self.assertIn("Instrument Sans Project Authors", text)

from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen
from fontTools.varLib.instancer import instantiateVariableFont

def name_value(font, name_id):
    values = {record.toUnicode() for record in font['name'].names if record.nameID == name_id}
    assert len(values) == 1
    return values.pop()

SIGNATURE_GLYPHS = ['C','G','Q','S','V','e','g','t','two','three','eight','viscueMark']

def glyph_fingerprint(font, name):
    glyph = font.getGlyphSet()[name]
    pen = RecordingPen()
    glyph.draw(pen)
    return tuple(pen.value)

def build_upstream_test_instance(weight=400, width=95):
    source = ROOT / "font/source/upstream/InstrumentSans[wdth,wght].ttf"
    font = TTFont(source)
    axes = {"wdth": width, "wght": weight}
    return instantiateVariableFont(font, axes, inplace=False, overlap=True)

class FontMetadataTests(unittest.TestCase):
    def test_regular_metadata(self):
        font = TTFont(ROOT / 'font/ttf/ViscueFlowDisplay-Regular.ttf')
        self.assertEqual(name_value(font, 1), 'Viscue Flow Display')
        self.assertEqual(name_value(font, 2), 'Regular')
        self.assertEqual(name_value(font, 6), 'ViscueFlowDisplay-Regular')
        self.assertEqual(font['OS/2'].usWeightClass, 400)
        self.assertNotIn('fvar', font)

    def test_semibold_metadata(self):
        font = TTFont(ROOT / 'font/ttf/ViscueFlowDisplay-Semibold.ttf')
        self.assertEqual(name_value(font, 2), 'Semibold')
        self.assertEqual(name_value(font, 6), 'ViscueFlowDisplay-Semibold')
        self.assertEqual(font['OS/2'].usWeightClass, 600)

    def test_signature_glyphs_differ_from_upstream_instances(self):
        custom = TTFont(ROOT / 'font/ttf/ViscueFlowDisplay-Regular.ttf')
        upstream = build_upstream_test_instance(weight=400, width=95)
        for name in SIGNATURE_GLYPHS[:-1]:
            self.assertNotEqual(glyph_fingerprint(custom, name), glyph_fingerprint(upstream, name), f"Glyph {name} matches upstream")
        self.assertEqual(custom.getBestCmap().get(0xE000), 'viscueMark')

    def test_webfonts_and_css(self):
        for style in ('Regular', 'Semibold'):
            font = TTFont(ROOT / f'font/woff2/ViscueFlowDisplay-{style}.woff2')
            self.assertEqual(font.flavor, 'woff2')
        css = (ROOT / 'font/css/viscue-flow.css').read_text(encoding='utf-8')
        self.assertEqual(css.count('@font-face'), 2)
        self.assertIn("font-display: swap", css)
        self.assertIn("--font-viscue-display", css)

