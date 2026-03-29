# Philmont 2025 Trail Map

Interactive Mapbox GL JS trip journal for a 12-day Philmont Scout Ranch trek.
**Itinerary 12-13 — South Country Rugged** (~59 miles, Cimarrón, NM)

---

## File Structure

```
philmont-2025/
├── index.html   — markup shell only; no inline styles or logic
├── style.css    — all design tokens, layout, and component styles
├── app.js       — all map logic, sidebar, animation, elevation chart, modal
├── data.js      — all trip data (edit this file to update content)
└── CLAUDE.md    — this file
```

### Key rule: data vs. logic separation
- **Content changes** (narratives, photos, route coordinates, camp stats) → `data.js` only
- **Behavior changes** (animation, camera, UI interactions) → `app.js`
- **Visual changes** (colors, layout, typography) → `style.css`
- **Structure changes** (new sections, new HTML elements) → `index.html`

---

## Stack

| Library | Version | CDN |
|---|---|---|
| Mapbox GL JS | v3.3.0 | api.mapbox.com |
| Chart.js | v4.4.0 | cdn.jsdelivr.net |
| Google Fonts | — | Playfair Display + Source Serif 4 |

No build step, no framework — vanilla JS only. All dependencies loaded via CDN `<script>` tags in `index.html`.

---

## Data Architecture (data.js)

### `MAPBOX_TOKEN`
Public token string. Always read from here — never hardcode in `app.js` or `index.html`.

### `TRIP`
Trip metadata object. Shape:
```js
{
  title:      String,    // displayed in header
  subtitle:   String,    // itinerary / mileage line
  crew:       String,    // crew identifier
  dates:      String,    // human-readable date range
  totalMiles: Number,
  totalDays:  Number,
  mapCenter:           [lng, lat],
  mapZoom:             Number,
  mapPitch:            Number,
  mapBearing:          Number,
  terrainExaggeration: Number,
}
```

### `DAYS[]`
Array of 12 objects, one per day. Shape:
```js
{
  day:       Number,             // 1–12
  name:      String,             // full camp name
  subtitle:  String,             // "Day N · short description"
  miles:     Number,             // 0 for Day 1
  gain:      Number,             // elevation gain in feet
  loss:      Number,             // elevation loss in feet
  elevation: Number,             // camp elevation in feet
  coords:    { lat, lng },       // camp location for map marker
  type:      String,             // 'staffed' | 'trail' | 'dry' | 'layover'
  features:  String[],           // program features (rendered as tags)
  narrative: String,             // journal paragraph shown in sidebar
  photos:    [],                 // reserved for future per-day photo refs
}
```

### `PHOTOS[]`
Array of photo objects. Shape:
```js
{
  day:     Number,   // which day this photo belongs to
  lat:     Number,   // where the photo was taken
  lng:     Number,
  url:     String,   // full-size image URL
  caption: String,   // shown in modal / sidebar
}
```

**To add a photo:** append an entry to `PHOTOS[]`. The sidebar photo grid and map marker are both generated automatically. No changes needed in `app.js`.

### `FULL_ROUTE`
Array of `[lng, lat]` pairs forming the complete 12-day trail as a single LineString. Decimated from real GPX data (2056 pts from 6,167 GPX points — step=3).

### `DAY_SEGMENTS[]`
Maps each day (index 0–11) to a `{ start, end }` slice of `FULL_ROUTE`. Derived from the same GPX export as `FULL_ROUTE`.

### `ELEV_PROFILE[]`
Array of elevation values (feet) parallel to `FULL_ROUTE` points. Derived from the same GPX export as `FULL_ROUTE`.

---

## Critical Implementation Patterns

### Photo onclick — use index, never inline JSON
Photo objects must **never** be serialized into HTML `onclick` attributes. The coords array causes syntax errors in HTML attribute context.

```js
// ✅ CORRECT — reference by index into global PHOTOS array
`<div class="photo-thumb" onclick="openModal(PHOTOS[${p._idx}])">`

// ❌ WRONG — JSON.stringify into onclick breaks on coordinate numbers
`<div class="photo-thumb" onclick="openModal(${JSON.stringify(p)})">`
```

### Satellite style toggle — restore layers after style swap
When `toggleSatellite()` changes the Mapbox style, all sources and layers are destroyed. `restoreRouteLayers()` in `app.js` rebuilds them. Any new layers added to the map must also be added to `restoreRouteLayers()` or they will disappear on satellite toggle.

### Local file compatibility
`data.js` is a `.js` file (not `.json`) specifically so it can be loaded with `<script src="data.js">` without a web server. Fetch + CORS blocks `.json` on `file://` URLs. Do not convert to `.json` unless the project is always served from a web server.

---

## Design Tokens (style.css)

```css
--ink:            #1a1410   /* near-black background */
--parchment:      #f5f0e8   /* sidebar / light panels */
--parchment-dark: #ede6d6   /* subtle inset surfaces */
--rust:           #8b3a1a   /* primary accent (dark) */
--rust-light:     #c4622d   /* active route line, highlights */
--pine:           #2d4a2d   /* feature tags background */
--gold:           #c9972a   /* camp markers, header accent */
--gold-light:     #e8c46a   /* animated route line, stat values */
--stone:          #7a7065   /* muted text, borders */
--stone-light:    #a89f94   /* secondary muted text */
--sidebar-w:      340px
--elev-h:         110px
```

Typography: `Playfair Display` (headers, numbers) + `Source Serif 4` (body, UI).

---

## Map Layers (in render order)

| Layer ID | Source | Purpose |
|---|---|---|
| `sky` | built-in | Atmosphere / sky rendering |
| `route-bg` | `full-route` | Full dimmed trail (all 12 days) |
| `active-route` | `active-segment` | Highlighted segment for selected day |
| `anim-route` | `anim-line` | Gold line drawn progressively during animation |

Camp markers and photo markers are Mapbox HTML markers (not GL layers).

---

## Hosting

**GitHub Pages** — static site, no server required.
Mapbox token is a public token (safe to commit). For production, restrict the token to your GitHub Pages domain in the Mapbox dashboard.

---

## TODO / Backlog

- [x] Replace `FULL_ROUTE` with real GPX-derived coordinates
- [x] Update `DAY_SEGMENTS` index ranges to match real GPS data
- [x] Replace `ELEV_PROFILE` with GPX elevation data
- [ ] Add real photo URLs to `PHOTOS[]` in `data.js`
- [ ] Write real crew narratives in `DAYS[].narrative` (current text is AI-drafted)
- [ ] Update the scout count in `index.html` header stats (currently "13")
- [ ] Restrict Mapbox token to GitHub Pages domain
- [ ] Consider a `photos/` subfolder for locally hosted images
- [ ] Mobile responsive layout (sidebar collapses on small screens)
