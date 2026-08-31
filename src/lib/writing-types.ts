import type { SupportedLocale } from '../i18n/locales.ts';

export type WritingType = 'research-note' | 'essay';
export type NoteKind =
	| 'reproduction'
	| 'experiment'
	| 'reading'
	| 'implementation'
	| 'idea'
	| 'case-study';

export interface WritingEntryData {
	title: string;
	description: string;
	locale: SupportedLocale;
	date?: Date;
	dateLabel?: string;
	draft?: boolean;
	tags?: string[];
	updated?: Date;
	featured?: boolean;
	noteKind?: NoteKind;
}
export interface WritingEntryLike {
	id: string;
	data: WritingEntryData;
}

export interface SharedWritingData {
	date: Date;
	dateLabel?: string;
	draft: boolean;
	tags?: string[];
	updated?: Date;
	featured?: boolean;
	noteKind?: NoteKind;
}

export interface WritingVariant<TEntry extends WritingEntryLike = WritingEntryLike> {
	locale: SupportedLocale;
	entry: TEntry;
	title: string;
	description: string;
}

export interface WritingEntity<TEntry extends WritingEntryLike = WritingEntryLike> {
	id: string;
	slug: string;
	type: WritingType;
	originalLocale: SupportedLocale;
	availableLocales: SupportedLocale[];
	variants: Partial<Record<SupportedLocale, WritingVariant<TEntry>>>;
	data: SharedWritingData;
}
