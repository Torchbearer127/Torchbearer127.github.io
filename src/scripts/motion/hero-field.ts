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

export type FieldVariant = 'hero' | 'section-left' | 'section-right';

interface PathComposition {
	bucket: 'desktop' | 'narrow';
	variant: FieldVariant;
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

const getProfile = (variant: FieldVariant, bucket: PathComposition['bucket']) => {
	if (variant === 'section-right') {
		return {
			pathCount: bucket === 'narrow' ? 5 : 9,
			hubs: [point(0.68, 0.2), point(0.82, 0.5), point(0.92, 0.78)],
			direction: 1,
		};
	}
	if (variant === 'section-left') {
		return {
			pathCount: bucket === 'narrow' ? 4 : 7,
			hubs: [point(0.08, 0.24), point(0.18, 0.54), point(0.3, 0.8)],
			direction: -1,
		};
	}
	return bucket === 'narrow'
		? {
			pathCount: 12,
			hubs: [point(0.7, 0.18), point(0.84, 0.47), point(0.68, 0.76)],
			direction: 1,
		}
		: {
			pathCount: 26,
			hubs: [
				point(0.06, 0.25),
				point(0.15, 0.72),
				point(0.64, 0.18),
				point(0.76, 0.42),
				point(0.69, 0.75),
				point(0.9, 0.64),
			],
			direction: 1,
		};
};

export const createPathComposition = (
	width: number,
	_height: number,
	seed = FIELD_SEED,
	variant: FieldVariant = 'hero',
): PathComposition => {
	const bucket = width < 640 ? 'narrow' : 'desktop';
	const profile = getProfile(variant, bucket);
	const variantSalt = variant === 'hero' ? 73 : variant === 'section-left' ? 149 : 223;
	const random = createRandom(seed + variantSalt + (bucket === 'narrow' ? 31 : 0));
	const paths: FieldPath[] = [];

	for (let index = 0; index < profile.pathCount; index += 1) {
		const hub = profile.hubs[index % profile.hubs.length];
		const verticalDirection = index % 2 === 0 ? 1 : -1;
		const isLeftHeroHub = variant === 'hero' && hub.x < 0.35;
		const horizontalDirection = isLeftHeroHub ? -1 : profile.direction;
		const span = 0.07 + random() * (variant === 'hero' ? 0.2 : 0.14);
		const startOffset = 0.035 + random() * 0.075;
		const start = point(
			hub.x - horizontalDirection * startOffset,
			hub.y + (random() - 0.5) * 0.035,
		);
		const endX = clamp(
			hub.x + horizontalDirection * span * (0.55 + random() * 0.8),
			-0.06,
			1.06,
		);
		const endY = clamp(
			hub.y + verticalDirection * (0.035 + random() * 0.18),
			-0.06,
			1.06,
		);
		paths.push({
			start,
			controlA: point(
				start.x + horizontalDirection * span * 0.32,
				start.y + verticalDirection * span * 0.08,
			),
			controlB: point(
				endX - horizontalDirection * span * 0.28,
				endY - verticalDirection * span * 0.06,
			),
			end: point(endX, endY),
			alpha: rounded((variant === 'hero' ? 0.22 : 0.18) + random() * 0.42),
			width: rounded(0.45 + random() * 0.55),
		});
	}

	return { bucket, variant, paths, junctions: profile.hubs };
};

export const getPathDisplacement = (
	pathPoint: FieldPoint,
	pointer: FieldPoint,
	direction: FieldPoint,
	maximum = MAX_DISPLACEMENT,
): FieldPoint => {
	const distance = Math.hypot(pathPoint.x - pointer.x, pathPoint.y - pointer.y);
	if (distance >= POINTER_RADIUS) return { x: 0, y: 0 };
	const directionLength = Math.hypot(direction.x, direction.y) || 1;
	const influence = smoothstep(POINTER_RADIUS, 0, distance);
	const strength = influence * influence * maximum;
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
	maximum: number,
) => {
	if (!enabled) return pathPoint;
	const displacement = getPathDisplacement(pathPoint, pointer, direction, maximum);
	return { x: pathPoint.x + displacement.x, y: pathPoint.y + displacement.y };
};

const toCanvasPoint = (fieldPoint: FieldPoint, width: number, height: number) => ({
	x: fieldPoint.x * width,
	y: fieldPoint.y * height,
});

const initField = (canvas: HTMLCanvasElement, engine: MotionEngine) => {
	const surface = canvas.closest<HTMLElement>('[data-field-surface]');
	const context = canvas.getContext('2d');
	if (!surface || !context) return () => {};

	const variant = (canvas.dataset.fieldVariant ?? 'hero') as FieldVariant;
	const seed = Number.parseInt(canvas.dataset.fieldSeed ?? String(FIELD_SEED), 10);
	let rect = canvas.getBoundingClientRect();
	let dpr = 1;
	let composition = createPathComposition(rect.width, rect.height, seed, variant);
	let lineColor = '';
	let nodeColor = '';
	let nodeGlowColor = '';
	let visible = true;
	let needsRender = true;
	let renderCount = 0;
	let wasPointerInside = false;

	const readColors = () => {
		const styles = getComputedStyle(canvas);
		lineColor = styles.getPropertyValue('--fx-field-line').trim();
		nodeColor = styles.getPropertyValue('--fx-field-node').trim();
		nodeGlowColor = styles.getPropertyValue('--fx-field-node-glow').trim();
		needsRender = true;
		engine.request();
	};
	const resize = () => {
		rect = canvas.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return;
		const pixelBudget = variant === 'hero' ? 2_000_000 : 1_000_000;
		const budgetDpr = Math.sqrt(pixelBudget / Math.max(1, rect.width * rect.height));
		dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 1.5, budgetDpr));
		canvas.width = Math.max(1, Math.round(rect.width * dpr));
		canvas.height = Math.max(1, Math.round(rect.height * dpr));
		composition = createPathComposition(rect.width, rect.height, seed, variant);
		canvas.dataset.fieldDpr = dpr.toFixed(3);
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
		const direction = {
			x: frame.pointer.velocityX || frame.pointer.x,
			y: frame.pointer.velocityY || frame.pointer.y,
		};
		const maximum = Math.min(MAX_DISPLACEMENT, (variant === 'hero' ? 12 : 7) / Math.max(width, height));

