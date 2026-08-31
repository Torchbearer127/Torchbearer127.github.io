import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test, { before } from 'node:test';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
let buildOutput = '';

before(() => {
	buildOutput = execFileSync('npm', ['run', 'build'], {
		cwd: projectRoot,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	});
});

const readPage = (route) => {
	const path = route === '/' ? 'dist/index.html' : `dist${route}/index.html`;
	return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
};

const extractRegion = (html, tagName) => {
	const match = html.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)</${tagName}>`));
	assert.ok(match, `Expected a <${tagName}> region`);
	return match[1];
};

const extractPrimaryNavigation = (html) => {
	const match = html.match(/<nav\b[^>]*aria-label="Primary"[^>]*>([\s\S]*?)<\/nav>/);
	assert.ok(match, 'Expected Primary Navigation');
	return match[1];
};

test('Primary Navigation exposes only Work, Writing, and About', () => {
	const navigation = extractPrimaryNavigation(readPage('/'));
	const links = [...navigation.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(
		([, href, label]) => ({ href, label: label.replace(/<[^>]+>/g, '').trim() }),
	);

	assert.deepEqual(links, [
		{ href: '/work', label: 'Work' },
		{ href: '/writing', label: 'Writing' },
		{ href: '/about', label: 'About' },
	]);
});

test('Work is the canonical work destination with the planned section hierarchy', () => {
	const html = readPage('/work');
	const main = extractRegion(html, 'main');

	assert.match(main, /<h1[^>]*>Work<\/h1>/);
	assert.match(main, />Current Focus</);
	assert.match(main, />Selected Work</);
	assert.match(main, />Publications</);
	assert.match(extractPrimaryNavigation(html), /href="\/work" aria-current="page"/);
});

test('Homepage, Writing, and About reflect the consolidated information architecture', () => {
	const homepage = extractRegion(readPage('/'), 'main');
	const writing = extractRegion(readPage('/writing'), 'main');
	const about = extractRegion(readPage('/about'), 'main');

	assert.ok(homepage.indexOf('Current Work') < homepage.indexOf('Latest Writing'));
	assert.doesNotMatch(homepage, /Recent Notes|Selected Projects/);
	assert.match(writing, /Research notes/i);
	assert.match(writing, /Essays/i);
	assert.match(about, />Research Interests</);
	assert.match(about, />Gallery</);
	assert.match(about, />Hall of Fame</);
	assert.match(about, />Elsewhere</);
});

test('Writing is a hub with separate Research Notes and Essays collections', () => {
	const writing = extractRegion(readPage('/writing'), 'main');
	const researchNotes = extractRegion(readPage('/writing/research-notes'), 'main');
	const essays = extractRegion(readPage('/writing/essays'), 'main');

	assert.match(writing, /href="\/writing\/research-notes"/);
	assert.match(writing, /href="\/writing\/essays"/);
	assert.match(researchNotes, /<h1[^>]*>Research Notes<\/h1>/);
	assert.match(researchNotes, /href="\/writing"/);
	assert.match(essays, /<h1[^>]*>Essays<\/h1>/);
	assert.match(essays, /href="\/writing"/);
	assert.match(extractPrimaryNavigation(readPage('/writing/research-notes')), /href="\/writing" aria-current="page"/);
	assert.match(extractPrimaryNavigation(readPage('/writing/essays')), /href="\/writing" aria-current="page"/);
});

test('The first essay is discoverable from Essays and Latest Writing', () => {
	const homepage = extractRegion(readPage('/'), 'main');
	const essays = extractRegion(readPage('/writing/essays'), 'main');
	const href = '/writing/essays/sovereign-driver';
	const title = '执炬躬行照长夜，何必低眉候日升';

	assert.match(homepage, new RegExp(`href="${href}"[^>]*>${title}</a>`));
	assert.match(essays, new RegExp(`href="${href}"[^>]*>${title}</a>`));
	assert.match(essays, /2026\/08/);
});

test('The first essay uses sovereign-driver as its canonical slug', () => {
	const homepage = extractRegion(readPage('/'), 'main');
	const essays = extractRegion(readPage('/writing/essays'), 'main');
	const canonicalHref = '/writing/essays/sovereign-driver';
	const retiredHref = '/writing/essays/torchbearer-in-the-long-night';

	assert.ok(existsSync(new URL('../../dist/writing/essays/sovereign-driver/index.html', import.meta.url)));
	assert.ok(!existsSync(new URL('../../dist/writing/essays/torchbearer-in-the-long-night/index.html', import.meta.url)));
	assert.match(homepage, new RegExp(`href="${canonicalHref}"`));
	assert.match(essays, new RegExp(`href="${canonicalHref}"`));
	assert.doesNotMatch(homepage, new RegExp(`href="${retiredHref}"`));
	assert.doesNotMatch(essays, new RegExp(`href="${retiredHref}"`));
});

test('The standalone essay preserves its complete article body', () => {
	const html = readPage('/writing/essays/sovereign-driver');
	const article = html.match(/<article id="article">([\s\S]*?)<\/article>/);

	assert.ok(article, 'Expected the standalone article body');
	const digest = createHash('sha256').update(article[1]).digest('hex');
	assert.equal(digest, 'fe03a3f5bd74cd6079a766a59db03b103cec0481a5f611fb84d264e6858120c5');
});

test('The standalone essay uses the shared site navigation contract', () => {
	const html = readPage('/writing/essays/sovereign-driver');
	const header = extractRegion(html, 'header');
	const navigation = extractPrimaryNavigation(html);

	assert.match(header, /class="site-identity" href="\/"/);
	assert.match(navigation, /href="\/work"[^>]*>Work<\/a>/);
	assert.match(navigation, /href="\/writing" aria-current="page"[^>]*>Writing<\/a>/);
	assert.match(navigation, /href="\/about"[^>]*>About<\/a>/);
	assert.match(header, /aria-expanded="false"/);
	assert.match(header, /aria-controls="primary-navigation"/);
	assert.match(html, /localStorage\.getItem\("torchbearer-theme"\)/);
});

test('The essay sidebar presents its title before the Chinese contents label', () => {
	const html = readPage('/writing/essays/sovereign-driver');
	const aside = extractRegion(html, 'aside');
	const title = '执炬躬行照长夜，何必低眉候日升';
	const titleIndex = aside.indexOf(title);
	const labelIndex = aside.indexOf('目录');
	const firstLinkIndex = aside.indexOf('借得天光摹镜花，误把虚影作良工');

	assert.ok(titleIndex >= 0, 'Expected the article title in the sidebar');
	assert.ok(titleIndex < labelIndex, 'Expected the article title before 目录');
	assert.ok(labelIndex < firstLinkIndex, 'Expected 目录 before the first section link');
});

test('The essay sidebar title is slightly larger than its section links', () => {
	const html = readPage('/writing/essays/sovereign-driver');
	const titleRule = html.match(/\.contents-title\s*\{([\s\S]*?)\}/);
	const linkRule = html.match(/\.contents-link\s*\{([\s\S]*?)\}/);

	assert.ok(titleRule, 'Expected a dedicated sidebar title rule');
	assert.ok(linkRule, 'Expected a sidebar section-link rule');
	assert.match(titleRule[1], /font-size:\s*14px/);
	assert.match(linkRule[1], /font-size:\s*13px/);
});

test('Writing detail routes share one article foundation', () => {
	assert.ok(existsSync(new URL('../../src/content.config.ts', import.meta.url)));
	assert.ok(existsSync(new URL('../../src/layouts/ArticleLayout.astro', import.meta.url)));
	assert.ok(existsSync(new URL('../../src/pages/writing/research-notes/[slug].astro', import.meta.url)));
	assert.ok(existsSync(new URL('../../src/pages/writing/essays/[slug].astro', import.meta.url)));
});

test('About remains a hub with Gallery and Hall of Fame child pages', () => {
	const about = extractRegion(readPage('/about'), 'main');
	const gallery = extractRegion(readPage('/about/gallery'), 'main');
	const hallOfFame = extractRegion(readPage('/about/hall-of-fame'), 'main');

	assert.match(about, /href="\/about\/gallery"/);
	assert.match(about, /href="\/about\/hall-of-fame"/);
	assert.match(about, />Research Interests</);
	assert.match(about, />Forking Paths</);
	assert.match(about, />Elsewhere</);
	assert.match(gallery, /<h1[^>]*>Gallery<\/h1>/);
	assert.match(gallery, /href="\/about"/);
	assert.match(hallOfFame, /<h1[^>]*>Hall of Fame<\/h1>/);
	assert.match(hallOfFame, /href="\/about"/);
	assert.match(extractPrimaryNavigation(readPage('/about/gallery')), /href="\/about" aria-current="page"/);
	assert.match(extractPrimaryNavigation(readPage('/about/hall-of-fame')), /href="\/about" aria-current="page"/);
});

test('Legacy routes point to their canonical destinations without surviving in site navigation', () => {
	const notes = extractRegion(readPage('/notes'), 'main');
	const projects = extractRegion(readPage('/projects'), 'main');
	const footer = extractRegion(readPage('/'), 'footer');

	assert.match(notes, /href="\/writing\/research-notes"/);
	assert.match(projects, /href="\/work"/);
	assert.doesNotMatch(extractPrimaryNavigation(readPage('/')), /\/notes|\/projects/);
	assert.doesNotMatch(footer, /href="\/(?:notes|projects)"/);
});

test('Work remains a single curated page without child archives', () => {
	assert.ok(!existsSync(new URL('../../dist/work/projects/index.html', import.meta.url)));
	assert.ok(!existsSync(new URL('../../dist/work/publications/index.html', import.meta.url)));
	assert.ok(!existsSync(new URL('../../dist/work/current-focus/index.html', import.meta.url)));
});

test('The production build resolves the Writing collection without empty-loader warnings', () => {
	assert.doesNotMatch(buildOutput, /No files found|does not exist or is empty/);
});

test('Header reserves Ember for identity and uses Azure for current navigation', () => {
	const source = readFileSync(new URL('../../src/components/Header.astro', import.meta.url), 'utf8');
	const themeToggle = readFileSync(new URL('../../src/components/ThemeToggle.astro', import.meta.url), 'utf8');
	const motionBootstrap = readFileSync(new URL('../../src/scripts/motion/bootstrap.ts', import.meta.url), 'utf8');
	const emberReferences = source.match(/var\(--color-ember\)/g) ?? [];
	const currentIndicator = source.match(
		/\.site-nav a\[aria-current="page"\]::after\s*\{([\s\S]*?)\}/,
	);

	assert.equal(emberReferences.length, 1);
	assert.ok(currentIndicator, 'Expected a current navigation indicator rule');
	assert.match(currentIndicator[1], /background:\s*var\(--color-accent\)/);
	assert.match(source, /aria-expanded="false"/);
	assert.match(source, /aria-controls="primary-navigation"/);
	assert.match(source, /event\.key === 'Escape'/);
	assert.doesNotMatch(source, /data-(?:header-)?proximity/);
	assert.doesNotMatch(motionBootstrap, /initHeaderProximity/);
	assert.doesNotMatch(themeToggle, /data-ember-burst/);
	assert.doesNotMatch(motionBootstrap, /initEmber/);
});

test('Viewport-wide decorative fields size against the scrollbar-safe root container', () => {
	const globalStyles = readFileSync(new URL('../../src/styles/global.css', import.meta.url), 'utf8');
	const effectStyles = readFileSync(new URL('../../src/styles/effects.css', import.meta.url), 'utf8');
	const bodyRule = globalStyles.match(/body\s*\{([\s\S]*?)\}/);
	const pathFieldRule = effectStyles.match(/\[data-path-field\]\s*\{([\s\S]*?)\}/);

	assert.ok(bodyRule, 'Expected a global body rule');
	assert.ok(pathFieldRule, 'Expected a path field rule');
	assert.match(bodyRule[1], /container-type:\s*inline-size/);
	assert.match(pathFieldRule[1], /width:\s*100cqw/);
});
