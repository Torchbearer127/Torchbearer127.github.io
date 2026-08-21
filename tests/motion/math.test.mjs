import assert from 'node:assert/strict';
import test from 'node:test';

import {
	clamp,
	damp,
	normalizePointer,
	stepSpring,
	smoothstep,
} from '../../src/scripts/motion/math.ts';

test('normalizePointer maps the viewport to a stable -1..1 coordinate system', () => {
	assert.deepEqual(normalizePointer(0, 0, 200, 100), { x: -1, y: -1 });
	assert.deepEqual(normalizePointer(100, 50, 200, 100), { x: 0, y: 0 });
	assert.deepEqual(normalizePointer(200, 100, 200, 100), { x: 1, y: 1 });
	assert.deepEqual(normalizePointer(400, -50, 200, 100), { x: 1, y: -1 });
});

test('damp is frame-rate independent for equal elapsed time', () => {
	const oneStep = damp(0, 1, 5, 0.2);
	let fourSteps = 0;
	for (let index = 0; index < 4; index += 1) {
		fourSteps = damp(fourSteps, 1, 5, 0.05);
	}

	assert.ok(Math.abs(oneStep - (1 - Math.exp(-1))) < 1e-12);
	assert.ok(Math.abs(oneStep - fourSteps) < 1e-12);
});

test('smoothstep supports a reversed distance range for proximity influence', () => {
	assert.equal(smoothstep(10, 0, 10), 0);
	assert.equal(smoothstep(10, 0, 5), 0.5);
	assert.equal(smoothstep(10, 0, 0), 1);
	assert.equal(smoothstep(10, 0, -5), 1);
});

test('clamp handles values on and beyond both bounds', () => {
	assert.equal(clamp(-2, -1, 1), -1);
	assert.equal(clamp(0.25, -1, 1), 0.25);
	assert.equal(clamp(4, -1, 1), 1);
});

test('stepSpring converges without a layout-sized overshoot', () => {
	let state = { value: 0, velocity: 0 };
	for (let index = 0; index < 90; index += 1) {
		state = stepSpring(state, 1, 170, 24, 1 / 60);
	}

	assert.ok(state.value > 0.995 && state.value < 1.005);
	assert.ok(Math.abs(state.velocity) < 0.01);
});
