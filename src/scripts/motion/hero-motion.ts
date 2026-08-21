import { damp, normalizePointer } from './math.ts';
import type { MotionEngine } from './motion-engine.ts';

export type IntroKind = 'kicker' | 'focus' | 'title' | 'alias' | 'statement';

interface IntroAnimation {
	keyframes: Keyframe[];
	options: KeyframeAnimationOptions;
}

const timing: Record<IntroKind, { delay: number; duration: number }> = {
	kicker: { delay: 80, duration: 300 },
	focus: { delay: 140, duration: 380 },
	title: { delay: 220, duration: 500 },
	alias: { delay: 300, duration: 360 },
	statement: { delay: 390, duration: 430 },
};

export const getIntroAnimation = (kind: IntroKind): IntroAnimation => {
	const frames: Record<IntroKind, Keyframe[]> = {
		kicker: [
			{ opacity: 0, transform: 'translate3d(-8px, 0, 0)' },
			{ opacity: 1, transform: 'translate3d(0, 0, 0)' },
		],
		focus: [
			{ opacity: 0.2, clipPath: 'inset(0 100% 0 0)' },
			{ opacity: 1, clipPath: 'inset(0 0 0 0)' },
		],
		title: [
			{ opacity: 0.45, clipPath: 'inset(0 0 100% 0)', transform: 'translate3d(0, 10px, 0)' },
			{ opacity: 1, clipPath: 'inset(0 0 0 0)', transform: 'translate3d(0, 0, 0)' },
		],
		alias: [
			{ opacity: 0, transform: 'translate3d(-8px, 0, 0)' },
			{ opacity: 1, transform: 'translate3d(0, 0, 0)' },
		],
		statement: [
			{ opacity: 0, clipPath: 'inset(0 0 100% 0)', transform: 'translate3d(0, 7px, 0)' },
			{ opacity: 1, clipPath: 'inset(0 0 0 0)', transform: 'translate3d(0, 0, 0)' },
		],
	};
	return {
		keyframes: frames[kind],
		options: {
			duration: timing[kind].duration,
			delay: timing[kind].delay,
			easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
			fill: 'backwards',
		},
	};
};

const settle = (value: number) => Math.abs(value) < 0.0005;

export const initHeroMotion = (engine: MotionEngine) => {
	const hero = document.querySelector<HTMLElement>('[data-home-hero]');
	if (!hero) return () => {};

	const introItems = [...hero.querySelectorAll<HTMLElement>('[data-intro]')];
	const ember = hero.querySelector<HTMLElement>('[data-hero-ember]');
	const field = hero.closest<HTMLElement>('[data-hero-stage]')
		?.querySelector<HTMLElement>('[data-hero-field]');
	const animations: Animation[] = [];
	let rect = hero.getBoundingClientRect();
	let pointerInside = false;
	let x = 0;
	let y = 0;
	let identityResponded = false;

	const trackAnimation = (animation: Animation) => {
		void animation.finished.then(() => animation.cancel(), () => {});
		animations.push(animation);
	};

	if (!engine.reducedMotion) {
		for (const item of introItems) {
			const kind = item.dataset.intro as IntroKind;
			const animation = getIntroAnimation(kind);
			trackAnimation(item.animate(animation.keyframes, animation.options));
		}
		if (field) {
			const fieldOpacity = getComputedStyle(field).opacity;
			trackAnimation(field.animate(
				[{ opacity: 0 }, { opacity: fieldOpacity }],
				{
					duration: 440,
					delay: 500,
					easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
					fill: 'backwards',
				},
			));
		}
	}

	const measure = () => {
		rect = hero.getBoundingClientRect();
		engine.request();
	};
	const resizeObserver = new ResizeObserver(measure);
	resizeObserver.observe(hero);

	const onPointerEnter = () => {
		pointerInside = true;
		engine.request();
		if (identityResponded || engine.reducedMotion || !engine.finePointer || !ember) return;
		identityResponded = true;
		ember.classList.add('is-responding');
		ember.addEventListener('animationend', () => ember.classList.remove('is-responding'), {
			once: true,
		});
	};
	const onPointerLeave = () => {
		pointerInside = false;
		engine.request();
	};

	hero.addEventListener('pointerenter', onPointerEnter);
	hero.addEventListener('pointerleave', onPointerLeave);
	const unsubscribe = engine.subscribe((frame) => {
		const enabled = frame.finePointer && !frame.reducedMotion;
		const localPointer = normalizePointer(
			frame.pointer.rawX - rect.left,
			frame.pointer.rawY - rect.top,
			rect.width,
			rect.height,
		);
		const targetX = enabled && pointerInside ? localPointer.x : 0;
		const targetY = enabled && pointerInside ? localPointer.y : 0;
		x = damp(x, targetX, 6, frame.dt);
		y = damp(y, targetY, 6, frame.dt);

		hero.style.setProperty('--hero-pointer-x', x.toFixed(4));
		hero.style.setProperty('--hero-pointer-y', y.toFixed(4));
		return !settle(x - targetX) || !settle(y - targetY);
	});

	return () => {
		unsubscribe();
		resizeObserver.disconnect();
		hero.removeEventListener('pointerenter', onPointerEnter);
		hero.removeEventListener('pointerleave', onPointerLeave);
		for (const animation of animations) animation.cancel();
	};
};
