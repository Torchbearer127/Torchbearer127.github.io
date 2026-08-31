import { getCollection, type CollectionEntry } from 'astro:content';
import type { SupportedLocale } from '../i18n/locales.ts';
import {
	assembleWritingEntities,
	getWritingHref,
	getWritingSlug,
	resolveWritingVariant,
} from './writing-entities.ts';
import type {
	WritingEntity as BaseWritingEntity,
	WritingType,
} from './writing-types.ts';

export type WritingEntry = CollectionEntry<'writing'>;
export type WritingEntity = BaseWritingEntity<WritingEntry>;
export type { WritingType } from './writing-types.ts';
export { getWritingHref, getWritingSlug, resolveWritingVariant };

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

interface WritingQuery {
	type?: WritingType;
	limit?: number;
}

export async function getWritingEntities() {
	const entries = await getCollection('writing');
	return assembleWritingEntities(entries) as WritingEntity[];
}

export async function getPublishedWriting({ type, limit }: WritingQuery = {}) {
	const entities = (await getWritingEntities()).filter((entity) => {
		return !entity.data.draft && (!type || entity.type === type);
	});

	return typeof limit === 'number' ? entities.slice(0, limit) : entities;
}

export function formatWritingDate(date: Date, locale: SupportedLocale = 'en') {
	return new Intl.DateTimeFormat(locale, {
		year: 'numeric',
		month: 'short',
		day: '2-digit',
	}).format(date);
}
