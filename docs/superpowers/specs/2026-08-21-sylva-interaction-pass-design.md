# Feel the Fire — Sylva-inspired Interaction Pass

## Status

Approved on 2026-08-21. Implement P0, commit a rollback checkpoint, then implement a restrained P1 without pushing.

## Goal

Add a quiet interaction language to the existing Astro blog: cold blue describes latent system structure and Ember marks rare activation. Content, typography, semantic HTML, Light/Dark themes, and the current information architecture remain primary.

## Reference boundary

Sylva is a concept reference only. Its JavaScript, CSS, shaders, procedural geometry, particle implementation, assets, and artwork must not be copied or translated. This pass is a clean-room implementation using Astro, TypeScript, Canvas 2D, CSS custom properties, and browser APIs already available to the project.

## P0 architecture

- `HomeHero.astro` owns the existing Hero hierarchy and non-informational visual layers.
- One `MotionEngine` owns normalized raw/smoothed pointer state, frame delta, subscriber scheduling, idle stop, visibility pause, reduced-motion state, and fine/coarse input state.
- Hero parallax, Header proximity, and specular edges subscribe to the same engine. No feature creates an independent JavaScript RAF loop.
- Entrance choreography uses finite CSS animation and removes its temporary ready state after completion. Content remains readable without JavaScript.
- Effects consume CSS tokens. TypeScript reads cached geometry or sets normalized scalar CSS variables; it does not contain palette hex values.

## P0 behavior

- Hero text moves at most 0.75px; ambient geometry moves at most 6px and rotates no more than 0.2 degrees.
- Header links translate upward at most 1.25px and reveal a cold-blue proximity line without changing layout metrics.
- `[data-specular]` exposes a reusable masked border highlight. It is initially applied only to actual compact controls.
- The Hero identity dot may pulse once on the first intentional Hero pointer entry. P0 has no free particles.
- Reduced motion, coarse pointer, hidden documents, or absent JavaScript leave a complete static page.

## P1 architecture and behavior

- `HeroField.astro` supplies a decorative, pointer-transparent Canvas 2D layer.
- A seeded path generator creates stable branching Bézier compositions for viewport buckets.
- Desktop paths respond locally to the smoothed pointer; coarse pointer and reduced-motion modes render a static composition.
- Canvas DPR is capped at 1.5, path count is 20–26 desktop and 10–14 narrow-screen, and the field stops redrawing when pointer state converges or the Hero leaves the viewport.
- Theme colors are read on initialization and on the project’s custom `torchbearer:themechange` event, never per frame.
- Ember particles are limited to 3–5 short-lived DOM particles on explicitly marked semantic controls. There is no cursor trail or continuous emitter.

## Accessibility and fallback

- Preserve skip link, logical headings, `aria-current`, focus-visible rings, mobile navigation Escape handling, and text selection.
- Canvas is `aria-hidden`, has `pointer-events: none`, and carries no information unavailable in text.
- Keyboard focus receives stable emphasis without pointer calculations.
- CSS mask failure removes the specular enhancement while retaining normal borders.
- `prefers-reduced-motion: reduce` disables entrance translation, parallax, proximity motion, path displacement/idle drift, and Ember particles.

## Verification

- Node tests cover damping, normalization, smoothstep, engine idle/visibility behavior, and seeded path determinism.
- Browser QA covers 1440×900, 1024×768, 768×1024, and 390×844 in Light/Dark, plus reduced motion, coarse pointer, keyboard, mobile navigation, and no horizontal overflow.
- Build must pass with zero new runtime dependencies and no deployment-file changes.
