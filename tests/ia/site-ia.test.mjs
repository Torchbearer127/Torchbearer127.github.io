import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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

const primaryNavigation = (html) => {
	const match = html.match(/<nav\b[^>]*id="primary-navigation"[^>]*>([\s\S]*?)<\/nav>/);
	assert.ok(match, 'Expected Primary Navigation');
	return match[1];
};

const plainText = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

test('Primary Navigation keeps three neutral routes and exposes three UI locales', () => {
	const navigation = primaryNavigation(readPage('/'));
	const links = [...navigation.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((match) => match[1]);
	assert.deepEqual(links, ['/work', '/writing', '/about']);
	assert.match(navigation, /data-locale-copy="zh-CN"[^>]*>研究与实践/);
	assert.match(navigation, /data-locale-copy="en"[^>]*>Work/);
	assert.match(navigation, /data-locale-copy="de"[^>]*>Arbeit/);
});

test('all site pages use language-neutral routes and shared locale controls', () => {
	for (const route of ['/', '/work', '/writing', '/about', '/about/gallery']) {
		const html = readPage(route);
		assert.match(html, /data-locale-switcher/);
		assert.match(html, /torchbearer-locale/);
		assert.match(html, /data-title-zh-cn=/);
		assert.doesNotMatch(html, /href="\/(?:zh-CN|en|de)\//);
		assert.match(html, new RegExp(`rel="canonical" href="https://torchbearer127\\.github\\.io${route === '/' ? '/' : `${route}/`}"`));
	}
});

test('homepage signature exposes one localized quotation per supported locale', () => {
	const html = readPage('/');
	const statement = html.match(/<p class="hero-statement"[\s\S]*?<\/p>/)?.[0] ?? '';
	assert.match(statement, /data-content-copy="zh-CN"[^>]*>“此后如竟没有炬火，我便是唯一的光。”/);
	assert.match(statement, /data-content-copy="en"[^>]*>“In the heart of darkness, I found there was, within me, an invincible torch.”/);
	assert.match(statement, /data-content-copy="de"[^>]*>„Aber ich lebe in meinem eignen Lichte, ich trinke die Flammen in mich zurück, die aus mir brechen.“/);
});

test('Work keeps the planned hierarchy in all three structured locales', () => {
	const html = readPage('/work');
	const text = plainText(extractRegion(html, 'main'));
	for (const label of ['Current Focus', 'Selected Work', 'Publications', '当前聚焦', 'Aktueller Fokus']) {
		assert.match(text, new RegExp(label));
	}
	assert.match(primaryNavigation(html), /href="\/work" aria-current="page"/);
});

test('Writing remains one hub with entity-aware Research Notes and Essays archives', () => {
	const writing = extractRegion(readPage('/writing'), 'main');
	const notes = extractRegion(readPage('/writing/research-notes'), 'main');
	const essays = extractRegion(readPage('/writing/essays'), 'main');
	assert.match(writing, /href="\/writing\/research-notes"/);
	assert.match(writing, /href="\/writing\/essays"/);
	assert.match(plainText(notes), /Research Notes/);
	assert.match(plainText(essays), /Essays/);
	assert.match(primaryNavigation(readPage('/writing/essays')), /href="\/writing" aria-current="page"/);
});

test('sovereign-driver is one discoverable neutral entity route', () => {
	const homepage = readPage('/');
	const essays = readPage('/writing/essays');
	const href = '/writing/essays/sovereign-driver';
	const title = '执炬躬行照长夜，何必低眉候日升';
	assert.ok(existsSync(new URL('../../dist/writing/essays/sovereign-driver/index.html', import.meta.url)));
	assert.ok(!existsSync(new URL('../../dist/writing/essays/torchbearer-in-the-long-night/index.html', import.meta.url)));
	for (const html of [homepage, essays]) {
		assert.match(html, new RegExp(`href="${href}"`));
		assert.match(html, new RegExp(title));
		assert.doesNotMatch(html, /torchbearer-in-the-long-night/);
	}
});

test('the Essay route uses shared multilingual reader architecture', () => {
	const html = readPage('/writing/essays/sovereign-driver');
	assert.match(html, /data-essay-reader/);
	assert.match(html, /data-essay-variant="zh-CN"/);
	assert.equal((html.match(/data-essay-variant=/g) ?? []).length, 1);
	assert.match(html, /data-reading-progress/);
	assert.match(html, /data-mobile-contents/);
	assert.match(html, /data-theme-toggle/);
	assert.match(html, /data-locale-switcher/);
	assert.match(html, /rel="canonical" href="https:\/\/torchbearer127\.github\.io\/writing\/essays\/sovereign-driver\/"/);
	assert.doesNotMatch(html, /class="site-header"/);
});

test('Essay TOC comes from the five actual H2 headings without repeating the article title', () => {
	const html = readPage('/writing/essays/sovereign-driver');
	const aside = html.match(/<aside class="essay-contents"[\s\S]*?<\/aside>/)?.[0] ?? '';
	assert.doesNotMatch(aside, /essay-contents__title/);
	assert.match(aside, /essay-contents__label/);
	assert.equal((aside.match(/data-toc-link/g) ?? []).length, 5);
	const styles = readFileSync(new URL('../../src/styles/essay.css', import.meta.url), 'utf8');
	assert.doesNotMatch(styles, /\.essay-contents__title/);
	assert.match(styles, /\.essay-contents__link\s*\{[\s\S]*?font-size:\s*0\.8125rem/);
});

test('Writing detail routes use distinct shared Essay and Research Note foundations', () => {
	for (const path of [
		'../../src/content.config.ts',
		'../../src/layouts/EssayLayout.astro',
		'../../src/layouts/ResearchNoteLayout.astro',
		'../../src/pages/writing/research-notes/[slug].astro',
		'../../src/pages/writing/essays/[slug].astro',
	]) assert.ok(existsSync(new URL(path, import.meta.url)), path);
});

test('About remains a localized hub with Gallery and Hall of Fame child pages', () => {
	const about = readPage('/about');
	const text = plainText(extractRegion(about, 'main'));
	assert.match(about, /href="\/about\/gallery"/);
	assert.match(about, /href="\/about\/hall-of-fame"/);
	for (const label of ['Research Interests', '核心研究领域', 'Forschungsinteressen', 'Forking Paths', 'Gallery', 'Hall of Fame']) {
		assert.match(text, new RegExp(label));
	}
	assert.match(primaryNavigation(readPage('/about/gallery')), /href="\/about" aria-current="page"/);
});

test('legacy routes point to canonical destinations without entering navigation', () => {
	assert.match(readPage('/notes'), /href="\/writing\/research-notes"/);
	assert.match(readPage('/projects'), /href="\/work"/);
	assert.doesNotMatch(primaryNavigation(readPage('/')), /\/notes|\/projects/);
});

test('deployment and lightweight visual contracts remain intact', () => {
	assert.doesNotMatch(buildOutput, /No files found|does not exist or is empty/);
	assert.ok(!existsSync(new URL('../../dist/work/projects/index.html', import.meta.url)));
	const header = readFileSync(new URL('../../src/components/Header.astro', import.meta.url), 'utf8');
	const effects = readFileSync(new URL('../../src/styles/effects.css', import.meta.url), 'utf8');
	const global = readFileSync(new URL('../../src/styles/global.css', import.meta.url), 'utf8');
	assert.equal((header.match(/var\(--color-ember\)/g) ?? []).length, 1);
	assert.match(header, /event\.key === 'Escape'/);
	assert.match(global, /container-type:\s*inline-size/);
	assert.match(effects, /width:\s*100cqw/);
});
