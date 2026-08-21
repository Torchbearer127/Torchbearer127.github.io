import { initHeaderProximity } from './header-proximity.ts';
import { initHeroMotion } from './hero-motion.ts';
import { MotionEngine } from './motion-engine.ts';
import { initSpecular } from './specular.ts';

const root = document.documentElement;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const engine = new MotionEngine({
	requestFrame: (callback) => window.requestAnimationFrame(callback),
	cancelFrame: (id) => window.cancelAnimationFrame(id),
	viewport: () => ({ width: window.innerWidth, height: window.innerHeight }),
	reducedMotion: reducedMotion.matches,
	finePointer: finePointer.matches,
	onStateChange: (running) => {
		root.dataset.motionState = running ? 'active' : 'idle';
	},
});

const syncCapabilities = () => {
	root.dataset.motionReduced = String(reducedMotion.matches);
	root.dataset.motionInput = finePointer.matches ? 'fine' : 'coarse';
	engine.setCapabilities({
		reducedMotion: reducedMotion.matches,
		finePointer: finePointer.matches,
	});
};
const onPointerMove = (event: PointerEvent) => engine.setPointer(event.clientX, event.clientY);
const onVisibilityChange = () => engine.setHidden(document.hidden);

syncCapabilities();
window.addEventListener('pointermove', onPointerMove, { passive: true });
document.addEventListener('visibilitychange', onVisibilityChange);
reducedMotion.addEventListener('change', syncCapabilities);
finePointer.addEventListener('change', syncCapabilities);

const cleanups = [
	initHeroMotion(engine),
	initHeaderProximity(engine),
	initSpecular(engine),
];

window.addEventListener('pagehide', () => {
	for (const cleanup of cleanups) cleanup();
	window.removeEventListener('pointermove', onPointerMove);
	document.removeEventListener('visibilitychange', onVisibilityChange);
	reducedMotion.removeEventListener('change', syncCapabilities);
	finePointer.removeEventListener('change', syncCapabilities);
	engine.destroy();
}, { once: true });
