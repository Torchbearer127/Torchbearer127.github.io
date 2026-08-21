import assert from 'node:assert/strict';
import test from 'node:test';

import { MotionEngine } from '../../src/scripts/motion/motion-engine.ts';

const createFrameHarness = () => {
	let nextId = 0;
	const callbacks = new Map();
	return {
		request(callback) {
			nextId += 1;
			callbacks.set(nextId, callback);
			return nextId;
		},
		cancel(id) {
			callbacks.delete(id);
		},
		flush(time) {
			const queued = [...callbacks.values()];
			callbacks.clear();
			for (const callback of queued) callback(time);
		},
		get size() {
			return callbacks.size;
		},
	};
};

test('MotionEngine shares one frame and stops after pointer smoothing converges', () => {
	const frames = createFrameHarness();
	const engine = new MotionEngine({
		requestFrame: frames.request,
		cancelFrame: frames.cancel,
		viewport: () => ({ width: 1000, height: 500 }),
	});
	let subscriberCalls = 0;
	engine.subscribe(() => {
		subscriberCalls += 1;
		return false;
	});

	engine.setPointer(1000, 250);
	engine.setPointer(900, 250);
	assert.equal(frames.size, 1);

	let time = 0;
	for (let index = 0; index < 180 && frames.size > 0; index += 1) {
		frames.flush(time);
		time += 16.667;
	}

	assert.ok(subscriberCalls > 1);
	assert.equal(frames.size, 0);
	assert.equal(engine.running, false);
	engine.destroy();
});

test('MotionEngine caps a resumed frame delta at 50ms', () => {
	const frames = createFrameHarness();
	const engine = new MotionEngine({
		requestFrame: frames.request,
		cancelFrame: frames.cancel,
		viewport: () => ({ width: 1000, height: 500 }),
	});
	const deltas = [];
	engine.subscribe((frame) => {
		deltas.push(frame.dt);
		return deltas.length < 2;
	});

	engine.request();
	frames.flush(100);
	frames.flush(1100);

	assert.deepEqual(deltas, [0, 0.05]);
	engine.destroy();
});

test('MotionEngine pauses while hidden and resumes without accumulating time', () => {
	const frames = createFrameHarness();
	const engine = new MotionEngine({
		requestFrame: frames.request,
		cancelFrame: frames.cancel,
		viewport: () => ({ width: 1000, height: 500 }),
	});
	const deltas = [];
	engine.subscribe((frame) => {
		deltas.push(frame.dt);
		return true;
	});

	engine.request();
	frames.flush(100);
	assert.equal(frames.size, 1);

	engine.setHidden(true);
	assert.equal(frames.size, 0);
	engine.setPointer(750, 250);
	assert.equal(frames.size, 0);

	engine.setHidden(false);
	assert.equal(frames.size, 1);
	frames.flush(5000);
	assert.deepEqual(deltas, [0, 0]);
	engine.destroy();
});

test('MotionEngine reports one active-to-idle lifecycle for shared subscribers', () => {
	const frames = createFrameHarness();
	const states = [];
	const engine = new MotionEngine({
		requestFrame: frames.request,
		cancelFrame: frames.cancel,
		viewport: () => ({ width: 1000, height: 500 }),
		onStateChange: (running) => states.push(running),
	});
	engine.subscribe(() => false);

	frames.flush(0);

	assert.deepEqual(states, [true, false]);
	engine.destroy();
});
