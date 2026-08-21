import { damp, normalizePointer } from './math.ts';

export interface MotionPointer {
	rawX: number;
	rawY: number;
	x: number;
	y: number;
	smoothedX: number;
	smoothedY: number;
	velocityX: number;
	velocityY: number;
	active: boolean;
}

export interface MotionFrame {
	now: number;
	dt: number;
	pointer: Readonly<MotionPointer>;
	reducedMotion: boolean;
	finePointer: boolean;
}

export type MotionSubscriber = (frame: MotionFrame) => boolean | void;

interface MotionEngineOptions {
	requestFrame: (callback: (time: number) => void) => number;
	cancelFrame: (id: number) => void;
	viewport: () => { width: number; height: number };
	onStateChange?: (running: boolean) => void;
	smoothing?: number;
	reducedMotion?: boolean;
	finePointer?: boolean;
}

const SETTLED_EPSILON = 0.0001;
const MAX_DELTA_SECONDS = 0.05;

export class MotionEngine {
	readonly pointer: MotionPointer = {
		rawX: 0,
		rawY: 0,
		x: 0,
		y: 0,
		smoothedX: 0,
		smoothedY: 0,
		velocityX: 0,
		velocityY: 0,
		active: false,
	};

	#requestFrame: MotionEngineOptions['requestFrame'];
	#cancelFrame: MotionEngineOptions['cancelFrame'];
	#viewport: MotionEngineOptions['viewport'];
	#onStateChange: MotionEngineOptions['onStateChange'];
	#smoothing: number;
	#subscribers = new Set<MotionSubscriber>();
	#frameId: number | null = null;
	#lastTime: number | null = null;
	#hidden = false;
	#reducedMotion: boolean;
	#finePointer: boolean;
	#reportedRunning = false;

	constructor(options: MotionEngineOptions) {
		this.#requestFrame = options.requestFrame;
		this.#cancelFrame = options.cancelFrame;
		this.#viewport = options.viewport;
		this.#onStateChange = options.onStateChange;
		this.#smoothing = options.smoothing ?? 4.5;
		this.#reducedMotion = options.reducedMotion ?? false;
		this.#finePointer = options.finePointer ?? true;
	}

	get running() {
		return this.#frameId !== null;
	}

	get reducedMotion() {
		return this.#reducedMotion;
	}

	get finePointer() {
		return this.#finePointer;
	}

	subscribe(subscriber: MotionSubscriber) {
		this.#subscribers.add(subscriber);
		this.request();
		return () => this.#subscribers.delete(subscriber);
	}

	setPointer(clientX: number, clientY: number) {
		const { width, height } = this.#viewport();
		const normalized = normalizePointer(clientX, clientY, width, height);
		this.pointer.rawX = clientX;
		this.pointer.rawY = clientY;
		this.pointer.x = normalized.x;
		this.pointer.y = normalized.y;
		this.pointer.active = true;
		this.request();
	}

	setCapabilities({
		reducedMotion,
		finePointer,
	}: {
		reducedMotion?: boolean;
		finePointer?: boolean;
	}) {
		if (typeof reducedMotion === 'boolean') this.#reducedMotion = reducedMotion;
		if (typeof finePointer === 'boolean') this.#finePointer = finePointer;
		this.request();
	}

	setHidden(hidden: boolean) {
		this.#hidden = hidden;
		this.#lastTime = null;
		if (hidden) {
			if (this.#frameId !== null) this.#cancelFrame(this.#frameId);
			this.#frameId = null;
			this.#reportState(false);
			return;
		}
		this.request();
	}

	request() {
		if (this.#hidden || this.#frameId !== null || this.#subscribers.size === 0) return;
		this.#frameId = this.#requestFrame(this.#tick);
		this.#reportState(true);
	}

	destroy() {
		if (this.#frameId !== null) this.#cancelFrame(this.#frameId);
		this.#frameId = null;
		this.#lastTime = null;
		this.#subscribers.clear();
		this.#reportState(false);
	}

	#tick = (time: number) => {
		this.#frameId = null;
		if (this.#hidden) return;

		const dt = this.#lastTime === null
			? 0
			: Math.min(Math.max(0, (time - this.#lastTime) / 1000), MAX_DELTA_SECONDS);
		this.#lastTime = time;

		const previousX = this.pointer.smoothedX;
		const previousY = this.pointer.smoothedY;
		if (this.#reducedMotion || !this.#finePointer) {
			this.pointer.smoothedX = this.pointer.x;
			this.pointer.smoothedY = this.pointer.y;
		} else {
			this.pointer.smoothedX = damp(previousX, this.pointer.x, this.#smoothing, dt);
			this.pointer.smoothedY = damp(previousY, this.pointer.y, this.#smoothing, dt);
		}

		this.pointer.velocityX = dt > 0 ? (this.pointer.smoothedX - previousX) / dt : 0;
		this.pointer.velocityY = dt > 0 ? (this.pointer.smoothedY - previousY) / dt : 0;

		const pointerNeedsFrame = !this.#reducedMotion && this.#finePointer && (
			Math.abs(this.pointer.x - this.pointer.smoothedX) > SETTLED_EPSILON ||
			Math.abs(this.pointer.y - this.pointer.smoothedY) > SETTLED_EPSILON
		);
		this.pointer.active = pointerNeedsFrame;

		const frame: MotionFrame = {
			now: time,
			dt,
			pointer: this.pointer,
			reducedMotion: this.#reducedMotion,
			finePointer: this.#finePointer,
		};
		let subscriberNeedsFrame = false;
		for (const subscriber of this.#subscribers) {
			if (subscriber(frame) === true) subscriberNeedsFrame = true;
		}

		if (pointerNeedsFrame || subscriberNeedsFrame) {
			this.#frameId = this.#requestFrame(this.#tick);
		} else {
			this.#lastTime = null;
			this.#reportState(false);
		}
	};

	#reportState(running: boolean) {
		if (running === this.#reportedRunning) return;
		this.#reportedRunning = running;
		this.#onStateChange?.(running);
	}
}
