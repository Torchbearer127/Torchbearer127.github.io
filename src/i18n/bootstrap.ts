import { LOCALE_STORAGE_KEY, SUPPORTED_LOCALES } from './locales.ts';

export function createFirstPaintBootstrap() {
	return `(() => {
		const root = document.documentElement;
		root.classList.add('js');

		let savedTheme = null;
		try { savedTheme = localStorage.getItem('torchbearer-theme'); } catch {}
		const theme = savedTheme === 'light' || savedTheme === 'dark'
			? savedTheme
			: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
		root.dataset.theme = theme;
		root.style.colorScheme = theme;
		document.querySelector('meta[name="theme-color"]')?.setAttribute(
			'content', theme === 'dark' ? '#0B1220' : '#FFFFFF'
		);

		const supported = ${JSON.stringify(SUPPORTED_LOCALES)};
		const params = new URLSearchParams(location.search);
		const query = params.get('lang');
		let stored = null;
		try { stored = localStorage.getItem('${LOCALE_STORAGE_KEY}'); } catch {}
		const browser = navigator.languages?.[0] || navigator.language || '';
		const normalized = String(browser).trim().replaceAll('_', '-').toLowerCase();
		let browserLocale = 'en';
		if (normalized === 'de' || normalized.startsWith('de-')) browserLocale = 'de';
		if (normalized === 'zh' || normalized.startsWith('zh-')) {
			const parts = normalized.split('-');
			const traditional = parts.some((part) => ['hant', 'tw', 'hk', 'mo'].includes(part));
			const simplified = parts.some((part) => ['hans', 'cn', 'sg'].includes(part));
			browserLocale = !traditional && (simplified || normalized === 'zh') ? 'zh-CN' : 'en';
		}
		const locale = supported.includes(query) ? query
			: supported.includes(stored) ? stored
			: browserLocale;
		root.dataset.uiLocale = locale;
		root.lang = locale;
		if (supported.includes(query)) {
			try { localStorage.setItem('${LOCALE_STORAGE_KEY}', query); } catch {}
		}
	})();`;
}
