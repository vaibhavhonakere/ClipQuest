# Frontend

React + Vite UI for ClipQuest.

## What it shows
- Asset upload + drag and drop
- Library of uploaded assets
- Live pipeline graph with stage states
- Event feed and stage latency badges
- Semantic search results with score/confidence hints
- `Jump` button to seek the video player to the matched timestamp

## Dev
```bash
cd frontend
npm install
npm run dev
```

## Build
```bash
cd frontend
npm run build
npm run preview
```

## Environment
- `VITE_API_BASE_URL` (default `http://127.0.0.1:8000`)

Example:
```bash
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

## Key source areas
- `src/state/useAssets.js` - app state + polling + API integration
- `src/components/detail/` - graph, events, search, moments
- `src/components/assets/` - library cards/list
- `src/styles.css` - visual system and layout
