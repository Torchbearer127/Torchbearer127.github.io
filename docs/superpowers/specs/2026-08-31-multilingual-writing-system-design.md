# Multilingual Content Architecture and Essay Reading System

## Scope

This pass adds a static multilingual architecture for `zh-CN`, `en`, and `de`, migrates Writing to entity-based content, and turns the visual language of `sovereign-driver` into the shared Essay reading system. It keeps language-neutral public routes, GitHub Pages static deployment, the existing global theme preference, and the current information architecture.

Out of scope are automatic translation, locale-prefixed routes, search, comments, analytics, CMS integration, advanced Gallery work, and navigation redesign.

## Locale model

The supported UI locales are exactly `zh-CN`, `en`, and `de`. Locale state is centralized in focused modules under `src/i18n`.

Resolution precedence is:

1. valid `?lang=` query value;
2. valid persisted `torchbearer-locale` value;
3. normalized browser language;
4. `en`.

Simplified Chinese environments normalize to `zh-CN`, German variants to `de`, Traditional Chinese to `en`, and every other value to `en`. A valid explicit selection is persisted. URLs remain language-neutral; the query parameter is shareable and canonical links omit it.

The server-rendered no-JavaScript UI is English. A first-paint inline bootstrap resolves locale before the page is displayed, sets `html.lang`, and integrates with the existing theme bootstrap to avoid visible locale or theme flashes.

`uiLocale` controls navigation and interface copy. `contentLocale` controls the displayed article variant and can differ from the UI locale after fallback.

## Localized UI and structured content

UI copy lives in a typed TypeScript dictionary. Components consume stable message keys instead of embedding translated strings. A native select-based `LanguageSwitcher` exposes the three language names without flags and preserves the current neutral route.

Short structured content for Work and About uses a typed `LocalizedString` shape where it prevents repeated page markup. Existing facts are preserved; missing translations fall back through the same centralized resolver and no new biography, project, or Gallery claims are invented.

## Writing entity model

Writing is one Astro Content Collection loaded from `src/content/writing/**/*.{md,mdx}`. Each public article is a directory-backed entity:

```text
src/content/writing/<kind>/<slug>/
├── index.mdx       # required original variant and shared metadata
├── en.mdx          # optional translation
└── de.mdx          # optional translation
```

The original file declares `locale` and owns shared entity metadata such as date, draft state, tags, featured state, and note kind. Translation files contain localized title, description, locale, and body without duplicating shared metadata. The writing kind and slug are derived from the directory path.

The query layer assembles collection entries into a `WritingEntity` with shared metadata, an explicit original locale, and a locale-indexed variant map. It validates missing originals, duplicate locales, locale/filename mismatches, misplaced entries, and inconsistent shared metadata. `availableLocales` is derived from successfully assembled files and is never maintained manually.

Content fallback is deterministic:

1. requested locale;
2. English;
3. original locale.

Duplicates are removed from the candidate sequence. Missing translations never remove an entity from archives or route generation.

## Routing and static rendering

Every entity generates exactly one neutral static route, such as `/writing/essays/sovereign-driver/`. Locale changes do not navigate to separate pages. The route statically renders all available variants into the same document. Before display, the locale bootstrap marks the resolved variant; CSS hides inactive variants, and inactive content is removed from accessibility and focus flows.

Archive cards, homepage selections, metadata, document title, and description use the same entity-aware localized resolver. On detail pages, the client updates title and description when the selected variant changes. Canonical remains the clean neutral URL; no false `hreflang` alternates are emitted.

If UI copy falls back, the interface can show a restrained UI fallback notice. If article content falls back, the article displays a localized notice that identifies the language being shown. `html.lang` reflects `uiLocale`; the active article carries `lang=contentLocale`.

## Essay reading system

`EssayLayout.astro` becomes the shared long-form reading shell. It adapts the current `sovereign-driver` visual language to the site's global tokens and theme storage instead of preserving a second site shell.

The Essay top bar contains a back link on the left and `LanguageSwitcher` plus `ThemeToggle` on the right. It does not stack the global site header above a second article header. It retains:

- desktop sticky and mobile collapsible table of contents;
- reading progress;
- serif Chinese reading typography and existing spacing rhythm;
- paper, rails, rules, light/dark palettes, and print treatment;
- reduced-motion behavior;
- emphasized key lines, epigraphs, and attributions;
- mobile reading layout.

TOC entries come from Astro-rendered headings for each actual variant. The TOC is omitted when a variant has at most two level-two headings. Switching language swaps article, metadata, TOC, and scroll-spy targets together.

Reusable content primitives include `KeyLine`, `Epigraph`, and `Attribution`. They are framework-free Astro/MDX components. Research Notes continue using the more technical and compact article treatment rather than inheriting the Essay paper design.

## sovereign-driver migration

The current standalone HTML is the source of truth. Its article text is migrated without rewriting to `src/content/writing/essays/sovereign-driver/index.mdx`, with Chinese marked as the original locale. All five level-two sections, key lines, epigraphs, attributions, metadata, and reading behavior must survive.

Before deletion, automated guards compare normalized paragraph and heading text between the legacy source and migrated output. Only after content and visual parity pass are the standalone HTML, metadata stub, and dedicated response route removed. The canonical URL remains `/writing/essays/sovereign-driver/`.

## Accessibility and resilience

The language select is keyboard accessible and labelled. Focus remains visible. Inactive variants are hidden semantically as well as visually. Locale notices use ordinary text rather than color alone. Theme and locale bootstrap tolerate unavailable storage. The page remains usable without JavaScript using English UI and the English-or-original content fallback.

## Verification

Verification includes:

- unit tests for normalization, precedence, persistence inputs, and content fallback;
- entity assembly validation and one-entity/one-route assertions;
- `sovereign-driver` completeness and paragraph-loss guards;
- browser checks for locale switching, theme persistence, TOC, progress, mobile behavior, print, and reduced motion;
- `npm test`, `npm run build`, and `npm run test:browser`;
- Light/Dark screenshots at 1440×900 and 390×844;
- confirmation that the deployment workflow remains unchanged.

The only allowed new dependency is the official `@astrojs/mdx` integration, justified by the selected authoring model. No client framework or localization library is introduced.
