# Viscue Brand Kit

This package contains the official **Viscue Flow Display** typeface system and brand assets.

## Viscue Flow Display

- **Family**: `Viscue Flow Display`
- **Weights**: Regular (`400`), Semibold (`600`)
- **Formats**: TTF (Desktop), WOFF2 (Web)
- **License**: SIL Open Font License 1.1

### Usage in CSS

```css
@import url("viscue-brand-kit/font/css/viscue-flow.css");

h1, h2, h3, .brand-title {
  font-family: var(--font-viscue-display);
}
```

### Brand Glyph

- `&#xE000;` maps to the custom `viscueMark` glyph.

### Build & Validation Commands

- `npm run build:font` — Builds static TTF and WOFF2 instances with custom Humanist Flow glyphs.
- `npm run validate:font` — Validates binary integrity, tables, weights, and glyph coverage.
- `npm run test` — Runs automated test suite.
