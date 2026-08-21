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
	if (result.exceptionDetails) {
		throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
	}
	return result.result.value;
};

await send('Page.enable');
await send('Runtime.enable');

const load = async ({ width = 1440, height = 900, theme = 'light', reduced = false } = {}) => {
	await evaluate(`localStorage.removeItem('torchbearer-theme')`);
	await send('Emulation.setDeviceMetricsOverride', {
		width,
		height,
		deviceScaleFactor: 1,
		mobile: width < 600,
	});
	await send('Emulation.setTouchEmulationEnabled', {
		enabled: width < 600,
		maxTouchPoints: width < 600 ? 5 : 1,
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

await report('Hero field is decorative, DPR-capped, dynamic on fine input, and idle-bounded', async () => {
	await load();
	const before = await evaluate(`(() => {
		const canvas = document.querySelector('[data-hero-field]');
		const hero = document.querySelector('[data-home-hero]').getBoundingClientRect();
		return {
			ariaHidden: canvas.getAttribute('aria-hidden'),
			pointerEvents: getComputedStyle(canvas).pointerEvents,
			dpr: Number.parseFloat(canvas.dataset.fieldDpr),
			pathCount: Number.parseInt(canvas.dataset.fieldPathCount, 10),
			mode: canvas.dataset.fieldMode,
			renders: Number.parseInt(canvas.dataset.fieldRenderCount, 10),
			pointer: { x: hero.right - 120, y: hero.top + 170 },
		};
	})()`);
	assert.equal(before.ariaHidden, 'true');
	assert.equal(before.pointerEvents, 'none');
	assert.ok(before.dpr <= 1.5);
	assert.ok(before.pathCount >= 20 && before.pathCount <= 26);
	assert.equal(before.mode, 'dynamic');

	await send('Input.dispatchMouseEvent', {
		type: 'mouseMoved',
		x: before.pointer.x,
		y: before.pointer.y,
		pointerType: 'mouse',
	});
	await wait(180);
	const afterPointer = await evaluate(`Number.parseInt(
		document.querySelector('[data-hero-field]').dataset.fieldRenderCount,
		10
	)`);
	assert.ok(afterPointer > before.renders);

	await wait(2800);
	const settled = await evaluate(`({
		state: document.documentElement.dataset.motionState,
		renders: Number.parseInt(document.querySelector('[data-hero-field]').dataset.fieldRenderCount, 10),
	})`);
	await wait(180);
	assert.equal(settled.state, 'idle');
	assert.equal(
		await evaluate(`Number.parseInt(document.querySelector('[data-hero-field]').dataset.fieldRenderCount, 10)`),
		settled.renders,
	);
});

await report('Reduced motion renders one static Hero field composition', async () => {
	await load({ reduced: true });
	const before = await evaluate(`(() => {
		const canvas = document.querySelector('[data-hero-field]');
		return {
			mode: canvas.dataset.fieldMode,
			renders: Number.parseInt(canvas.dataset.fieldRenderCount, 10),
		};
	})()`);
	assert.equal(before.mode, 'static');
	await send('Input.dispatchMouseEvent', {
		type: 'mouseMoved',
		x: 1180,
		y: 260,
		pointerType: 'mouse',
	});
	await wait(300);
	assert.equal(
		await evaluate(`Number.parseInt(document.querySelector('[data-hero-field]').dataset.fieldRenderCount, 10)`),
		before.renders,
	);
});

await report('Ember activation is click-only, finite, and reduced-motion safe', async () => {
	await load();
	await send('Input.dispatchMouseEvent', {
		type: 'mouseMoved',
		x: 1230,
		y: 32,
		pointerType: 'mouse',
	});
	await wait(120);
	assert.equal(await evaluate(`document.querySelectorAll('[data-ember-particle]').length`), 0);
	await evaluate(`document.querySelector('[data-ember-burst]').click()`);
	const particleCount = await evaluate(`document.querySelectorAll('[data-ember-particle]').length`);
	assert.ok(particleCount >= 3 && particleCount <= 5);
	await wait(720);
	assert.equal(await evaluate(`document.querySelectorAll('[data-ember-particle]').length`), 0);

	await load({ reduced: true });
	await evaluate(`document.querySelector('[data-ember-burst]').click()`);
	assert.equal(await evaluate(`document.querySelectorAll('[data-ember-particle]').length`), 0);
});

await report('Tablet and narrow viewport geometry stays collision-free', async () => {
	const cases = [
		{ width: 1024, height: 768, theme: 'light', paths: 24 },
		{ width: 1024, height: 768, theme: 'dark', paths: 24 },
		{ width: 768, height: 1024, theme: 'light', paths: 24 },
		{ width: 768, height: 1024, theme: 'dark', paths: 24 },
		{ width: 320, height: 568, theme: 'light', paths: 12 },
	];
	for (const item of cases) {
		console.log(`  QA ${item.theme} ${item.width}x${item.height}`);
		await load(item);
		const result = await evaluate(`(() => {
			const brand = document.querySelector('.site-identity').getBoundingClientRect();
			const nav = document.querySelector('.site-nav');
			const navRect = nav.getBoundingClientRect();
			const navVisible = getComputedStyle(nav).display !== 'none';
			const canvas = document.querySelector('[data-hero-field]');
			return {
				theme: document.documentElement.dataset.theme,
				motionInput: document.documentElement.dataset.motionInput,
				clientWidth: document.documentElement.clientWidth,
				scrollWidth: document.documentElement.scrollWidth,
				headerCollision: navVisible && brand.right > navRect.left,
				pathCount: Number.parseInt(canvas.dataset.fieldPathCount, 10),
				latestTop: document.querySelector('#latest-writing').getBoundingClientRect().top,
			};
		})()`);
		assert.equal(result.theme, item.theme);
		assert.equal(result.clientWidth, item.width);
		assert.equal(result.scrollWidth, item.width);
		assert.equal(result.headerCollision, false);
		assert.equal(result.pathCount, item.paths);
		if (item.width >= 768) assert.ok(result.latestTop < item.height);
		if (item.width === 320) assert.equal(result.motionInput, 'coarse');
	}
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
