export const SUPPORTED_LOCALES = ['zh-CN', 'en', 'de'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en';
export const LOCALE_STORAGE_KEY = 'torchbearer-locale';

export function isSupportedLocale(value: unknown): value is SupportedLocale {
	return typeof value === 'string' && SUPPORTED_LOCALES.includes(value as SupportedLocale);
}
export function normalizeBrowserLocale(value: string | null | undefined): SupportedLocale {
	if (!value) return DEFAULT_LOCALE;

	const normalized = value.trim().replaceAll('_', '-').toLowerCase();
	if (normalized === 'de' || normalized.startsWith('de-')) return 'de';
	if (normalized === 'en' || normalized.startsWith('en-')) return 'en';

	if (normalized === 'zh' || normalized.startsWith('zh-')) {
		const segments = normalized.split('-');
		const isTraditional = segments.some((segment) =>
			['hant', 'tw', 'hk', 'mo'].includes(segment),
		);
		if (isTraditional) return 'en';

		const isSimplified = segments.some((segment) =>
			['hans', 'cn', 'sg'].includes(segment),
		);
		return isSimplified || normalized === 'zh' ? 'zh-CN' : 'en';
	}

	return DEFAULT_LOCALE;
}

interface UiLocaleInput {
	query?: string | null;
	stored?: string | null;
	browser?: readonly string[] | string | null;
}

export function resolveUiLocale({ query, stored, browser }: UiLocaleInput): SupportedLocale {
	if (isSupportedLocale(query)) return query;
	if (isSupportedLocale(stored)) return stored;

	const browserLocales = Array.isArray(browser) ? browser : browser ? [browser] : [];
	return normalizeBrowserLocale(browserLocales[0]);
}

export function resolveContentLocale(
	requested: SupportedLocale,
	available: readonly SupportedLocale[],
	original: SupportedLocale,
): SupportedLocale {
	const candidates = [...new Set<SupportedLocale>([requested, 'en', original])];
	return candidates.find((locale) => available.includes(locale)) ?? original;
}
