# ProcrastinAI — Vercel-Ready

A minimal Vite + React app that deploys to Vercel without extra config.

## Local Dev
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```
Build output: `dist/`

## Deploy to Vercel
- Import this folder in Vercel
- Framework Preset: **Vite**
- Build Command: `npm run build`
- Output Directory: `dist`
- The bundled `vercel.json` rewrites all routes to `index.html` for SPA support.

Generated: 2025-10-28T00:46:43.626804Z
