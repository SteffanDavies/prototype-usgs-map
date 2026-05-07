# USGS Seismic Map Prototype

Small `Vite + MapLibre` MVP that displays near-real-time earthquake data from the USGS GeoJSON feeds and deploys to GitHub Pages.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## GitHub Pages

The app is configured for this repository path with:

- `vite.config.js` -> `base: "/prototype-usgs-map/"`
- `.github/workflows/deploy.yml` -> builds `dist/` and deploys with GitHub Actions

After pushing to `main`, enable GitHub Pages in the repository settings and choose `GitHub Actions` as the source.

## Data feeds

The UI supports these USGS feeds:

- all earthquakes, past hour
- all earthquakes, past day
- significant earthquakes, past week
