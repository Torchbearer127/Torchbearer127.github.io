# Sylva-inspired Interaction Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared, accessible interaction runtime and a restrained cold-blue/Ember Hero field without changing the blog’s content hierarchy or deployment path.

**Architecture:** A single browser motion engine publishes normalized, frame-rate-independent pointer frames to small feature initializers. P0 establishes the runtime, Hero extraction, entrance/parallax, Header proximity, and reusable specular edge; P1 adds a deterministic Canvas 2D path field and rare Ember activation on top of that stable checkpoint.

**Tech Stack:** Astro 7, TypeScript, native CSS, Canvas 2D, browser APIs, Node’s built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-21-sylva-interaction-pass-design.md`

## Global Constraints

- Clean-room reference only: copy no Sylva JavaScript, CSS, GLSL, procedural geometry, particles, or assets.
- Add zero runtime dependencies; do not add React, Three.js, GSAP, or animation libraries.
- Preserve current content, Light/Dark palette roles, semantic HTML, keyboard behavior, and GitHub Pages workflow.
- One JavaScript RAF scheduler only; finite CSS entrance/particle animations are allowed.
- Stop ongoing JavaScript work on idle, hidden documents, reduced motion, coarse input, or offscreen Hero where applicable.
- P0 must be committed before P1 starts; do not push.

---

### Task 1: P0 motion mathematics and runtime

**Files:**
- Create: `src/scripts/motion/math.ts`
- Create: `src/scripts/motion/motion-engine.ts`
- Create: `tests/motion/math.test.mjs`
- Create: `tests/motion/engine.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `clamp`, `damp`, `normalizePointer`, and `smoothstep` from `math.ts`.
- Produces: `MotionEngine`, `MotionFrame`, `MotionSubscriber`, and singleton `motionEngine` from `motion-engine.ts`.
- `MotionSubscriber(frame)` returns `true` only while it needs another frame.

- [ ] Write Node tests with hand-derived values for pointer normalization, time-based damping, smoothstep endpoints, idle RAF stop, hidden pause, and a 50ms delta cap.
- [ ] Run `npm test`; verify failures are caused by missing modules.
- [ ] Implement the pure math helpers and dependency-injectable engine. Pointer and media events only update state and request the shared frame.
- [ ] Run `npm test`; verify all runtime tests pass.

### Task 2: P0 Hero extraction and interaction

**Files:**
- Create: `src/components/home/HomeHero.astro`
- Create: `src/scripts/motion/hero-motion.ts`
- Modify: `src/pages/index.astro`
- Create: `src/styles/effects.css`

**Interfaces:**
- `HomeHero.astro` emits `[data-home-hero]`, `[data-hero-layer]`, `[data-intro]`, and `[data-hero-ember]` hooks while preserving kicker → focus → H1 → alias → statement order.
- `initHeroMotion(engine)` registers one subscriber and returns cleanup.

- [ ] Add a browser contract that checks source content is visible without motion state, shared hooks exist, and reduced motion leaves transforms at identity.
- [ ] Run the contract and confirm it fails because the extracted component/hooks are absent.
- [ ] Extract the Hero without copy changes; add finite staged entrance, ≤0.75px text parallax, ≤6px ambient parallax, and one identity pulse.
- [ ] Run the contract and capture Light/Dark desktop/mobile P0 screenshots.

### Task 3: P0 Header proximity and specular edge

**Files:**
- Create: `src/scripts/motion/header-proximity.ts`
- Create: `src/scripts/motion/specular.ts`
- Create: `src/scripts/motion/bootstrap.ts`
- Modify: `src/components/Header.astro`
- Modify: `src/components/ThemeToggle.astro`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/styles/effects.css`

**Interfaces:**
- `initHeaderProximity(engine)` caches link centers and writes only `--proximity`.
- `initSpecular(engine)` caches `[data-specular]` rects and writes only `--spec-angle`/`--spec-strength`.
- `bootstrap.ts` is the sole application initializer and never creates another RAF.

- [ ] Add browser assertions for no Header geometry change, active-page marker preservation, focus-visible parity, coarse-pointer disablement, and specular strength fading with distance.
- [ ] Run assertions and confirm they fail before hooks/behavior exist.
- [ ] Implement transform-only Header proximity and a masked specular pseudo-border on compact controls.
- [ ] Verify keyboard, mobile navigation, reduced motion, and no forced geometry reads in pointer handlers.

### Task 4: P0 checkpoint

**Files:**
- Stage only P0 implementation, tests, spec, and plan files.

- [ ] Run `npm test`, `npm run build`, browser P0 contracts, and `git diff --check`.
- [ ] Confirm dependency lockfiles and `.github/workflows/deploy.yml` are unchanged.
- [ ] Commit with message `Build shared interaction foundation`.

### Task 5: P1 deterministic path field

**Files:**
- Create: `src/components/effects/HeroField.astro`
- Create: `src/scripts/motion/hero-field.ts`
- Create: `tests/motion/hero-field.test.mjs`
- Modify: `src/components/home/HomeHero.astro`
- Modify: `src/scripts/motion/bootstrap.ts`
- Modify: `src/styles/effects.css`

**Interfaces:**
- `createPathComposition(width, height, seed)` returns serializable paths and junctions with stable output for the same viewport bucket.
- `initHeroField(engine)` owns Canvas sizing/rendering but schedules through the shared engine.

- [ ] Write tests proving deterministic output, viewport-bucket path limits, and bounded displacement influence.
- [ ] Run tests and verify missing P1 implementation causes failure.
- [ ] Implement seeded branching paths, capped DPR 1.5, cached theme colors, ResizeObserver, IntersectionObserver, and pointer disturbance.
- [ ] Verify static reduced/coarse modes and idle/offscreen redraw stop.

### Task 6: P1 Ember micro activation

**Files:**
- Create: `src/scripts/motion/ember.ts`
- Modify: `src/scripts/motion/bootstrap.ts`
- Modify: `src/components/ThemeToggle.astro`
- Modify: `src/styles/effects.css`

**Interfaces:**
- `initEmber()` binds only `[data-ember-burst]` and returns cleanup.
- Each activation creates 3–5 presentation-only spans, removes them on `animationend`, and emits nothing under reduced motion.

- [ ] Add a browser contract for particle count, cleanup, no pointermove emission, and reduced-motion suppression.
- [ ] Run it and verify failure before implementation.
- [ ] Implement the emitter with deterministic bounds and CSS custom-property trajectories.
- [ ] Verify repeated pointer movement produces no Ember trail.

### Task 7: P1 final QA without commit

**Files:**
- Do not modify deployment or dependency files.

- [ ] Run `npm test`, `npm run build`, and `git diff --check`.
- [ ] Capture Light/Dark 1440×900 and 390×844 screenshots plus reduced-motion states.
- [ ] Verify 1024×768 and 768×1024 have no overflow or navigation collision.
- [ ] Report P0 commit SHA, P1 uncommitted file list, runtime/Canvas budgets, accessibility results, and rollback point.
