import assert from 'node:assert/strict';

const endpoint = process.env.CHROME_DEBUG_URL ?? 'http://127.0.0.1:9222';
const site = process.env.BLOG_QA_URL ?? 'http://127.0.0.1:4321';
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
	if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
	return result.result.value;
};

await send('Page.enable');
await send('Runtime.enable');

const load = async ({ width = 1440, height = 900, theme = 'light', reduced = false } = {}) => {
	await send('Emulation.setDeviceMetricsOverride', {
		width,
		height,
		deviceScaleFactor: 1,
		mobile: width < 600,
	});
	await send('Emulation.setEmulatedMedia', {
		features: [
			{ name: 'prefers-color-scheme', value: theme },
			{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' },
		],
	});
	await send('Page.navigate', { url: `${site}/?motion-contract=${theme}-${width}-${reduced}` });
	await wait(900);
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

await report('Hero extraction preserves visible content and exposes motion hooks', async () => {
	await load();
	const result = await evaluate(`(() => {
		const hero = document.querySelector('[data-home-hero]');
		const title = document.querySelector('#identity-title');
		return {
			hasHero: Boolean(hero),
			introCount: hero?.querySelectorAll('[data-intro]').length ?? 0,
			layerCount: hero?.querySelectorAll('[data-hero-layer]').length ?? 0,
			title: title?.textContent?.trim(),
			titleOpacity: title ? getComputedStyle(title).opacity : null,
		};
	})()`);
	assert.deepEqual(result, {
		hasHero: true,
		introCount: 5,
		layerCount: 3,
		title: '执炬人',
		titleOpacity: '1',
	});
});

await report('One runtime drives restrained Hero, Header, and specular response then idles', async () => {
	await load();
	const targets = await evaluate(`(() => {
		const nav = document.querySelector('.site-nav a:not([aria-current])');
		const toggle = document.querySelector('[data-theme-toggle]');
		const navRect = nav.getBoundingClientRect();
		const toggleRect = toggle.getBoundingClientRect();
		return {
			nav: { x: navRect.x + navRect.width / 2, y: navRect.y + navRect.height / 2 },
			toggle: { x: toggleRect.x + toggleRect.width / 2, y: toggleRect.y + toggleRect.height / 2 },
			navWidth: nav.offsetWidth,
		};
	})()`);

	await send('Input.dispatchMouseEvent', {
		type: 'mouseMoved',
		x: targets.nav.x,
		y: targets.nav.y,
		pointerType: 'mouse',
	});
	await wait(180);
	const navState = await evaluate(`(() => {
		const nav = document.querySelector('.site-nav a:not([aria-current])');
		return {
			engine: document.documentElement.dataset.motionState,
			proximity: Number.parseFloat(getComputedStyle(nav).getPropertyValue('--proximity')),
			transform: getComputedStyle(nav).transform,
			width: nav.offsetWidth,
		};
	})()`);
	assert.equal(navState.width, targets.navWidth);
	assert.ok(navState.proximity > 0.6);
	assert.notEqual(navState.transform, 'none');

	await send('Input.dispatchMouseEvent', {
		type: 'mouseMoved',
		x: targets.toggle.x,
		y: targets.toggle.y,
		pointerType: 'mouse',
	});
	await wait(180);
	const specularStrength = await evaluate(`Number.parseFloat(
		getComputedStyle(document.querySelector('[data-specular]')).getPropertyValue('--spec-strength')
	)`);
	assert.ok(specularStrength > 0.35);

	await wait(2800);
	assert.equal(await evaluate(`document.documentElement.dataset.motionState`), 'idle');
});

await report('Reduced motion keeps all pointer-driven transforms static', async () => {
	await load({ reduced: true });
	await send('Input.dispatchMouseEvent', {
		type: 'mouseMoved',
		x: 1200,
		y: 300,
		pointerType: 'mouse',
	});
	await wait(180);
	const result = await evaluate(`(() => {
		const layer = document.querySelector('[data-hero-layer="content"]');
		const nav = document.querySelector('.site-nav a:not([aria-current])');
		return {
			reduced: document.documentElement.dataset.motionReduced,
			layerTransform: getComputedStyle(layer).transform,
			navTransform: getComputedStyle(nav).transform,
			specular: Number.parseFloat(getComputedStyle(
				document.querySelector('[data-specular]')
			).getPropertyValue('--spec-strength')),
		};
	})()`);
	assert.equal(result.reduced, 'true');
	assert.equal(result.layerTransform, 'none');
	assert.equal(result.navTransform, 'none');
	assert.equal(result.specular, 0);
});

await report('Mobile navigation and viewport remain intact', async () => {
	await load({ width: 390, height: 844 });
	const result = await evaluate(`(() => {
		const toggle = document.querySelector('[data-nav-toggle]');
		toggle.click();
		const opened = toggle.getAttribute('aria-expanded');
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		return {
			opened,
			closed: toggle.getAttribute('aria-expanded'),
			focusRestored: document.activeElement === toggle,
			clientWidth: document.documentElement.clientWidth,
			scrollWidth: document.documentElement.scrollWidth,
		};
	})()`);
	assert.deepEqual(result, {
		opened: 'true',
		closed: 'false',
		focusRestored: true,
		clientWidth: 390,
		scrollWidth: 390,
	});
});

socket.close();
