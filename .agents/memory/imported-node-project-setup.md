---
name: Imported Node project setup
description: Runtime and package-lock checks when restoring dependencies in imported Node projects.
---

For imported Node apps, check the project's declared Node engine before restoring packages. The Replit package installer can resolve current compatible versions and rewrite dependency ranges and lockfile tarball hosts to `package-firewall.replit.internal`. External CI may still request those saved tarball URLs even when its npm registry is set to the public registry.

**Why:** External CI cannot resolve Replit's internal package host; registry configuration alone does not necessarily override absolute `resolved` URLs in the lockfile. The declared project engine also does not automatically change the active Replit runtime.

**How to apply:** Before installing, inspect the lockfile and current runtime. Use the Node version required by the project, then verify that `package.json`, `package-lock.json`, and `.replit` remain aligned. For Render builds, normalize internal tarball URLs before `npm ci`; also use a project `.npmrc` with the public registry and `replace-registry-host=always` when the service may run npm directly. Do not keep unrequested manifest range changes.