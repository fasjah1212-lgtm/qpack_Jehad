# QPACK — From Flat Sheet to Finished Package

A new website for **مصنع القصيم للكرتون المضلع (QPACK)**, built around one rule:
**the website behaves like cardboard.** It layers, gets cut, gets printed, folds, opens and packs.

Static site with no build step and no dependencies. Open `index.html` or serve the folder:

```bash
python3 -m http.server 8080   # → http://localhost:8080
```

## The story (scroll order)

| Section | What happens |
|---------|--------------|
| **Journey** (pinned) | The hero opens with the official milestones strip (2005, +14, KSA+, ISO). On scroll, a flat corrugated sheet splits into its layers. Die-lines are cut, the sheet is printed, the panels fold, and the box closes. |
| **About: layers** | A board splits into 5 plies: Experience, Quality, Factory, Technology, Service. Then vision, mission and values. The bottom of the page folds away like a box flap. |
| **Products explorer** | The box opens and the categories rise out of it. Choose type, size, sector and print, and the box changes shape. "Request a quote" opens an email to `INFO@QPACK.COM.SA` prefilled with the chosen model. |
| **News & careers** | Official news items and the careers email. |
| **Contact** | Main and regional numbers, email, address, map. |
| **Footer** | The inside of an open box, in brand copper, with the designer signature. |

## Design system

All of it lives in the tokens at the top of `css/style.css`:
- **Colour:** official copper `--brand #BB8546` (with `-600`, `-800`, `-100`, `-50` steps), warm neutrals, and one dark tone for Products.
- **Type:** one family, IBM Plex Sans Arabic, at 400/500/700. Scale: `.t-display`, `.t-h1`, `.t-h2`, `.t-h3`, `.t-lead`, `.t-body`, `.t-small`, `.label`.
- **Components:** `.btn--primary` / `.btn--secondary`, `.card`, `.chip`, `.sec-head`.
- **Space:** a 4px grid (`--s-1` to `--s-10`). **Radius:** `--r-sm` and `--r-md`.

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
is reused in the hero and the product explorer. If a future scene needs photoreal materials, add a lazily loaded
`<model-viewer>` with a Draco-compressed GLB **only in that section**. Nothing else needs to change.

**Performance.** One `requestAnimationFrame` loop drives every scene. Only scenes on screen
(tracked by IntersectionObserver) are updated. Progress is smoothed with frame-rate-independent
inertia, which gives the heavy, no-bounce motion. Everything animates `transform` and `opacity`.
The map iframe loads only when it gets close to the viewport.

**Responsive tiers.**
- **Desktop:** the full experience, with the normal system cursor.
- **Tablet (≤1100px):** shorter pinned scroll lengths.
- **Mobile (≤900px):** shorter journey, a compact milestones strip, and About becomes a static exploded stack.
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
- **Logo:** extracted from a screenshot of the official site (`assets/logo*.png`). Replace it with the original high-resolution file when available.
- **Timeline:** the only official date found is 2005 (founding, LinkedIn). The other marks are
  milestones without a year, on purpose.

Official data used: headline "الشريك الموثوق لحلول التغليف المبتكرة", the founding and
capacity paragraph, the AL-AREFEE GROUP origin, TQM and ISO 9001/14001/45001, the 5M concepts,
recyclable materials, the tagline *Quality Packaging · Quiet Costs · Quick Service*, the address,
the main and 6 regional phone numbers, `INFO@QPACK.COM.SA`, `Careers@qpack.com.sa`, and
X `@QPACK_KSA` and LinkedIn.
