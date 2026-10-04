---
name: Imported Node project setup
description: Runtime and package-lock checks when restoring dependencies in imported Node projects.
---

For imported Node apps, check the project's declared Node engine before restoring packages. The Replit package installer can resolve current compatible versions and rewrite dependency ranges and lockfile tarball hosts to `package-firewall.replit.internal`.

**Why:** Broad dependency and registry-host rewrites can make external CI builds fail because they cannot reach Replit's internal package host; the declared project engine also did not automatically change the active Replit runtime.

**How to apply:** Before installing, inspect the lockfile and current runtime. Use the Node version required by the project, then verify that `package.json`, `package-lock.json`, and `.replit` remain aligned. For Render builds, set npm to use the public registry and replace lockfile registry hosts. Do not keep unrequested manifest range changes.