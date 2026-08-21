import { clamp, smoothstep } from './math.ts';
import type { MotionEngine, MotionFrame } from './motion-engine.ts';

interface FieldPoint {
	x: number;
	y: number;
}

interface FieldPath {
	start: FieldPoint;
	controlA: FieldPoint;
	controlB: FieldPoint;
	end: FieldPoint;
	alpha: number;
	width: number;
}

interface PathComposition {
	bucket: 'desktop' | 'narrow';
	paths: FieldPath[];
	junctions: FieldPoint[];
}

const FIELD_SEED = 127;
const POINTER_RADIUS = 0.24;
const MAX_DISPLACEMENT = 0.012;

const createRandom = (seed: number) => {
	let state = seed >>> 0;
	return () => {
		state += 0x6d2b79f5;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
};

const rounded = (value: number) => Number(value.toFixed(5));
const point = (x: number, y: number): FieldPoint => ({ x: rounded(x), y: rounded(y) });

export const createPathComposition = (
	width: number,
	_height: number,
	seed = FIELD_SEED,
): PathComposition => {
	const bucket = width < 640 ? 'narrow' : 'desktop';
	const pathCount = bucket === 'narrow' ? 12 : 24;
	const random = createRandom(seed + (bucket === 'narrow' ? 31 : 73));
	const hubs = bucket === 'narrow'
		? [point(0.72, 0.18), point(0.84, 0.47), point(0.68, 0.76)]
		: [point(0.7, 0.2), point(0.82, 0.43), point(0.66, 0.67), point(0.86, 0.8)];
	const paths: FieldPath[] = [];

	for (let index = 0; index < pathCount; index += 1) {
		const hub = hubs[index % hubs.length];
		const direction = index % 2 === 0 ? 1 : -1;
		const span = 0.08 + random() * (bucket === 'narrow' ? 0.14 : 0.22);
		const endX = clamp(hub.x + span * (0.45 + random() * 0.75), 0.52, 1.04);
		const endY = clamp(hub.y + direction * (0.035 + random() * 0.16), -0.04, 1.04);
		const start = index < hubs.length
			? point(hub.x - 0.08 - random() * 0.08, hub.y + (random() - 0.5) * 0.03)
			: point(hub.x, hub.y);
		paths.push({
			start,
			controlA: point(start.x + span * 0.32, start.y + direction * span * 0.08),
			controlB: point(endX - span * 0.28, endY - direction * span * 0.06),
			end: point(endX, endY),
			alpha: rounded(0.24 + random() * 0.5),
			width: rounded(0.45 + random() * 0.55),
		});
	}

	return { bucket, paths, junctions: hubs };
};

export const getPathDisplacement = (
	pathPoint: FieldPoint,
	pointer: FieldPoint,
	direction: FieldPoint,
): FieldPoint => {
	const distance = Math.hypot(pathPoint.x - pointer.x, pathPoint.y - pointer.y);
	if (distance >= POINTER_RADIUS) return { x: 0, y: 0 };
	const directionLength = Math.hypot(direction.x, direction.y) || 1;
	const influence = smoothstep(POINTER_RADIUS, 0, distance);
	const strength = influence * influence * MAX_DISPLACEMENT;
	return {
		x: direction.x / directionLength * strength,
		y: direction.y / directionLength * strength,
	};
};

const shifted = (
	pathPoint: FieldPoint,
	pointer: FieldPoint,
	direction: FieldPoint,
	enabled: boolean,
) => {
	if (!enabled) return pathPoint;
	const displacement = getPathDisplacement(pathPoint, pointer, direction);
	return { x: pathPoint.x + displacement.x, y: pathPoint.y + displacement.y };
};

const toCanvasPoint = (fieldPoint: FieldPoint, width: number, height: number) => ({
	x: fieldPoint.x * width,
	y: fieldPoint.y * height,
});

export const initHeroField = (engine: MotionEngine) => {
	const canvas = document.querySelector<HTMLCanvasElement>('[data-hero-field]');
	const hero = canvas?.closest<HTMLElement>('[data-home-hero]');
	const context = canvas?.getContext('2d');
	if (!canvas || !hero || !context) return () => {};

	let rect = hero.getBoundingClientRect();
	let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
	let composition = createPathComposition(rect.width, rect.height);
	let lineColor = '';
	let nodeColor = '';
	let visible = true;
	let needsRender = true;
	let renderCount = 0;

	const readColors = () => {
		const styles = getComputedStyle(canvas);
		lineColor = styles.getPropertyValue('--fx-field-line').trim();
		nodeColor = styles.getPropertyValue('--fx-field-node').trim();
		needsRender = true;
		engine.request();
	};
	const resize = () => {
		rect = hero.getBoundingClientRect();
		dpr = Math.min(window.devicePixelRatio || 1, 1.5);
		canvas.width = Math.max(1, Math.round(rect.width * dpr));
		canvas.height = Math.max(1, Math.round(rect.height * dpr));
		canvas.style.width = `${rect.width}px`;
		canvas.style.height = `${rect.height}px`;
		composition = createPathComposition(rect.width, rect.height);
		canvas.dataset.fieldDpr = String(dpr);
		canvas.dataset.fieldPathCount = String(composition.paths.length);
		needsRender = true;
		engine.request();
	};
	const draw = (frame: MotionFrame, allowDisplacement: boolean) => {
		const width = rect.width;
		const height = rect.height;
		if (width <= 0 || height <= 0) return;
		context.setTransform(dpr, 0, 0, dpr, 0, 0);
		context.clearRect(0, 0, width, height);
		const pointer = {
			x: clamp((((frame.pointer.smoothedX + 1) / 2) * window.innerWidth - rect.left) / width, 0, 1),
			y: clamp((((frame.pointer.smoothedY + 1) / 2) * window.innerHeight - rect.top) / height, 0, 1),
		};
		const direction = { x: frame.pointer.velocityX || frame.pointer.x, y: frame.pointer.velocityY || frame.pointer.y };
		const dynamic = frame.finePointer && !frame.reducedMotion;

		context.lineCap = 'round';
		for (const path of composition.paths) {
			const start = toCanvasPoint(shifted(path.start, pointer, direction, allowDisplacement), width, height);
			const controlA = toCanvasPoint(shifted(path.controlA, pointer, direction, allowDisplacement), width, height);
			const controlB = toCanvasPoint(shifted(path.controlB, pointer, direction, allowDisplacement), width, height);
			const end = toCanvasPoint(shifted(path.end, pointer, direction, allowDisplacement), width, height);
			context.beginPath();
			context.moveTo(start.x, start.y);
			context.bezierCurveTo(controlA.x, controlA.y, controlB.x, controlB.y, end.x, end.y);
			context.globalAlpha = path.alpha;
			context.lineWidth = path.width;
			context.strokeStyle = lineColor;
			context.stroke();
		}

		context.fillStyle = nodeColor;
		for (const junction of composition.junctions) {
			const node = toCanvasPoint(shifted(junction, pointer, direction, allowDisplacement), width, height);
			context.globalAlpha = 0.72;
			context.beginPath();
			context.arc(node.x, node.y, 1.35, 0, Math.PI * 2);
			context.fill();
		}
		context.globalAlpha = 1;
		renderCount += 1;
		canvas.dataset.fieldRenderCount = String(renderCount);
		canvas.dataset.fieldMode = dynamic ? 'dynamic' : 'static';
	};

	const resizeObserver = new ResizeObserver(resize);
	resizeObserver.observe(hero);
	const intersectionObserver = new IntersectionObserver(([entry]) => {
		visible = entry.isIntersecting;
		if (visible) {
			needsRender = true;
			engine.request();
		}
	}, { rootMargin: '48px' });
	intersectionObserver.observe(hero);
	const onThemeChange = () => readColors();
	window.addEventListener('torchbearer:themechange', onThemeChange);

	readColors();
	resize();
	let wasPointerInside = false;
	const unsubscribe = engine.subscribe((frame) => {
		if (!visible) return false;
		const pointerInside = frame.pointer.rawX >= rect.left && frame.pointer.rawX <= rect.right &&
			frame.pointer.rawY >= rect.top && frame.pointer.rawY <= rect.bottom;
		const interactive = frame.finePointer && !frame.reducedMotion && pointerInside;
		const pointerNeedsRender = frame.pointer.active && (pointerInside || wasPointerInside);
		if (needsRender || pointerNeedsRender) {
			draw(frame, interactive);
			needsRender = false;
		}
		wasPointerInside = pointerInside;
		return false;
	});

	return () => {
		unsubscribe();
		resizeObserver.disconnect();
		intersectionObserver.disconnect();
		window.removeEventListener('torchbearer:themechange', onThemeChange);
	};
};
