import {
	isSupportedLocale,
	resolveContentLocale,
	SUPPORTED_LOCALES,
	type SupportedLocale,
} from '../i18n/locales.ts';
import type {
	SharedWritingData,
	WritingEntity,
	WritingEntryLike,
	WritingType,
	WritingVariant,
} from './writing-types.ts';

const typeByRoot = {
	'essays': 'essay',
	'research-notes': 'research-note',
} as const satisfies Record<string, WritingType>;

const rootByType: Record<WritingType, keyof typeof typeByRoot> = {
	essay: 'essays',
	'research-note': 'research-notes',
};

const sharedFields = [
	'date',
	'dateLabel',
	'draft',
	'tags',
	'updated',
	'featured',
	'noteKind',
] as const;

interface Candidate<TEntry extends WritingEntryLike> {
	entry: TEntry;
	file: string;
	type: WritingType;
	slug: string;
}

function parseCandidate<TEntry extends WritingEntryLike>(entry: TEntry): Candidate<TEntry> {
	const parts = entry.id.split('/');
	if ((parts.length !== 2 && parts.length !== 3) || !(parts[0] in typeByRoot)) {
		throw new Error(
			`Writing entry "${entry.id}" must live under essays/<slug>/<variant> or research-notes/<slug>/<variant>.`,
		);
	}

	const [root, slug, variant] = parts;
	const file = variant ?? 'index';
	if (!slug || !file) throw new Error(`Writing entry "${entry.id}" has an invalid path.`);

	return {
		entry,
		file,
		slug,
		type: typeByRoot[root as keyof typeof typeByRoot],
	};
}

function sharedData(entry: WritingEntryLike): SharedWritingData {
	if (!(entry.data.date instanceof Date) || Number.isNaN(entry.data.date.getTime())) {
		throw new Error(`Original writing entry "${entry.id}" must define a valid date.`);
	}

	return {
		date: entry.data.date,
		dateLabel: entry.data.dateLabel,
		draft: entry.data.draft ?? false,
		tags: entry.data.tags,
		updated: entry.data.updated,
		featured: entry.data.featured,
		noteKind: entry.data.noteKind,
	};
}

export function assembleWritingEntities<TEntry extends WritingEntryLike>(entries: TEntry[]) {
	const groups = new Map<string, Candidate<TEntry>[]>();

	for (const entry of entries) {
		const candidate = parseCandidate(entry);
		const id = `${rootByType[candidate.type]}/${candidate.slug}`;
		groups.set(id, [...(groups.get(id) ?? []), candidate]);
	}

	const entities: WritingEntity<TEntry>[] = [];
	for (const [id, candidates] of groups) {
		const original = candidates.find(({ file }) => file === 'index');
		if (!original) throw new Error(`Writing entity "${id}" is missing required index original.`);
		if (!isSupportedLocale(original.entry.data.locale)) {
			throw new Error(`Writing entity "${id}" has an unsupported original locale.`);
		}

		const variants: WritingEntity<TEntry>['variants'] = {};
		for (const candidate of candidates) {
			const locale = candidate.entry.data.locale;
			if (!isSupportedLocale(locale)) {
				throw new Error(`Writing entry "${candidate.entry.id}" has an unsupported locale.`);
			}

			if (candidate.file !== 'index') {
				if (candidate.file !== locale) {
					throw new Error(
						`Translation filename "${candidate.file}" must match locale "${locale}" in "${candidate.entry.id}".`,
					);
				}
				const repeated = sharedFields.filter((field) =>
					Object.hasOwn(candidate.entry.data, field) && candidate.entry.data[field] !== undefined,
				);
				if (repeated.length) {
					throw new Error(
						`Translation "${candidate.entry.id}" repeats shared metadata: ${repeated.join(', ')}.`,
					);
				}
			}

			if (variants[locale]) {
				throw new Error(`Writing entity "${id}" has a duplicate locale "${locale}".`);
			}

			variants[locale] = {
				locale,
				entry: candidate.entry,
				title: candidate.entry.data.title,
				description: candidate.entry.data.description,
			} as WritingVariant<TEntry>;
		}

		entities.push({
			id,
			slug: original.slug,
			type: original.type,
			originalLocale: original.entry.data.locale,
			availableLocales: SUPPORTED_LOCALES.filter((locale) => Boolean(variants[locale])),
			variants,
			data: sharedData(original.entry),
		});
	}

	return entities.sort(compareWritingEntities);
}

export function compareWritingEntities(a: WritingEntity, b: WritingEntity) {
	const dateDifference = b.data.date.getTime() - a.data.date.getTime();
	return dateDifference || a.id.localeCompare(b.id);
}

export function resolveWritingVariant<TEntry extends WritingEntryLike>(
	entity: WritingEntity<TEntry>,
	requested: SupportedLocale,
) {
	const locale = resolveContentLocale(requested, entity.availableLocales, entity.originalLocale);
	const variant = entity.variants[locale];
	if (!variant) throw new Error(`Writing entity "${entity.id}" cannot resolve locale "${locale}".`);
	return variant;
}

export function getWritingSlug(entity: WritingEntity) {
	return entity.slug;
}

export function getWritingHref(entity: WritingEntity) {
	return `/writing/${rootByType[entity.type]}/${entity.slug}`;
}
