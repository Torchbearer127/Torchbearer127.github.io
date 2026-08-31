# Multilingual Writing System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a three-locale static UI and entity-based Writing system, then migrate `sovereign-driver` into a reusable Astro Essay reading experience without changing its public URL or article words.

**Architecture:** Language-neutral routes statically render localized UI hooks and all available article variants. A first-paint locale bootstrap resolves `?lang`, persisted preference, and browser language; a centralized Writing assembler groups directory-backed content files into one entity per route and applies requested → English → original fallback.

**Tech Stack:** Astro 7, TypeScript, Astro Content Collections, official `@astrojs/mdx`, native CSS/DOM APIs, Node test runner, Chrome DevTools Protocol browser tests.

**Spec:** `docs/superpowers/specs/2026-08-31-multilingual-writing-system-design.md`

## Global Constraints

- Supported UI locales are exactly `zh-CN`, `en`, and `de`.
- Public routes remain language-neutral; do not add locale path prefixes.
- Content fallback is requested locale → English → original locale.
- UI locale and content locale remain independent.
- Missing translations never hide an article.
- Preserve `/writing/essays/sovereign-driver/` and the complete original Chinese article.
- Do not modify `.github/workflows/deploy.yml` or GitHub Pages configuration.
- Do not add React, Vue, Svelte, Tailwind, i18next, a client router, CMS, or translation SDK.
- The only allowed dependency addition is official `@astrojs/mdx`.
- Do not invent translations, biography, projects, images, or social links.

---

## File Structure

### Locale subsystem

- `src/i18n/locales.ts`: locale constants, normalization, and resolution.
- `src/i18n/messages.ts`: typed UI dictionary and message lookup.
- `src/i18n/content.ts`: `LocalizedString` and localized structured-value fallback.
- `src/i18n/bootstrap.ts`: serializable first-paint locale bootstrap source.
- `src/i18n/client.ts`: live language-control behavior and locale change events.
- `src/components/LanguageSwitcher.astro`: accessible native select.

### Writing subsystem

- `src/content.config.ts`: original/translation variant schemas and MDX glob.
- `src/lib/writing-types.ts`: entity and variant public interfaces.
- `src/lib/writing.ts`: entity assembly, validation, fallback, queries, routes.
- `src/components/writing/LocalizedText.astro`: localized UI hook for static pages.
- `src/components/writing/WritingList.astro`: entity-aware cards.
- `src/components/writing/WritingCollection.astro`: localized archive shell.

### Essay subsystem

- `src/layouts/EssayLayout.astro`: shared Essay document shell.
- `src/layouts/ResearchNoteLayout.astro`: technical article shell boundary.
- `src/components/essay/EssayVariant.astro`: one localized article variant.
- `src/components/essay/EssayToc.astro`: per-variant heading navigation.
- `src/components/essay/ReadingProgress.astro`: shared progress indicator.
- `src/components/essay/KeyLine.astro`: emphasized paragraph primitive.
- `src/components/essay/Epigraph.astro`: quotation primitive.
- `src/components/essay/Attribution.astro`: attribution primitive.
- `src/scripts/essay-reader.ts`: variant switching, metadata, TOC, scroll-spy, progress.
- `src/styles/essay.css`: sovereign-driver-derived shared visual system.

### Content and tests

- `src/content/writing/essays/sovereign-driver/index.mdx`: migrated Chinese original.
- `tests/i18n/locale.test.mjs`: locale behavior.
- `tests/writing/entities.test.mjs`: entity assembly and fallback.
- `tests/writing/sovereign-driver.test.mjs`: content-loss and route guards.
- `tests/browser/multilingual-essay.mjs`: browser interaction and visual contracts.

---

### Task 1: Locale Core

