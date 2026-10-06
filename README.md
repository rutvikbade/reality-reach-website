# realityreach.com

The corporate site of Reality Reach Technologies LLP, and the Reality Reach brand department.

```
site/       the website — static, no build step, no external dependencies
brand/      the brand department — architecture, voice, visual standards, the ASCII drawing language, decisions, open questions
serve.mjs   local preview server (Node, no dependencies)
```

## Run locally

```sh
node serve.mjs          # serves site/ on :8080; `node serve.mjs 8090` for another port
```

Open http://localhost:8080. Append `?p=0` … `?p=2` to hold the opening story at a chapter (`?p=0.45` is the handshake).

## Deploy

Static hosting with `site/` as the public directory. realityreach.com resolves to Firebase Hosting
(project `reality-reach`); point its `public` at `site` and serve `404.html` for unknown paths.

## What is where

| Path | What |
|---|---|
| `site/index.html` | The page, in order: the story (ASCII theatre: partnership, the decade, the work), readings (since this page opened), practice, work (the CapWatch feature and the index), values, company, contact (the golf scene) |
| `site/legal/` | Entity particulars, this site's privacy notice, third-party notices |
| `site/404.html` | Not found |
| `site/assets/css/` | `site.css` (tokens, layout, grid, rails, corners, the theatre) · `decade.css` (readings) · `golf.css` (contact) |
| `site/assets/js/` | `site.js` (header, reveals, nav) · `ascii.js` + `ascii/` (the 3D ASCII engine and its figures, incl. `golf-scene.js`) · `decade.js` (readings) · `golf.js` (the contact scroll) · `donut.js` (the CapWatch capital donut) |
| `site/assets/fonts/` | Instrument Sans, DM Mono (self-hosted, SIL OFL — licences alongside) |
| `site/assets/stores/` | Official App Store, Google Play and Microsoft Store badges, unaltered |
| `site/assets/brand/` | Favicons, touch icons and the CapWatch mark (the RR lockup is inlined in the pages) |
| `site/assets/og/og.png` | The link-preview card |
| `brand/README.md` | Start here for anything brand |
| `parked/second-half/` | The chessboard timeline, parked (not deployed); README inside says how to restore it |
