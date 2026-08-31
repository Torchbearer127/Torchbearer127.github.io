import {
	DEFAULT_LOCALE,
	resolveContentLocale,
	type SupportedLocale,
} from './locales.ts';

export type LocalizedString = Partial<Record<SupportedLocale, string>>;

export function localize(
	value: LocalizedString,
	requested: SupportedLocale = DEFAULT_LOCALE,
	original: SupportedLocale = DEFAULT_LOCALE,
) {
	const available = Object.entries(value)
		.filter((entry): entry is [SupportedLocale, string] => Boolean(entry[1]))
		.map(([locale]) => locale);
	const locale = resolveContentLocale(requested, available, original);
	return value[locale] ?? '';
}
