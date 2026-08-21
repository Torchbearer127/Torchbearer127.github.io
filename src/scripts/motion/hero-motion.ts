import { damp } from './math.ts';
import type { MotionEngine } from './motion-engine.ts';

const settle = (value: number) => Math.abs(value) < 0.0005;

export const initHeroMotion = (engine: MotionEngine) => {
	const hero = document.querySelector<HTMLElement>('[data-home-hero]');
	if (!hero) return () => {};

	const introItems = [...hero.querySelectorAll<HTMLElement>('[data-intro]')];
	const ember = hero.querySelector<HTMLElement>('[data-hero-ember]');
	const animations: Animation[] = [];
	let pointerInside = false;
	let x = 0;
	let y = 0;
	let identityResponded = false;

	if (!engine.reducedMotion) {
		const delays = [80, 140, 220, 300, 390];
		for (const [index, item] of introItems.entries()) {
			const animation = item.animate(
				[
					{ opacity: 0, transform: `translateY(${index === 2 ? 14 : 9}px)` },
					{ opacity: 1, transform: 'translateY(0)' },
				],
				{
					duration: index === 2 ? 520 : 420,
					delay: delays[index],
					easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
					fill: 'backwards',
				},
			);
			animation.finished.finally(() => animation.cancel());
			animations.push(animation);
		}
	}

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
		const targetX = enabled && pointerInside ? frame.pointer.smoothedX : 0;
		const targetY = enabled && pointerInside ? frame.pointer.smoothedY : 0;
		x = damp(x, targetX, 6, frame.dt);
		y = damp(y, targetY, 6, frame.dt);

		hero.style.setProperty('--hero-pointer-x', x.toFixed(4));
		hero.style.setProperty('--hero-pointer-y', y.toFixed(4));
		return !settle(x - targetX) || !settle(y - targetY);
	});

	return () => {
		unsubscribe();
		hero.removeEventListener('pointerenter', onPointerEnter);
		hero.removeEventListener('pointerleave', onPointerLeave);
		for (const animation of animations) animation.cancel();
	};
};
