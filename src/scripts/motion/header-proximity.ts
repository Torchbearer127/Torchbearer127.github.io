import { smoothstep, stepSpring } from './math.ts';
import type { MotionEngine } from './motion-engine.ts';

export const initHeaderProximity = (engine: MotionEngine) => {
	const navigation = document.querySelector<HTMLElement>('[data-header-proximity]');
	const items = [...document.querySelectorAll<HTMLElement>('[data-proximity]')];
	if (!navigation || items.length === 0) return () => {};

	let navigationRect = navigation.getBoundingClientRect();
	let centers = items.map((item) => {
		const rect = item.getBoundingClientRect();
		return rect.left + rect.width / 2;
	});
	const springs = items.map(() => ({ value: 0, velocity: 0 }));
	const measure = () => {
		navigationRect = navigation.getBoundingClientRect();
		centers = items.map((item) => {
			const rect = item.getBoundingClientRect();
			return rect.left + rect.width / 2;
		});
		engine.request();
	};
	const observer = new ResizeObserver(measure);
	observer.observe(navigation);
	window.addEventListener('resize', measure, { passive: true });

	const unsubscribe = engine.subscribe((frame) => {
		let needsFrame = false;
		const pointerNearHeader = frame.pointer.rawY >= navigationRect.top - 32 &&
			frame.pointer.rawY <= navigationRect.bottom + 32;

		for (const [index, item] of items.entries()) {
			const target = frame.finePointer && !frame.reducedMotion && pointerNearHeader
				? smoothstep(132, 0, Math.abs(frame.pointer.rawX - centers[index]))
				: 0;
			springs[index] = stepSpring(springs[index], target, 170, 24, frame.dt);
			if (Math.abs(springs[index].value - target) < 0.001 && Math.abs(springs[index].velocity) < 0.001) {
				springs[index] = { value: target, velocity: 0 };
			} else {
				needsFrame = true;
			}
			item.style.setProperty('--proximity', springs[index].value.toFixed(4));
		}
		return needsFrame;
	});

	return () => {
		unsubscribe();
		observer.disconnect();
		window.removeEventListener('resize', measure);
	};
};
