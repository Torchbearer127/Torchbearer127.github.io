import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const endpoint = process.env.CHROME_DEBUG_URL ?? 'http://127.0.0.1:9222';
const site = process.env.BLOG_QA_URL ?? 'http://127.0.0.1:4321';
const screenshotDirectory = process.env.BLOG_SCREENSHOT_DIR;
const pages = await fetch(`${endpoint}/json`).then((response) => response.json());
const page = pages.find((entry) => entry.type === 'page');
if (!page) throw new Error('No debuggable Chrome page found');

const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 0;

socket.addEventListener('message', (event) => {
	const message = JSON.parse(event.data);
	if (!message.id || !pending.has(message.id)) return;
	const request = pending.get(message.id);
	pending.delete(message.id);
	if (message.error) request.reject(new Error(JSON.stringify(message.error)));
	else request.resolve(message.result);
});

await new Promise((resolve, reject) => {
	socket.addEventListener('open', resolve, { once: true });
	socket.addEventListener('error', reject, { once: true });
});

const send = (method, params = {}) => new Promise((resolve, reject) => {
	const id = ++nextId;
	pending.set(id, { resolve, reject });
	socket.send(JSON.stringify({ id, method, params }));
});
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const evaluate = async (expression) => {
	const result = await send('Runtime.evaluate', { expression, returnByValue: true });
	if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
	return result.result.value;
};

await send('Page.enable');
await send('Runtime.enable');

