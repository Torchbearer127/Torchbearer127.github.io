import {
	isSupportedLocale,
	LOCALE_STORAGE_KEY,
	resolveContentLocale,
	type SupportedLocale,
} from './locales.ts';
import { formatMessage, message, type MessageKey } from './messages.ts';

const root = document.documentElement;

function currentLocale(): SupportedLocale {
	return isSupportedLocale(root.dataset.uiLocale) ? root.dataset.uiLocale : 'en';
}

function updateLocalizedDom(locale: SupportedLocale) {
	root.dataset.uiLocale = locale;
	root.lang = locale;

	document.querySelectorAll<HTMLElement>('[data-locale-copy]').forEach((node) => {
		const active = node.dataset.localeCopy === locale;
		node.toggleAttribute('hidden', !active);
		node.setAttribute('aria-hidden', String(!active));
	});

	document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((node) => {
		const key = node.dataset.i18n as MessageKey;
		if (key) node.textContent = message(locale, key);
	});

	for (const attribute of ['aria-label', 'title'] as const) {
		const dataName = attribute === 'aria-label' ? 'i18nAriaLabel' : 'i18nTitle';
		document.querySelectorAll<HTMLElement>(`[data-i18n-${attribute}]`).forEach((node) => {
			const key = node.dataset[dataName] as MessageKey;
			if (key) node.setAttribute(attribute, message(locale, key));
		});
	}

	document.querySelectorAll<HTMLSelectElement>('[data-locale-switcher]').forEach((select) => {
		select.value = locale;
	});

	let uiDidFallback = false;
	document.querySelectorAll<HTMLElement>('[data-content-group]').forEach((group) => {
		const available = (group.dataset.availableLocales ?? '')
			.split(',')
			.filter(isSupportedLocale);
		const original = isSupportedLocale(group.dataset.originalLocale)
			? group.dataset.originalLocale
			: 'en';
		const resolved = resolveContentLocale(locale, available, original);
		if (group.hasAttribute('data-ui-localized') && resolved !== locale) uiDidFallback = true;
		group.dataset.contentLocale = resolved;
		group.querySelectorAll<HTMLElement>('[data-content-copy]').forEach((node) => {
			const active = node.dataset.contentCopy === resolved;
			node.toggleAttribute('hidden', !active);
			node.setAttribute('aria-hidden', String(!active));
		});
		const notice = group.querySelector<HTMLElement>('[data-content-fallback]');
		if (notice) {
			const didFallback = locale !== resolved;
			notice.hidden = !didFallback;
			notice.textContent = didFallback
				? formatMessage(locale, 'content.fallback', {
					requested: message(locale, `language.${locale}`),
					resolved: message(locale, `language.${resolved}`),
				})
				: '';
		}
	});
	const uiFallbackNotice = document.querySelector<HTMLElement>('[data-ui-fallback-notice]');
	if (uiFallbackNotice) uiFallbackNotice.hidden = !uiDidFallback;

	const title = document.documentElement.dataset[`title${locale === 'zh-CN' ? 'ZhCn' : locale === 'de' ? 'De' : 'En'}`];
	const description = document.documentElement.dataset[`description${locale === 'zh-CN' ? 'ZhCn' : locale === 'de' ? 'De' : 'En'}`];
	if (title) document.title = title;
	if (description) document.querySelector('meta[name="description"]')?.setAttribute('content', description);
}

function persistLocale(locale: SupportedLocale) {
	try {
		localStorage.setItem(LOCALE_STORAGE_KEY, locale);
	} catch {
		// The choice remains active for this page when storage is unavailable.
	}
}

export function applyUiLocale(locale: SupportedLocale, updateUrl = false) {
	updateLocalizedDom(locale);
	persistLocale(locale);

	if (updateUrl) {
		const url = new URL(window.location.href);
		url.searchParams.set('lang', locale);
		history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
	}

	window.dispatchEvent(new CustomEvent('torchbearer:localechange', {
		detail: { locale },
	}));
}

document.querySelectorAll<HTMLSelectElement>('[data-locale-switcher]').forEach((select) => {
	select.addEventListener('change', () => {
		if (isSupportedLocale(select.value)) applyUiLocale(select.value, true);
	});
});

updateLocalizedDom(currentLocale());
root.dataset.localeReady = '';

export { formatMessage };
