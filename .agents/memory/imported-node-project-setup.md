---
name: Imported Node project setup
description: Runtime and package-lock checks when restoring dependencies in imported Node projects.
---

For imported Node apps, check the project's declared Node engine before restoring packages. Match the package manager to the repository lockfile: `npm ci` requires a root `package-lock.json`, while a Bun-only project should install and run with Bun. Replit package setup can change the available runtime commands, so verify the workflow command after installing modules. The Replit package installer can also rewrite lockfile tarball hosts to `package-firewall.replit.internal`.

**Why:** External CI cannot resolve Replit's internal package host, and host-only replacement can preserve the internal `/npm/` path and produce invalid public URLs. The declared project engine also does not automatically change the active Replit runtime.

**How to apply:** Before installing, inspect the lockfile and current runtime. Use the Node version required by the project, then verify that `package.json`, the selected lockfile, and the workflow command remain aligned. If Vite dev startup hits `EMFILE` scanning Bun's workspace cache, exclude `.cache` from the dev server watcher. For Render builds, replace the full internal tarball URL prefix—including `/npm/`—with the public registry URL before install, and verify the deployed service actually runs that step. Do not rely on `replace-registry-host=always` to remove path prefixes, and do not keep unrequested manifest range changes.