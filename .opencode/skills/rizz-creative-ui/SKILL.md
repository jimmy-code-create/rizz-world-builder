---
name: rizz-creative-ui
description: Design and implement distinctive, accessible creative product interfaces that fit the RIZZ brand and existing React UI system.
compatibility: opencode
---

# RIZZ Creative UI

Use this skill for new screens, visual refreshes, interactive prototypes, components, and motion polish in RIZZ.

## Brand and design language

- Read `src/styles.css` before styling. The current RIZZ system is a restrained dark editorial canvas: near-black ink, warm paper text, and acid-lime signal accent (`--brand-signal`). The token block is the visual source of truth.
- Use semantic Tailwind/CSS tokens such as `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `border-border`, and `bg-primary`. Avoid hard-coded colors when a token exists.
- The current brand direction is intentionally flat: no gratuitous gradients, neon glows, blurred blobs, glassmorphism, or shadow-heavy cards. Older component names and comments may refer to previous pink/violet styling; follow the live token definitions and current nearby UI.
- Use the existing type system (`--font-display`, `--font-sans`) and spacing/radius tokens. Make hierarchy clear with editorial typography, tight purposeful layouts, and crisp borders.
- Use `lucide-react` for icons, existing Radix/shadcn-style primitives in `src/components/ui/` for interaction, and Framer Motion only when motion adds meaning.

## Creative product craft

- Make a screen feel authored for its task, not like a generic dashboard template. Choose one clear visual idea and carry it through the hierarchy, empty states, and feedback.
- Keep creative expression in content, composition, illustration, and interaction—not in weakening readability or accessibility.
- Design mobile-first, test narrow widths, respect safe areas and scrolling behavior, and avoid controls that depend only on hover.
- Provide clear interactive states: idle, hover, focus-visible, pressed, disabled, loading, empty, success, and failure where relevant.
- Use semantic HTML, accessible names, keyboard-operable controls, sufficient contrast, and `aria-live` only for changes that genuinely need announcement.
- Respect `prefers-reduced-motion`; avoid animation that delays actions or makes text difficult to read.
- Reuse existing dialogs, sheets, buttons, toasts, and layout primitives rather than introducing a second design system.

## Workflow

1. Inspect neighboring routes/components and identify existing primitives and tokens.
2. State the visual direction briefly in implementation notes, then build the smallest coherent experience.
3. Check desktop and mobile layout, keyboard/focus states, contrast, and reduced motion.
4. Run formatting, targeted lint/type checks, and the production build as appropriate. Do not claim visual/browser testing unless performed.
