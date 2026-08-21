import assert from 'node:assert/strict';
import test from 'node:test';

import { getIntroAnimation } from '../../src/scripts/motion/hero-motion.ts';

test('focus and title use directional signal reveals rather than generic fades', () => {
	const focus = getIntroAnimation('focus');
	const title = getIntroAnimation('title');

	assert.equal(focus.keyframes[0].clipPath, 'inset(0 100% 0 0)');
	assert.equal(focus.keyframes.at(-1).clipPath, 'inset(0 0 0 0)');
	assert.equal(title.keyframes[0].clipPath, 'inset(0 0 100% 0)');
	assert.equal(title.keyframes.at(-1).clipPath, 'inset(0 0 0 0)');
	assert.equal(title.options.delay, 220);
});

test('identity and statement preserve the approved staged timing', () => {
	assert.equal(getIntroAnimation('alias').options.delay, 300);
	assert.equal(getIntroAnimation('statement').options.delay, 390);
	assert.equal(getIntroAnimation('statement').options.fill, 'backwards');
});
