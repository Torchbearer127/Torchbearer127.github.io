import assert from 'node:assert/strict';
import test from 'node:test';

import {
	createPathComposition,
	getPathDisplacement,
} from '../../src/scripts/motion/hero-field.ts';

test('path compositions are deterministic within a viewport bucket', () => {
	const first = createPathComposition(832, 472, 127);
	const second = createPathComposition(900, 520, 127);

	assert.deepEqual(first, second);
	assert.notDeepEqual(first, createPathComposition(832, 472, 128));
});

test('path density stays inside the desktop and narrow-screen budgets', () => {
	const desktop = createPathComposition(832, 472, 127);
	const narrow = createPathComposition(390, 399, 127);

	assert.ok(desktop.paths.length >= 20 && desktop.paths.length <= 26);
	assert.ok(narrow.paths.length >= 10 && narrow.paths.length <= 14);
	assert.equal(desktop.bucket, 'desktop');
	assert.equal(narrow.bucket, 'narrow');
});

test('pointer influence is local and bounded', () => {
	const near = getPathDisplacement(
		{ x: 0.5, y: 0.5 },
		{ x: 0.52, y: 0.48 },
		{ x: 0.8, y: -0.6 },
	);
	const far = getPathDisplacement(
		{ x: 0.05, y: 0.05 },
		{ x: 0.9, y: 0.9 },
		{ x: 1, y: 1 },
	);

	assert.ok(Math.hypot(near.x, near.y) <= 0.0121);
	assert.ok(Math.hypot(near.x, near.y) > 0.004);
	assert.deepEqual(far, { x: 0, y: 0 });
});
