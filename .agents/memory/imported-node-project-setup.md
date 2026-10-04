---
name: Imported Node project setup
description: Runtime and package-lock checks when restoring dependencies in imported Node projects.
---

For imported Node apps, check the project's declared Node engine before restoring packages. The Replit package installer can resolve current compatible versions and rewrite dependency ranges and the lockfile when it is given the full manifest.

**Why:** This produced broad dependency metadata churn and engine warnings during setup; the declared project engine did not automatically change the active Replit runtime.

**How to apply:** Before installing, inspect the lockfile and current runtime. Use the Node version required by the project, then verify that `package.json`, `package-lock.json`, and `.replit` remain aligned. Do not keep unrequested manifest range changes.