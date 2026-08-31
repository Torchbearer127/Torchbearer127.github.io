import assert from 'node:assert/strict';
import test from 'node:test';

import {
	assembleWritingEntities,
	getWritingHref,
	resolveWritingVariant,
} from '../../src/lib/writing-entities.ts';

const original = (id, data = {}) => ({
	id,
	data: {
		title: 'Original',
		description: 'Original description',
		locale: 'zh-CN',
		date: new Date('2026-08-01'),
		draft: false,
		...data,
	},
});

const translation = (id, locale, data = {}) => ({
	id,
	data: {
		title: `${locale} title`,
		description: `${locale} description`,
		locale,
		...data,
	},
});

test('directory entries assemble into one entity with derived type, slug, and locales', () => {
	const entities = assembleWritingEntities([
		translation('essays/example/en', 'en'),
		original('essays/example'),
		translation('essays/example/de', 'de'),
	]);

	assert.equal(entities.length, 1);
	assert.equal(entities[0].type, 'essay');
	assert.equal(entities[0].slug, 'example');
	assert.equal(entities[0].originalLocale, 'zh-CN');
	assert.deepEqual(entities[0].availableLocales, ['zh-CN', 'en', 'de']);
	assert.equal(getWritingHref(entities[0]), '/writing/essays/example');
});

test('variant fallback is requested, English, then original', () => {
	const [withEnglish] = assembleWritingEntities([
		original('essays/example'),
		translation('essays/example/en', 'en'),
	]);
	const [originalOnly] = assembleWritingEntities([original('essays/original')]);

	assert.equal(resolveWritingVariant(withEnglish, 'de').locale, 'en');
	assert.equal(resolveWritingVariant(originalOnly, 'de').locale, 'zh-CN');
});

test('assembly rejects invalid layouts and metadata duplication', () => {
	assert.throws(
		() => assembleWritingEntities([translation('essays/example/en', 'en')]),
		/missing required index/i,
	);
	assert.throws(
		() => assembleWritingEntities([
			original('essays/example'),
			translation('essays/example/de', 'en'),
		]),
		/filename.*locale/i,
	);
	assert.throws(
		() => assembleWritingEntities([
			original('essays/example'),
			translation('essays/example/en', 'en', { date: new Date('2026-08-02') }),
		]),
		/shared metadata/i,
	);
	assert.throws(
		() => assembleWritingEntities([
			original('essays/example'),
			translation('essays/example/zh-CN', 'zh-CN'),
		]),
		/duplicate locale/i,
	);
	assert.throws(
		() => assembleWritingEntities([original('other/example')]),
		/must live under/i,
	);
	assert.throws(
		() => assembleWritingEntities([original('essays/unsupported', { locale: 'fr' })]),
		/unsupported original locale/i,
	);
	assert.throws(
		() => assembleWritingEntities([original('essays/missing-date', { date: undefined })]),
		/must define a valid date/i,
	);
});

test('entities sort by publication date and stable id', () => {
	const entities = assembleWritingEntities([
		original('research-notes/older', { date: new Date('2025-01-01') }),
		original('essays/b', { date: new Date('2026-01-01') }),
		original('essays/a', { date: new Date('2026-01-01') }),
	]);

	assert.deepEqual(entities.map((entity) => entity.id), [
		'essays/a',
		'essays/b',
		'research-notes/older',
	]);
});
