import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test, { before } from 'node:test';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

before(() => {
	execFileSync('npm', ['run', 'build'], {
		cwd: projectRoot,
		stdio: 'pipe',
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

test('Legacy routes remain as compatibility pages without surviving in site navigation', () => {
	const notes = extractRegion(readPage('/notes'), 'main');
	const projects = extractRegion(readPage('/projects'), 'main');
	const footer = extractRegion(readPage('/'), 'footer');

	assert.match(notes, /href="\/writing"/);
	assert.match(projects, /href="\/work"/);
	assert.doesNotMatch(extractPrimaryNavigation(readPage('/')), /\/notes|\/projects/);
	assert.doesNotMatch(footer, /href="\/(?:notes|projects)"/);
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
