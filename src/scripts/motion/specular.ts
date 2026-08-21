import { damp, smoothstep } from './math.ts';
import type { MotionEngine } from './motion-engine.ts';

export const initSpecular = (engine: MotionEngine) => {
	const elements = [...document.querySelectorAll<HTMLElement>('[data-specular]')];
	if (elements.length === 0) return () => {};

	let rects = elements.map((element) => element.getBoundingClientRect());
	const strengths = elements.map(() => 0);
	const measure = () => {
		rects = elements.map((element) => element.getBoundingClientRect());
		engine.request();
	};
	const observer = new ResizeObserver(measure);
	for (const element of elements) observer.observe(element);
	window.addEventListener('resize', measure, { passive: true });

	const unsubscribe = engine.subscribe((frame) => {
		let needsFrame = false;
		for (const [index, element] of elements.entries()) {
			const rect = rects[index];
			const centerX = rect.left + rect.width / 2;
			const centerY = rect.top + rect.height / 2;
			const deltaX = frame.pointer.rawX - centerX;
			const deltaY = frame.pointer.rawY - centerY;
			const distance = Math.hypot(deltaX, deltaY);
			const target = frame.finePointer && !frame.reducedMotion
				? smoothstep(220, 18, distance)
				: 0;
			strengths[index] = damp(strengths[index], target, 9, frame.dt);
			if (Math.abs(strengths[index] - target) > 0.001) needsFrame = true;
			element.style.setProperty('--spec-angle', `${Math.atan2(deltaY, deltaX) * 180 / Math.PI + 90}deg`);
			element.style.setProperty('--spec-strength', strengths[index].toFixed(4));
		}
		return needsFrame;
	});

	return () => {
		unsubscribe();
		observer.disconnect();
		window.removeEventListener('resize', measure);
	};
};
