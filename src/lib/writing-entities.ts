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
	WritingListGroup,
	WritingSeries,
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
	'series',
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
		series: entry.data.series,
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

	const positions = new Set<string>();
	for (const entity of entities) {
		if (!entity.data.series) continue;
		const { id, order } = entity.data.series;
		const key = `${id}/${order}`;
		if (positions.has(key)) throw new Error(`Duplicate series order: ${key}`);
		positions.add(key);
	}
	return entities.sort(compareWritingEntities);
}

export function getWritingSeries<T extends WritingEntity>(entity: T, entities: T[]): T[] {
	if (!entity.data.series) return [];
	return entities
		.filter((candidate) => candidate.data.series?.id === entity.data.series!.id)
		.sort((a, b) => a.data.series!.order - b.data.series!.order);
}

export function isWritingVisible(entity: WritingEntity, previewDrafts = false): boolean {
	return !entity.data.draft || (previewDrafts && Boolean(entity.data.series));
}

export function groupWritingEntries<T extends WritingEntity>(entries: T[], groupSeries = true): WritingListGroup<T>[] {
	const groups = new Map<string, WritingListGroup<T>>();
	for (const entry of entries) {
		const series = groupSeries && entry.type === 'research-note' ? entry.data.series : undefined;
		const id = series ? `${entry.type}/series/${series.id}` : entry.id;
		const group = groups.get(id);
		if (group) {
			group.entries.push(entry);
			if (entry.data.date > group.date) group.date = entry.data.date;
		} else {
			groups.set(id, {id, type: entry.type, date: entry.data.date, series, entries: [entry]});
		}
	}
	const result = [...groups.values()].map((group) => ({...group,
		entries: [...group.entries].sort((a, b) => (a.data.series?.order ?? 0) - (b.data.series?.order ?? 0)),
	}));
	return groupSeries ? result.sort((a, b) => b.date.getTime() - a.date.getTime() || a.id.localeCompare(b.id)) : result;
}

export function getWritingSeriesHref(series: WritingSeries, type: WritingType): string {
	return `/writing/${rootByType[type]}/series/${encodeURIComponent(series.id)}`;
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
