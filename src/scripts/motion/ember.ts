const PARTICLES = [
	{ x: -14, y: -20, delay: 0 },
	{ x: 13, y: -18, delay: 24 },
	{ x: -19, y: -7, delay: 42 },
	{ x: 19, y: -5, delay: 18 },
	{ x: 1, y: -24, delay: 12 },
];

export const initEmber = () => {
	const controls = [...document.querySelectorAll<HTMLElement>('[data-ember-burst]')];
	if (controls.length === 0) return () => {};
	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	const listeners = new Map<HTMLElement, () => void>();

	for (const control of controls) {
		const activate = () => {
			if (reducedMotion.matches) return;
			for (const existing of control.querySelectorAll('[data-ember-particle]')) existing.remove();
			for (const particleData of PARTICLES) {
				const particle = document.createElement('span');
				particle.className = 'ember-particle';
				particle.dataset.emberParticle = '';
				particle.setAttribute('aria-hidden', 'true');
				particle.style.setProperty('--ember-x', `${particleData.x}px`);
				particle.style.setProperty('--ember-y', `${particleData.y}px`);
				particle.style.setProperty('--ember-delay', `${particleData.delay}ms`);
				particle.addEventListener('animationend', () => particle.remove(), { once: true });
				control.append(particle);
			}
		};
		listeners.set(control, activate);
		control.addEventListener('click', activate);
	}

	return () => {
		for (const [control, activate] of listeners) {
			control.removeEventListener('click', activate);
			for (const particle of control.querySelectorAll('[data-ember-particle]')) particle.remove();
		}
	};
};
