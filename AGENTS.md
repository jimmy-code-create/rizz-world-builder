# Project Rules

- Use `render-server.mjs` as the standalone Node production launcher for Render, keeping it outside Nitro's server-entry discovery so `vite build` remains compatible with the deployment target.