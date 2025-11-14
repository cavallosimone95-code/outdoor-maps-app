## Quick orientation for AI code agents

This repository is a small React + TypeScript app (Create React App / `react-scripts`) that shows outdoor maps and points of interest (POIs). The file structure and a few integration points are the most important things to know so you can be productive immediately.

Key facts
- Entry: `src/app.ts` — mounts React and composes `Sidebar` + `MapView`.
- Components: `src/components/*` (MapView, Sidebar, POIList). Keep components functional and typed.
- Services: `src/services/mapService.ts` — HTTP helpers using `axios`. The base URL is a placeholder (`https://api.example.com`) and must be replaced or wired to an env variable before integration tests or E2E runs.
- Hooks & types: `src/hooks/useLocation.ts` (geolocation), `src/types/index.ts` (canonical interfaces). Update both when changing shapes.

Run / build / debug
- Install: `npm install` (uses package.json in project root).
- Dev: `npm start` (starts CRA dev server, view at `http://localhost:3000`).
- Build: `npm run build` (CRA production build).
- Tests: `npm test` (CRA test runner).

Important implementation patterns discovered in the codebase
- Map loading: `src/components/MapView.tsx` assumes a global `window.google.maps` map object and initializes a map with a center/zoom. However, there is no Google Maps script tag in `public/index.html` — when adding the Maps API, inject the script (or use a loader) and ensure an API key is provided.
- API service pattern: `mapService.ts` exports `fetchMapData` and `fetchPOIs` using `axios.get`. These return raw API responses (no extra caching or normalization). Call sites expect plain data; handle errors consistently (the service currently throws errors after logging).
- Hook return shapes vs usage: `src/hooks/useLocation.ts` returns `{ location, error }` (location object), but `MapView.tsx` destructures `{ latitude, longitude } = useLocation()` — this is a mismatch. If you change either, update both files and tests.
- POI shape mismatch: `src/types/index.ts` defines `POI` with `id: string` and `location: { lat, lng }`, while `src/components/POIList.tsx` expects `pois` with `id: number` and `coordinates: { latitude, longitude }`. Watch for these divergent shapes when wiring data or updating types.

Where to look for common tasks / edits (examples)
- Add Google Maps API: update `public/index.html` to include the `<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_KEY"></script>` or add a dynamic loader in `MapView.tsx` before accessing `window.google`.
- Replace API URL: edit `src/services/mapService.ts` and consider moving the base URL to an env var (e.g., `process.env.REACT_APP_API_BASE`) for local vs production.
- Fix hook/component mismatch: examine `src/hooks/useLocation.ts` and `src/components/MapView.tsx` — the hook returns `{ location }` but the component expects flat `latitude/longitude` values.
- Align types: prefer `src/types/index.ts` as the canonical source and adjust `POIList.tsx` and any mock/test fixtures to match it.

Conventions / notes
- Types live in `src/types/index.ts` and are intended to be the single source of truth for data shapes.
- Services are thin wrappers around HTTP requests (axios). They log then rethrow on error.
- Components are small and focused; add unit tests alongside changes (CRA + react-scripts test). There are no current test files in the repo — add jest/react-testing-library tests under `src/__tests__`.
- The project lists `leaflet` in package.json, but the app currently initializes a Google map; double-check whether to use Leaflet or Google Maps and align dependencies.

Gotchas to call out during edits
- Inconsistent POI types (see above) — leads to runtime undefined fields.
- Missing Google Maps loader in `public/index.html` while code expects `window.google`.
- `mapService.ts` hard-coded placeholder API URL.

If you need to make a change
- Run `npm start` locally, reproduce the issue in the browser, then open the smallest PR that fixes a single mismatch (types, hook return shape, or API base URL). Include a brief description in the PR linking the changed files.

Files to inspect first when asked about behavior
- `src/components/MapView.tsx` — map init and integration with `fetchMapData`.
- `src/hooks/useLocation.ts` — geolocation hook and return shape.
- `src/services/mapService.ts` — external API calls and base URL.
- `public/index.html` — where to add script tags for external SDKs (Google Maps).

If anything here is incorrect or you want a different level of detail (examples, more file-level guidance, or tests added), tell me which area to expand and I will iterate.
