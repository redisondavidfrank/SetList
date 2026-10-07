# 🎸 SetList

A mobile-friendly guitar song app for iPhone and Mac. Browse songs, view chord charts (lyrics with chords above the lines, Ultimate Guitar style), transpose, auto-scroll, save songs offline, and build set lists.

**Live:** https://redisondavidfrank.github.io/SetList/

## Features

- 🔍 **Search songs** — search millions of songs (iTunes Search API)
- 🎵 **Chord charts** — bundled charts for popular songs, lyrics with chords over the lines
- 🔁 **Transpose** — `−` / `+` buttons shift the key by semitones, live key badge
- ▶️ **Auto-scroll** — hands-free scrolling while you play; while scrolling, `−`/`+` control speed
- 🤏 **Pinch to zoom** — scale chord/lyric text; double-tap to reset
- 🎸 **Chord library** — diagrams for 12 roots × 13 qualities
- 🎼 **Scale library** — 12 scales on a scrollable fretboard
- ⬇️ **Offline save** — keep songs available without a connection
- 📚 **Set lists** — create sets, add songs, reorder with ↑/↓
- 🌙 **Light / dark mode** — follows system, toggle in the sidebar
- ☰ **Sidebar menu** — available on every screen, including mid-song
- 📱 **Installable PWA** — add to Home Screen on iPhone or Mac

## Data sources

| Source | Used for |
|---|---|
| [iTunes Search API](https://performance-partners.apple.com/search-api) | Song search & metadata (free, no key, CORS) |
| [LRCLIB](https://lrclib.net) | Lyrics (free, no key, CORS) |
| Bundled charts (`src/lib/charts.ts`) | Chord charts for popular songs |

Ultimate Guitar data is **not** scraped — charts are curated in this repo. Add more songs by appending entries in `src/lib/charts.ts`.

## Develop

```bash
npm install
npm run dev      # http://localhost:4321/SetList
npm test         # transpose/voicing/chart unit tests
npm run build    # static output in dist/
```

## Deploy

Push to `main` — GitHub Actions builds and publishes to GitHub Pages automatically.
