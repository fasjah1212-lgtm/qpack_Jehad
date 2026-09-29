# QPACK — From Flat Sheet to Finished Package

A new website for **مصنع القصيم للكرتون المضلع (QPACK)**, built around one rule:
**the website behaves like cardboard.** It layers, gets cut, gets printed, folds, opens and packs.

Static site with no build step and no dependencies. Open `index.html` or serve the folder:

```bash
python3 -m http.server 8080   # → http://localhost:8080
```

## The story (scroll order)

| # | Section | What happens |
|---|---------|--------------|
| 00–05 | **Journey** (pinned) | A flat corrugated sheet splits into liner / flute / liner. The cutter draws die-lines and the waste board drops away. The print head prints the sheet. The panels fold up, the flaps close, and the finished box turns. |
| 06 | **About: layers** | A board splits into 5 plies: Experience, Quality, Factory, Technology, Service. Each ply slides out of the stack with its official text. Then vision, mission and values. |
| ↓ | **Flap fold** | The bottom of the page folds away like a box flap into Products. |
| 07 | **Products explorer** | The box opens and the categories rise out of it. Pick a type, size, sector and print, and the same box changes shape: handle holes, die-cut window, lowered display front, dimensions, print. Drag to rotate. |
| 08 | **Sectors** (pinned) | The same finished box stays in place while the scene around it changes. |
| ↓ | **Cutter** | A die-cut blade crosses the screen and reveals the next section. |
| 09 | **Quality** (pinned) | Close-up of the corrugated cross-section, zoom, engineering dimension lines, and inspection pins with the officially stated claims only (TQM, ISO 9001/14001/45001, 5M, recyclable). |
| 10 | **Paper roll** | The official milestones unroll on a paper strip. Then news and careers. |
| 11 | **Quote wizard** | Box, then dimensions, quantity, print, your details. The mockup folds a bit more at every step and ends as a closed box with the summary. Submitting opens an email to `INFO@QPACK.COM.SA`. |
| 12 | **Finale** | The box closes and moves aside: "لنصنع تغليفك القادم." Then contacts, the regional numbers and a map. |
| — | **Footer** | The inside of an open box (kraft, flaps, crease lines). |

## Architecture

```
index.html        structure (RTL, Arabic)
css/style.css     tokens, layout, the CSS-3D box, all sections, responsive + reduced-motion
js/content.js     ← the ONLY place content lives (official texts, contacts, products…)
js/box.js         QBox: a real foldable RSC die-line in CSS 3D (~40 nodes)
js/main.js        scroll engine + every scene
assets/           logo (placeholder), favicon, static fallback illustration
```

**Why CSS 3D and not WebGL/GLB:** a corrugated box is flat panels and hinges, so nested CSS
transforms model it exactly, with no model download, no WebGL context and no Draco or Meshopt
decoder. The whole 3D experience weighs a few KB, stays crisp at any zoom, and the same component
is reused in six places. If a future scene needs photoreal materials, add a lazily loaded
`<model-viewer>` with a Draco-compressed GLB **only in that section**. Nothing else needs to change.

**Performance.** One `requestAnimationFrame` loop drives every scene. Only scenes on screen
(tracked by IntersectionObserver) are updated. Progress is smoothed with frame-rate-independent
inertia, which gives the heavy, no-bounce motion. Everything animates `transform` and `opacity`.
The map iframe loads only when it gets close to the viewport.

**Responsive tiers.**
- **Desktop:** the full experience, plus the precision-crosshair cursor with *Explore* / *Rotate* labels.
- **Tablet (≤1100px):** shorter pinned scroll lengths.
- **Mobile (≤900px):** shorter journey, About becomes a static exploded stack, a native swipeable
  paper roll, a list instead of floating quality pins, and no custom cursor.
- **`prefers-reduced-motion`:** no scroll-scrubbing. Every scene shows its finished state.
- **No CSS 3D support:** a static SVG box illustration.

## ⚠️ Before launch — content verification

The build environment's network proxy **blocked qpack.com.sa** (and X and Argaam), so the official
content was collected from search-engine indexes of the official pages (`/`, `aboutUs.html`,
`contact.html`, `jobs.html`) and the official LinkedIn page. Nothing was invented. Some items still
need a human check, and they are flagged in `js/content.js`:

- `verify: true`: the meaning is official, but the Arabic wording was rebuilt from the index
  snippet. **Compare it with the live page** (vision, mission, values, layer texts, news).
- `draft: true`: no official source was found. These show a **DRAFT** badge on the page while
  `SHOW_DRAFT_BADGES` is `true`:
  - **Products:** the 5 structural models are generic corrugated forms used to drive the
    explorer. Replace them with QPACK's official product list.
  - **Sectors:** Food and Beverages come from the brief. Only "الصناعات التحويلية المتنوعة" was found officially.
- **Logo and brand colours:** not reachable. `assets/logo.svg` is a placeholder wordmark, and
  `--brand` / `--brand-2` in `css/style.css` are placeholders. Drop in the official logo (same
  filename) and update those two lines. Everything re-skins from them.
- **Timeline:** the only official date found is 2005 (founding, LinkedIn). The other marks are
  milestones without a year, on purpose.

Official data used: headline "الشريك الموثوق لحلول التغليف المبتكرة", the founding and
capacity paragraph, the AL-AREFEE GROUP origin, TQM and ISO 9001/14001/45001, the 5M concepts,
recyclable materials, the tagline *Quality Packaging · Quiet Costs · Quick Service*, the address,
the main and 6 regional phone numbers, `INFO@QPACK.COM.SA`, `Careers@qpack.com.sa`, and
X `@QPACK_KSA` and LinkedIn.
