export const clamp = (value: number, minimum: number, maximum: number) =>
	Math.min(maximum, Math.max(minimum, value));

export const damp = (
	current: number,
	target: number,
	lambda: number,
	dt: number,
) => current + (target - current) * (1 - Math.exp(-lambda * Math.max(0, dt)));

export const normalizePointer = (
	clientX: number,
	clientY: number,
	viewportWidth: number,
	viewportHeight: number,
) => ({
	x: clamp((2 * clientX) / Math.max(1, viewportWidth) - 1, -1, 1),
	y: clamp((2 * clientY) / Math.max(1, viewportHeight) - 1, -1, 1),
});

export const smoothstep = (edgeStart: number, edgeEnd: number, value: number) => {
	if (edgeStart === edgeEnd) return value < edgeStart ? 0 : 1;
	const progress = clamp((value - edgeStart) / (edgeEnd - edgeStart), 0, 1);
	return progress * progress * (3 - 2 * progress);
};

export const stepSpring = (
	state: { value: number; velocity: number },
	target: number,
	stiffness: number,
	damping: number,
	dt: number,
) => {
	const safeDelta = clamp(dt, 0, 0.05);
	const acceleration = (target - state.value) * stiffness - state.velocity * damping;
	const velocity = state.velocity + acceleration * safeDelta;
	return {
		value: state.value + velocity * safeDelta,
		velocity,
	};
};
