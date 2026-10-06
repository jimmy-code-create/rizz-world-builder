# Project Rules

- Use `render-server.mjs` as the standalone Node production launcher for Render, keeping it outside Nitro's server-entry discovery so `vite build` remains compatible with the deployment target.
- Treat a valid group invite as sufficient authorization to join; retain block checks to prevent blocked connections.