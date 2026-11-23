# Chess

A simple chess game against a computer opponent. Plain HTML and JavaScript: no build step, no dependencies, works offline.

## Play

- **On a computer:** open `public/index.html` in a browser.
- **On a phone:** open the deployed site in Safari, then tap Share → Add to Home Screen. After the first visit it works offline.

## Files

| File | What it does |
| --- | --- |
| `public/chess.js` | The rules: board, legal moves, check, checkmate. No UI. |
| `public/bot.js` | The computer player (minimax search with alpha-beta pruning). |
| `public/index.html` | Draws the board and handles clicks. |
| `public/sw.js` | Saves the files on the device so the game works offline. |
| `public/manifest.json`, `*.png` | Home-screen name and icons. |
| `render.yaml` | Deployment settings for Render. |

## Deploy on Render

1. Push this repository to GitHub.
2. In Render, choose **New → Blueprint** and pick this repository. It reads `render.yaml` and creates a free static site.
3. Every push to the main branch redeploys automatically.

## Updating the game

When you change any file in `public/`, also change `CACHE` in `public/sw.js` (`chess-v1` → `chess-v2`, and so on). Otherwise phones keep using their saved copy.

## Simplifications

- Pawns always promote to a queen.
- Draws are only detected by stalemate or when only the two kings are left (no threefold repetition or 50-move rule).
