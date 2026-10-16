---
name: rizz-app-builder
description: Build and extend the RIZZ World Builder app while following its architecture, project rules, and frontend-only constraints.
compatibility: opencode
---

# RIZZ App Builder

Use this skill when implementing or changing a feature in the RIZZ World Builder repository.

## Orient before changing code

1. Read the root `AGENTS.md` and any applicable `.agents/memory/*.md` files. Treat their user-stated constraints as active; ask before expanding scope when a constraint is unclear.
2. Inspect the route, components, hooks, data types, and existing implementation involved in the request. Reuse the current product flow instead of creating a parallel one.
3. Keep this app's runtime architecture in mind:
   - React 19, TypeScript, Vite, and TanStack Start/Router.
   - Route modules live in `src/routes/`; authenticated app routes are under `src/routes/_app/`.
   - Feature UI lives in `src/components/`; reusable primitives live in `src/components/ui/`.
   - Shared hooks live in `src/hooks/`; reusable domain logic and Supabase calls live in `src/lib/`.
   - Supabase client setup lives in `src/integrations/supabase/`; browser data access is subject to the existing RLS policies.
   - Global design tokens and styles live in `src/styles.css`; static public assets live in `public/`.
4. Check `.agents/memory/rizz-scope.md` before backend, model, AI, credential, or deployment work. The current project guidance limits ordinary feature work to `src/`, `public/`, and frontend configuration; do not alter schema, migrations, secrets, or backend services without explicit authorization.

## Implementation principles

- Preserve existing routes, data contracts, permissions, loading/error states, and responsive behavior unless the user asks to change them.
- Prefer small, focused changes that reuse existing components and utilities. Avoid adding dependencies for functionality already available in the stack.
- Use TypeScript types at feature boundaries. Validate external/imported data with existing schemas or validation patterns.
- Keep credentials out of source, client-visible environment variables, logs, and browser storage. Never ask the user to paste secrets into chat.
- Do not assume a cloud API, model, provider, free tier, or deployment capability is available; verify in the codebase and explain limitations.
- Make UI controls keyboard accessible and provide visible focus, descriptive labels, empty/loading/error states, and reduced-motion support for nonessential animation.
- Avoid unrelated refactors and do not modify generated artifacts or lockfiles unless dependency changes require them.

## Verify changes

Use the narrowest relevant checks, then run the production build when feasible. Typical commands:

```bash
pnpm exec prettier --check <changed-files>
pnpm exec eslint <changed-files>
pnpm exec tsc --noEmit
pnpm build
```

The repository has no general test script configured; do not claim tests ran unless you actually ran them. Report checks that were skipped or failed, and summarize changed files and any setup requirements.