		context.lineCap = 'round';
		for (const path of composition.paths) {
			const start = toCanvasPoint(shifted(path.start, pointer, direction, allowDisplacement, maximum), width, height);
			const controlA = toCanvasPoint(shifted(path.controlA, pointer, direction, allowDisplacement, maximum), width, height);
			const controlB = toCanvasPoint(shifted(path.controlB, pointer, direction, allowDisplacement, maximum), width, height);
			const end = toCanvasPoint(shifted(path.end, pointer, direction, allowDisplacement, maximum), width, height);
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
			const node = toCanvasPoint(shifted(junction, pointer, direction, allowDisplacement, maximum), width, height);
			if (variant !== 'hero' && nodeGlowColor) {
				context.save();
				context.globalAlpha = 0.34;
				context.fillStyle = nodeGlowColor;
				context.shadowColor = nodeGlowColor;
				context.shadowBlur = 4;
				context.beginPath();
				context.arc(node.x, node.y, 1.25, 0, Math.PI * 2);
				context.fill();
				context.restore();
			}
			context.globalAlpha = variant === 'hero' ? 0.72 : 0.5;
			context.beginPath();
			context.arc(node.x, node.y, variant === 'hero' ? 1.35 : 1.1, 0, Math.PI * 2);
			context.fill();
		}
		context.globalAlpha = 1;
		renderCount += 1;
		canvas.dataset.fieldRenderCount = String(renderCount);
		canvas.dataset.fieldMode = frame.finePointer && !frame.reducedMotion ? 'dynamic' : 'static';
	};

	const resizeObserver = new ResizeObserver(resize);
	resizeObserver.observe(surface);
	const intersectionObserver = new IntersectionObserver(([entry]) => {
		visible = entry.isIntersecting;
		if (visible) {
			resize();
			needsRender = true;
			engine.request();
		}
	}, { rootMargin: '64px' });
	intersectionObserver.observe(surface);
	const onThemeChange = () => readColors();
	window.addEventListener('torchbearer:themechange', onThemeChange);

	readColors();
	resize();
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

export const initPathFields = (engine: MotionEngine) => {
	const cleanups = [...document.querySelectorAll<HTMLCanvasElement>('[data-path-field]')]
		.map((canvas) => initField(canvas, engine));
	return () => {
		for (const cleanup of cleanups) cleanup();
	};
};
