import {
	isSupportedLocale,
	resolveContentLocale,
	type SupportedLocale,
} from '../i18n/locales.ts';
import { formatMessage, message } from '../i18n/messages.ts';

const reader = document.querySelector<HTMLElement>('[data-essay-reader]');
const progress = document.querySelector<HTMLElement>('[data-reading-progress]');

if (reader) {
	const available = (reader.dataset.availableLocales ?? '')
		.split(',')
		.filter(isSupportedLocale);
	const original = isSupportedLocale(reader.dataset.originalLocale)
		? reader.dataset.originalLocale
		: 'en';

	let activeVariant: HTMLElement | null = null;
	let frame = 0;

	const localeName = (uiLocale: SupportedLocale, locale: SupportedLocale) =>
		message(uiLocale, `language.${locale}`);

	const prepareHeadingIds = () => {
		reader.querySelectorAll<HTMLElement>('[data-essay-variant]').forEach((variant) => {
			const locale = variant.dataset.essayVariant;
			if (!locale) return;

			variant.querySelectorAll<HTMLElement>('.essay-article h2[id]').forEach((heading) => {
				if (!heading.dataset.originalHeadingId) heading.dataset.originalHeadingId = heading.id;
				heading.id = `${locale}--${heading.dataset.originalHeadingId}`;
			});

			variant.querySelectorAll<HTMLAnchorElement>('[data-toc-link]').forEach((link) => {
				const slug = link.dataset.headingSlug;
				if (slug) link.href = `#${locale}--${slug}`;
			});
		});
	};

	const updateProgressAndToc = () => {
		frame = 0;
		if (!activeVariant) return;
		const article = activeVariant.querySelector<HTMLElement>('[data-essay-article]');
		if (!article) return;

		const rect = article.getBoundingClientRect();
		const start = window.scrollY + rect.top;
		const range = Math.max(article.offsetHeight - window.innerHeight, 1);
		const value = Math.min(1, Math.max(0, (window.scrollY - start) / range));
		if (progress) {
			progress.style.width = `${value * 100}%`;
			progress.setAttribute('aria-valuenow', String(Math.round(value * 100)));
		}

		const headings = [...activeVariant.querySelectorAll<HTMLElement>('.essay-article h2[id]')];
		const activeHeading = [...headings]
			.reverse()
			.find((heading) => heading.getBoundingClientRect().top <= 140) ?? headings[0];
		activeVariant.querySelectorAll<HTMLAnchorElement>('[data-toc-link]').forEach((link) => {
			const targetId = decodeURIComponent(link.hash.slice(1));
			const current = Boolean(activeHeading && targetId === activeHeading.id);
			if (current) link.setAttribute('aria-current', 'true');
			else link.removeAttribute('aria-current');
		});
	};

	const queueUpdate = () => {
		if (!frame) frame = requestAnimationFrame(updateProgressAndToc);
	};

	const applyContentLocale = (requested: SupportedLocale) => {
		const resolved = resolveContentLocale(requested, available, original);
		document.documentElement.dataset.contentLocale = resolved;

		reader.querySelectorAll<HTMLElement>('[data-essay-variant]').forEach((variant) => {
			const active = variant.dataset.essayVariant === resolved;
			variant.toggleAttribute('hidden', !active);
			variant.setAttribute('aria-hidden', String(!active));
			if (active) activeVariant = variant;
		});

		if (!activeVariant) return;
		const notice = activeVariant.querySelector<HTMLElement>('[data-content-fallback-notice]');
		if (notice) {
			const didFallback = requested !== resolved;
			notice.hidden = !didFallback;
			notice.textContent = didFallback
				? formatMessage(requested, 'content.fallback', {
					requested: localeName(requested, requested),
					resolved: localeName(requested, resolved),
				})
				: '';
		}

		const title = activeVariant.dataset.title;
		const description = activeVariant.dataset.description;
		if (title) document.title = `${title} — 执炬人`;
		if (description) document.querySelector('meta[name="description"]')?.setAttribute('content', description);
		activeVariant.querySelector<HTMLElement>('[data-essay-article]')?.setAttribute('lang', resolved);
		reader.querySelectorAll<HTMLDetailsElement>('[data-mobile-contents]').forEach((details) => {
			details.open = false;
		});
		queueUpdate();
	};

	prepareHeadingIds();
	const initial = isSupportedLocale(document.documentElement.dataset.uiLocale)
		? document.documentElement.dataset.uiLocale
		: 'en';
	applyContentLocale(initial);

	window.addEventListener('torchbearer:localechange', (event) => {
		const locale = (event as CustomEvent<{ locale?: string }>).detail?.locale;
		if (isSupportedLocale(locale)) applyContentLocale(locale);
	});
	window.addEventListener('scroll', queueUpdate, { passive: true });
	window.addEventListener('resize', queueUpdate, { passive: true });
	reader.addEventListener('click', (event) => {
		if ((event.target as Element).closest('[data-toc-link]')) {
			reader.querySelectorAll<HTMLDetailsElement>('[data-mobile-contents]').forEach((details) => {
				details.open = false;
			});
		}
	});
}