**Files:**
- Create: `src/i18n/locales.ts`
- Create: `src/i18n/messages.ts`
- Create: `src/i18n/content.ts`
- Test: `tests/i18n/locale.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `SUPPORTED_LOCALES`, `DEFAULT_LOCALE`, `normalizeBrowserLocale(value)`, `resolveUiLocale(input)`, `resolveContentLocale(requested, available, original)`, `message(locale, key)`, and `localize(value, requested)`.

- [ ] **Step 1: Write failing locale tests**

Cover valid query precedence, invalid query rejection, storage precedence, Simplified Chinese normalization, Traditional Chinese rejection to English, German variant normalization, unsupported-language English fallback, and duplicate-free content fallback.

```js
assert.equal(resolveUiLocale({ query: 'de', stored: 'zh-CN', browser: ['en-US'] }), 'de');
assert.equal(normalizeBrowserLocale('zh-TW'), 'en');
assert.equal(normalizeBrowserLocale('de-AT'), 'de');
assert.equal(resolveContentLocale('de', ['zh-CN', 'en'], 'zh-CN'), 'en');
assert.equal(resolveContentLocale('de', ['zh-CN'], 'zh-CN'), 'zh-CN');
```

- [ ] **Step 2: Run `node --test tests/i18n/locale.test.mjs` and confirm missing-module failure**
- [ ] **Step 3: Implement pure locale and dictionary modules with no DOM dependency**
- [ ] **Step 4: Add `tests/i18n/*.test.mjs` to `npm test` and confirm the group passes**
- [ ] **Step 5: Commit locale core**

### Task 2: First-Paint UI Localization

**Files:**
- Create: `src/i18n/bootstrap.ts`
- Create: `src/i18n/client.ts`
- Create: `src/components/LanguageSwitcher.astro`
- Create: `src/components/LocalizedText.astro`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/components/Header.astro`
- Modify: `src/components/Footer.astro`
- Modify: `src/styles/global.css`
- Test: `tests/ia/site-ia.test.mjs`

**Interfaces:**
- Consumes: locale constants and message dictionary from Task 1.
- Produces: `data-i18n` text hooks, `data-locale-switcher`, the `torchbearer:localechange` event, and root `data-ui-locale`.

- [ ] **Step 1: Add failing source-contract tests**

Assert English server defaults, the three select options, `torchbearer-locale`, query/storage/browser precedence hooks, canonical URL without `lang`, `html.lang` updates, and no locale path prefixes.

- [ ] **Step 2: Run the IA test and confirm the new assertions fail**
- [ ] **Step 3: Implement the inline bootstrap alongside the existing theme bootstrap**

The bootstrap must synchronously set `data-ui-locale`, `lang`, translated `[data-i18n]` text, selected option, and a canonical clean URL before ordinary client scripts run. Storage access is wrapped in `try/catch`.

- [ ] **Step 4: Add the select-based switcher and client change behavior**

On change, update or remove `?lang`, persist a valid locale, apply messages, emit `torchbearer:localechange`, and use `history.replaceState` without changing the path.

- [ ] **Step 5: Localize Header, Footer, skip link, accessible labels, and base metadata**
- [ ] **Step 6: Run IA and locale tests**
- [ ] **Step 7: Commit UI localization**

### Task 3: Entity-Based Writing Content

**Files:**
- Modify: `astro.config.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/content.config.ts`
- Create: `src/lib/writing-types.ts`
- Rewrite: `src/lib/writing.ts`
- Test: `tests/writing/entities.test.mjs`
- Add fixtures under: `tests/fixtures/writing/`

**Interfaces:**
- Produces:

```ts
export interface WritingVariant {
  locale: SupportedLocale;
  entry: WritingEntry;
  title: string;
  description: string;
}

export interface WritingEntity {
  id: string;
  slug: string;
  type: 'research-note' | 'essay';
  originalLocale: SupportedLocale;
  availableLocales: SupportedLocale[];
  variants: Partial<Record<SupportedLocale, WritingVariant>>;
  data: SharedWritingData;
}
```

- Produces: `assembleWritingEntities(entries)`, `getPublishedWriting()`, `resolveWritingVariant(entity, requested)`, `getWritingHref(entity)`, and `getWritingSlug(entity)`.

- [ ] **Step 1: Add official `@astrojs/mdx` and configure it in Astro**
- [ ] **Step 2: Write failing entity assembly tests**

Cover directory-derived type/slug, required `index`, filename/locale consistency, duplicate locale rejection, translation shared-field rejection, missing original rejection, derived `availableLocales`, fallback, stable sorting, and one entity regardless of variant count.

- [ ] **Step 3: Run the Writing test and confirm the old one-entry model fails**
- [ ] **Step 4: Update the collection loader to `**/*.{md,mdx}` with a discriminated schema**
- [ ] **Step 5: Implement the pure assembler and Astro-backed query wrapper**
- [ ] **Step 6: Convert the existing research-note fixture to directory-backed `index.md`**
- [ ] **Step 7: Run entity tests and `astro sync` through `npm run build`**
- [ ] **Step 8: Commit the Writing entity model**

### Task 4: Localized Archives and Structured Pages

**Files:**
- Modify: `src/components/writing/WritingList.astro`
- Modify: `src/components/writing/WritingCollection.astro`
- Modify: `src/pages/index.astro`
- Modify: `src/pages/writing/index.astro`
- Modify: `src/pages/writing/essays/index.astro`
- Modify: `src/pages/writing/research-notes/index.astro`
- Modify: `src/pages/work.astro`
- Modify: `src/pages/about/index.astro`
- Modify: `src/pages/about/gallery.astro`
- Modify: `src/pages/about/hall-of-fame.astro`
- Create: `src/data/site-content.ts`
- Test: `tests/ia/site-ia.test.mjs`

**Interfaces:**
- Consumes: entity query/fallback and UI dictionary.
- Produces: static `data-localized` variants for page text and localized entity cards that remain visible when a translation is missing.

- [ ] **Step 1: Add failing tests for entity-aware archive links and three-locale UI hooks**
- [ ] **Step 2: Update list and collection components to consume `WritingEntity[]`**
- [ ] **Step 3: Localize existing UI copy and structured Work/About copy without adding facts**
- [ ] **Step 4: Add restrained UI fallback notice support**
- [ ] **Step 5: Run IA, locale, and entity tests**
- [ ] **Step 6: Commit localized archives and pages**

### Task 5: Shared Essay Reader

**Files:**
- Create: `src/layouts/EssayLayout.astro`
- Create: `src/layouts/ResearchNoteLayout.astro`
- Create: `src/components/essay/EssayVariant.astro`
- Create: `src/components/essay/EssayToc.astro`
- Create: `src/components/essay/ReadingProgress.astro`
- Create: `src/components/essay/KeyLine.astro`
- Create: `src/components/essay/Epigraph.astro`
- Create: `src/components/essay/Attribution.astro`
- Create: `src/scripts/essay-reader.ts`
- Create: `src/styles/essay.css`
- Modify: `src/pages/writing/research-notes/[slug].astro`
- Test: `tests/browser/multilingual-essay.mjs`

**Interfaces:**
- Consumes: `WritingEntity`, rendered variant `headings`, locale event, global theme storage.
- Produces: `data-essay-variant`, `data-essay-toc`, `data-content-locale`, article fallback notices, per-locale title/description metadata, progress, and scroll-spy state.

- [ ] **Step 1: Add a failing browser fixture/contract for variant visibility and reader controls**
- [ ] **Step 2: Extract the Essay visual tokens and layout rules from the standalone article into `essay.css`**
- [ ] **Step 3: Implement framework-free content primitives and per-variant rendering**
- [ ] **Step 4: Implement heading-derived desktop/mobile TOCs**
- [ ] **Step 5: Implement content fallback, metadata updates, progress, scroll-spy, locale switching, focus safety, and <=2-H2 TOC suppression**
- [ ] **Step 6: Keep Research Notes on a separate compact layout**
- [ ] **Step 7: Run focused browser and unit tests**
- [ ] **Step 8: Commit the shared Essay reader**

### Task 6: Lossless sovereign-driver Migration

**Files:**
- Create: `src/content/writing/essays/sovereign-driver/index.mdx`
- Test: `tests/writing/sovereign-driver.test.mjs`
- Reference until parity: `src/content/writing/essays/sovereign-driver.html`
- Reference until parity: `src/content/writing/essays/sovereign-driver.md`

**Interfaces:**
- Consumes: `KeyLine`, `Epigraph`, and `Attribution` MDX primitives.
- Produces: an original `zh-CN` Essay variant with five H2 headings and complete source text.

- [ ] **Step 1: Write a failing legacy-to-MDX completeness guard**

Normalize heading and paragraph text by parsing tags/entities, normalize Unicode whitespace, and assert that every legacy article text block occurs in the migrated MDX in source order. Also assert the title, author, date label, description, five H2 headings, key lines, epigraphs, and attributions.

- [ ] **Step 2: Run the guard and confirm the missing MDX failure**
- [ ] **Step 3: Convert only article markup to MDX and preserve every word**

Remove the document shell, standalone CSS, duplicate header/theme/navigation scripts, hard-coded TOC, and progress script. Replace only semantic presentation wrappers with the approved MDX primitives.

- [ ] **Step 4: Run completeness tests and inspect normalized failure diffs until exact parity passes**
- [ ] **Step 5: Build and visually compare the migrated route with the standalone source**
- [ ] **Step 6: Commit the migrated article**

### Task 7: Neutral Entity Routes and Legacy Removal

**Files:**
- Rewrite: `src/pages/writing/essays/[slug].astro`
- Remove: `src/pages/writing/essays/sovereign-driver/index.astro`
- Remove: `src/content/writing/essays/sovereign-driver.html`
- Remove: `src/content/writing/essays/sovereign-driver.md`
- Modify: `tests/ia/site-ia.test.mjs`
- Modify: `tests/writing/sovereign-driver.test.mjs`

**Interfaces:**
- Consumes: assembled entities and rendered Content/headings from each variant.
- Produces: one static route per Essay entity, including the unchanged sovereign-driver URL.

- [ ] **Step 1: Add failing assertions for one route per entity and absence of the special response route**
- [ ] **Step 2: Generate paths from entities and render every available variant through `EssayLayout`**
- [ ] **Step 3: Confirm query variants resolve on the same generated HTML and canonical stays clean**
- [ ] **Step 4: Delete legacy standalone files only after content guard and visual parity pass**
- [ ] **Step 5: Run all unit tests and build; verify the route appears exactly once**
- [ ] **Step 6: Commit route cutover and legacy cleanup**

### Task 8: Browser QA, Screenshots, and Final Audit

**Files:**
- Modify: `tests/browser/multilingual-essay.mjs`
- Modify: `package.json`
- Generate outside repository: `/Users/torchbearer/.codex/visualizations/2026/08/13/019ffb24-4319-7bd0-8ac2-125b5bdd5d63/multilingual-writing/`

**Interfaces:**
- Verifies the complete public behavior; produces no runtime interface.

- [ ] **Step 1: Test `?lang`, storage, browser locale, Traditional Chinese fallback, and persistence in a real browser**
- [ ] **Step 2: Test requested→English→original content fallback and localized notice**
- [ ] **Step 3: Test active article/TOC accessibility, document metadata, progress, scroll-spy, keyboard controls, reduced motion, mobile TOC, and theme persistence**
- [ ] **Step 4: Run `npm test`**
- [ ] **Step 5: Run `npm run build`**
- [ ] **Step 6: Run `npm run test:browser`**
- [ ] **Step 7: Capture Light/Dark screenshots at 1440×900 and 390×844 outside the repository**
- [ ] **Step 8: Check `git diff --check`, dependency diff, route list, deployment workflow diff, and repository status**
- [ ] **Step 9: Commit final browser QA adjustments**

## Completion Contract

The final report must include the i18n/Writing tree, exact locale and article fallback algorithms, `WritingEntity` interface, collection schema, derived locale explanation, neutral routing/static rendering behavior, UI/content locale distinction, fallback notices, structured Work/About localization, Essay architecture, sovereign-driver migration and preserved visuals, removed legacy files, URL compatibility, dependency justification, all test/build results, and four screenshot paths.
