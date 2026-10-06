# Parked: "The second half" (chessboard timeline)

Concept A from 2026-10-06, built, then parked by the owner the same evening ("cut it out, preserving the code"). Not deployed: `parked/` sits outside `site/`.

To restore:
1. Paste `section.html` over the `<!-- slot:timeline … -->` comment in `site/index.html`.
2. Copy `chess.css` → `site/assets/css/`, `chess.js` → `site/assets/js/`, `chess-scene.js` → `site/assets/js/ascii/`.
3. Link them in `<head>`: `<link rel="stylesheet" href="assets/css/chess.css">` and `<script type="module" src="assets/js/chess.js"></script>`.
4. In `site/assets/js/ascii/scenes.js` add `import { CHESS } from "./chess-scene.js";` and `SCENES.chess = CHESS;`.
