# Dream Clean Design System

Brand & UI system for **Dream Clean by DC**, a family-owned, premium residential & commercial cleaning company in Orlando, FL, repositioning for the luxury market (homes, vacation-rental turnovers, offices, property management).

## Sources
- `Dream Clean Brand Guidelines.docx` (v1.0, June 2026) — canonical name, logo, color, type, and voice rules.
- Business card, invoice/estimate templates, operations spreadsheet, social media kit (uploaded ZIP).
- Live operations app + client portal + lead form: github.com/dreamcleanbydcfl/dreamclean-by-dc
- Digital business card with instant-estimate calculator: `dream clean 2026 card.html` (pricing logic reused as-is in the marketing site's quote tool).
- Old pre-rebrand site (superseded, not used as a style reference): dreamcleanbydc.com (Google Sites).

Explore the GitHub repo directly for the live app's exact markup/behavior if extending this system further.

## Components
- **Button** — `components/core/` — ink / gold / sage / outline / ghost CTA button.
- **Badge** — `components/core/` — status pill (gray/gold/sage/success/danger/info).
- **Card** — `components/core/` — base elevated surface (white, hairline border, soft shadow).

## Typography note
The Brand Guidelines specify **Forum** (serif) + **Montserrat** (sans). The company's own shipped product — dashboard, client portal, lead form — instead ships **Playfair Display** + **Jost**. This system follows the *shipped* pairing so the marketing site, the app, and anything built from here look like one product. Flag this drift if the client wants it reconciled back to Forum/Montserrat.

## Content fundamentals
- **Tone:** trustworthy, warm, professional, discreet, detail-oriented. "We leave your home magazine-ready." / "Reliable, vetted, and on time." Never discount or clip-art language ("Cheap and fast cleaning!!").
- **Trust signals everywhere:** Licensed · Insured · Bonded · Background-checked (drop "Bonded" until confirmed).
- **Bilingual:** Orlando is bilingual; English leads on brand materials, same premium tone in Spanish.
- **Casing:** small-caps / letter-spaced uppercase for labels and descriptors; sentence case for headlines and body.
- No emoji in brand voice, except already-shipped social copy (📞 ✉️ 🌐) — don't extend that habit to the site or app.

## Visual foundations
- **Palette:** Crema `#F5F5EF` (canvas) / Arena `#F1E9DF` (section bg) / Sage `#8E9C82` (natural accent) / Camel `#B08B6D` (warm secondary) / Gold `#B68911` (identity — logo, headlines, accents only, never body text) / Espresso `#3A332A` (single dark anchor — all body text, dark surfaces).
- **Type:** Playfair Display for headlines/display moments; Jost for body, labels, and data. One serif headline + sans for everything else — no third family.
- **Backgrounds:** flat brand colors or full-bleed photography; no gradients, no busy patterns behind the logo, no bright cleaning-blue.
- **Cards:** white, 10px radius, 1px hairline border (`--border-subtle`), soft two-layer espresso-tinted shadow — never a colored left-border accent.
- **Corner radii:** 6/10/16/24px + full pill for chips/buttons.
- **Shadows:** soft, warm-tinted (espresso at low opacity), never pure black or cool gray.
- **Motion:** understated — fades and gentle rises (10–20px), soft-out easing, no bounce/elastic. Hover = slight opacity drop + 2px lift; press = scale to .97–.98.
- **Imagery:** warm, bright, true-to-life interiors — no cold/blue color grading, no heavy grain.

## Iconography
- The live app uses hand-drawn inline SVG line icons (stroke-based, 1.6–2px stroke, no fill except small accent dots) — see `components/core` for the pattern. No icon font, no emoji as icon substitutes.
- No production logo mark exists beyond the DC monogram/seal supplied in `assets/logos/` — do not invent a new mark.

## Index
- `styles.css` — root stylesheet (imports `tokens/*`).
- `tokens/` — colors, typography, spacing, effects (shadow/radius/motion).
- `assets/logos/` — primary lockup, submark/seal, reversed-on-dark, descriptor variants.
- `components/core/` — Button, Badge, Card.
- `guidelines/` — foundation specimen cards (colors, type, spacing, logo).
- `ui_kits/marketing-site/` — full interactive marketing homepage, incl. the instant-estimate calculator ported from the digital business card.
- `SKILL.md` — portable skill file for use in Claude Code.
