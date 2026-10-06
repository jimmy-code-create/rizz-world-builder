---
name: Imported Node project setup
description: Runtime and package-lock checks when restoring dependencies in imported Node projects.
---

For imported Node apps, check the project's declared Node engine before restoring packages. The Replit package installer can resolve current compatible versions and rewrite dependency ranges and lockfile tarball hosts to `package-firewall.replit.internal`. External CI may still request those saved tarball URLs even when its npm registry is set to the public registry.

**Why:** External CI cannot resolve Replit's internal package host, and host-only replacement can preserve the internal `/npm/` path and produce invalid public URLs. The declared project engine also does not automatically change the active Replit runtime.

**How to apply:** Before installing, inspect the lockfile and current runtime. Use the Node version required by the project, then verify that `package.json`, `package-lock.json`, and `.replit` remain aligned. For Render builds, replace the full internal tarball URL prefix—including `/npm/`—with the public registry URL before install, and verify the deployed service actually runs that step. Do not rely on `replace-registry-host=always` to remove path prefixes, and do not keep unrequested manifest range changes.