const setViewport = async (width, height, theme = 'light', reduced = false) => {
	await send('Emulation.setDeviceMetricsOverride', {
		width,
		height,
		deviceScaleFactor: 1,
		mobile: width < 600,
	});
	await send('Emulation.setTouchEmulationEnabled', { enabled: width < 600, maxTouchPoints: width < 600 ? 5 : 1 });
	await send('Emulation.setEmulatedMedia', {
		features: [
			{ name: 'prefers-color-scheme', value: theme },
			{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' },
		],
	});
};

const loadEssay = async ({ width = 1440, height = 900, theme = 'light', query = 'zh-CN', stored = null, reduced = false } = {}) => {
	await setViewport(width, height, theme, reduced);
	await send('Page.navigate', { url: `${site}/` });
	await wait(250);
	await evaluate(`(() => {
		localStorage.removeItem('torchbearer-locale');
		localStorage.removeItem('torchbearer-theme');
		${stored ? `localStorage.setItem('torchbearer-locale', ${JSON.stringify(stored)});` : ''}
		localStorage.setItem('torchbearer-theme', ${JSON.stringify(theme)});
	})()`);
	const suffix = query ? `?lang=${encodeURIComponent(query)}` : '';
	await send('Page.navigate', { url: `${site}/writing/essays/sovereign-driver/${suffix}` });
	await wait(800);
};

const report = async (name, check) => {
	try {
		await check();
		console.log(`PASS ${name}`);
	} catch (error) {
		console.error(`FAIL ${name}`);
		console.error(error.message);
		process.exitCode = 1;
	}
};

await report('query locale wins, persists, and falls article content back to the original', async () => {
	await loadEssay({ query: 'de', stored: 'zh-CN' });
	const result = await evaluate(`(() => {
		const variants = [...document.querySelectorAll('[data-essay-variant]')];
		const visible = variants.filter((variant) => !variant.hidden);
		const notice = visible[0]?.querySelector('[data-content-fallback-notice]');
		return {
			ui: document.documentElement.dataset.uiLocale,
			content: document.documentElement.dataset.contentLocale,
			stored: localStorage.getItem('torchbearer-locale'),
			select: document.querySelector('[data-locale-switcher]').value,
			visible: visible.length,
			articleLang: visible[0]?.querySelector('article')?.lang,
			noticeVisible: notice ? !notice.hidden : false,
			noticeText: notice?.textContent,
			tocLinks: visible[0]?.querySelectorAll('.essay-contents [data-toc-link]').length,
			canonical: document.querySelector('link[rel="canonical"]')?.href,
		};
	})()`);
	assert.equal(result.ui, 'de');
	assert.equal(result.content, 'zh-CN');
	assert.equal(result.stored, 'de');
	assert.equal(result.select, 'de');
	assert.equal(result.visible, 1);
	assert.equal(result.articleLang, 'zh-CN');
	assert.equal(result.noticeVisible, true);
	assert.match(result.noticeText, /nicht auf Deutsch verfügbar/);
	assert.equal(result.tocLinks, 5);
	assert.equal(result.canonical, 'https://torchbearer127.github.io/writing/essays/sovereign-driver/');
});

await report('manual language selection updates query, UI, content, metadata, and notice', async () => {
	await evaluate(`(() => {
		const select = document.querySelector('[data-locale-switcher]');
		select.value = 'zh-CN';
		select.dispatchEvent(new Event('change', { bubbles: true }));
	})()`);
	await wait(120);
	const result = await evaluate(`(() => ({
		ui: document.documentElement.dataset.uiLocale,
		content: document.documentElement.dataset.contentLocale,
		query: new URL(location.href).searchParams.get('lang'),
		stored: localStorage.getItem('torchbearer-locale'),
		noticeHidden: document.querySelector('[data-essay-variant]:not([hidden]) [data-content-fallback-notice]').hidden,
		title: document.title,
	}))()`);
	assert.equal(result.ui, 'zh-CN');
	assert.equal(result.content, 'zh-CN');
	assert.equal(result.query, 'zh-CN');
	assert.equal(result.stored, 'zh-CN');
	assert.equal(result.noticeHidden, true);
	assert.match(result.title, /执炬躬行照长夜/);
});

await report('theme persistence, reading progress, and generated TOC remain active', async () => {
	const before = await evaluate(`document.documentElement.dataset.theme`);
	await evaluate(`document.querySelector('[data-theme-toggle]').click()`);
	await evaluate(`window.scrollTo(0, document.querySelector('[data-essay-article]').offsetHeight * 0.55)`);
	await wait(180);
	const result = await evaluate(`(() => ({
		theme: document.documentElement.dataset.theme,
		storedTheme: localStorage.getItem('torchbearer-theme'),
		progress: Number(document.querySelector('[data-reading-progress]').getAttribute('aria-valuenow')),
		prefixedHeadings: [...document.querySelectorAll('.essay-article h2')].every((heading) => heading.id.startsWith('zh-CN--')),
		activeToc: document.querySelectorAll('.essay-contents [aria-current="true"]').length,
	}))()`);
	assert.notEqual(result.theme, before);
	assert.equal(result.storedTheme, result.theme);
	assert.ok(result.progress > 0);
	assert.equal(result.prefixedHeadings, true);
	assert.equal(result.activeToc, 1);
});

await report('mobile reader exposes a collapsible TOC without horizontal overflow', async () => {
	await loadEssay({ width: 390, height: 844, theme: 'dark', query: 'zh-CN', reduced: true });
	const result = await evaluate(`(() => {
		const details = document.querySelector('[data-mobile-contents]');
		details.open = true;
		return {
			display: getComputedStyle(document.querySelector('.essay-mobile-tools')).display,
			open: details.open,
			links: details.querySelectorAll('[data-toc-link]').length,
			clientWidth: document.documentElement.clientWidth,
			scrollWidth: document.documentElement.scrollWidth,
			theme: document.documentElement.dataset.theme,
		};
	})()`);
	assert.equal(result.display, 'block');
	assert.equal(result.open, true);
	assert.equal(result.links, 5);
	assert.equal(result.scrollWidth, result.clientWidth);
	assert.equal(result.theme, 'dark');
});

if (screenshotDirectory) {
	await mkdir(screenshotDirectory, { recursive: true });
	for (const item of [
		{ width: 1440, height: 900, theme: 'light' },
		{ width: 1440, height: 900, theme: 'dark' },
		{ width: 390, height: 844, theme: 'light' },
		{ width: 390, height: 844, theme: 'dark' },
	]) {
		await loadEssay({ ...item, query: 'zh-CN' });
		const capture = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
		const name = `essay-${item.width}x${item.height}-${item.theme}.png`;
		await writeFile(join(screenshotDirectory, name), Buffer.from(capture.data, 'base64'));
		console.log(`SCREENSHOT ${join(screenshotDirectory, name)}`);
	}
}

socket.close();
