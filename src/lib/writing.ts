import { getCollection, type CollectionEntry } from 'astro:content';

export type WritingEntry = CollectionEntry<'writing'>;
export type WritingType = WritingEntry['data']['type'];

const routeRoots: Record<WritingType, string> = {
	'research-note': 'research-notes',
	essay: 'essays',
};

export const writingTypeLabels: Record<WritingType, string> = {
	'research-note': 'Research Note',
	essay: 'Essay',
};

export const noteKindLabels = {
	reproduction: 'Reproduction',
	experiment: 'Experiment',
	reading: 'Reading',
	implementation: 'Implementation',
	idea: 'Idea',
	'case-study': 'Case Study',
} as const;

export function compareWritingEntries(a: WritingEntry, b: WritingEntry) {
	const dateDifference = b.data.date.getTime() - a.data.date.getTime();
	if (dateDifference !== 0) return dateDifference;
	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function getWritingSlug(entry: WritingEntry) {
	const prefix = `${routeRoots[entry.data.type]}/`;
	if (!entry.id.startsWith(prefix)) {
		throw new Error(`Writing entry "${entry.id}" must live under "${prefix}".`);
	}

	const slug = entry.id.slice(prefix.length);
	if (!slug || slug.includes('/')) {
		throw new Error(`Writing entry "${entry.id}" must use a single-segment slug.`);
	}

	return slug;
}

export function getWritingHref(entry: WritingEntry) {
	return `/writing/${routeRoots[entry.data.type]}/${getWritingSlug(entry)}`;
}

interface WritingQuery {
	type?: WritingType;
	limit?: number;
}

export async function getPublishedWriting({ type, limit }: WritingQuery = {}) {
	const entries = await getCollection('writing', ({ data }) => {
		return !data.draft && (!type || data.type === type);
	});
	const sortedEntries = entries.sort(compareWritingEntries);

	return typeof limit === 'number' ? sortedEntries.slice(0, limit) : sortedEntries;
}

export function formatWritingDate(date: Date) {
	return new Intl.DateTimeFormat('en', {
		year: 'numeric',
		month: 'short',
		day: '2-digit',
	}).format(date);
}
