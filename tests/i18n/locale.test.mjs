import assert from 'node:assert/strict';
import test from 'node:test';

import {
	DEFAULT_LOCALE,
	normalizeBrowserLocale,
	resolveContentLocale,
	resolveUiLocale,
} from '../../src/i18n/locales.ts';
import { localize } from '../../src/i18n/content.ts';
import { message } from '../../src/i18n/messages.ts';

test('UI locale resolution respects query, storage, browser, then English', () => {
	assert.equal(resolveUiLocale({ query: 'de', stored: 'zh-CN', browser: ['en-US'] }), 'de');
	assert.equal(resolveUiLocale({ query: 'fr', stored: 'zh-CN', browser: ['de-AT'] }), 'zh-CN');
	assert.equal(resolveUiLocale({ query: null, stored: 'bad', browser: ['de-CH'] }), 'de');
	assert.equal(resolveUiLocale({ query: null, stored: null, browser: ['fr-FR'] }), DEFAULT_LOCALE);
});

test('browser normalization distinguishes Simplified and Traditional Chinese', () => {
	for (const locale of ['zh-CN', 'zh-SG', 'zh-Hans', 'zh-Hans-CN']) {
		assert.equal(normalizeBrowserLocale(locale), 'zh-CN');
	}
	for (const locale of ['zh-TW', 'zh-HK', 'zh-MO', 'zh-Hant', 'zh-Hant-TW']) {
		assert.equal(normalizeBrowserLocale(locale), 'en');
	}
	for (const locale of ['de-DE', 'de-AT', 'de-CH']) {
		assert.equal(normalizeBrowserLocale(locale), 'de');
	}
	for (const locale of ['en-US', 'en-GB', 'ja-JP', 'fr-FR', 'es-MX']) {
		assert.equal(normalizeBrowserLocale(locale), 'en');
	}
});

test('content fallback is requested, English, then original without duplicates', () => {
	assert.equal(resolveContentLocale('de', ['zh-CN', 'en'], 'zh-CN'), 'en');
	assert.equal(resolveContentLocale('de', ['zh-CN'], 'zh-CN'), 'zh-CN');
	assert.equal(resolveContentLocale('zh-CN', ['zh-CN'], 'zh-CN'), 'zh-CN');
	assert.equal(resolveContentLocale('de', ['de', 'en', 'zh-CN'], 'zh-CN'), 'de');
	assert.equal(resolveContentLocale('zh-CN', ['en', 'de'], 'de'), 'en');
	assert.equal(resolveContentLocale('en', ['zh-CN'], 'zh-CN'), 'zh-CN');
});

test('typed UI messages and structured strings use centralized fallback', () => {
	assert.equal(message('zh-CN', 'nav.writing'), '文字');
	assert.equal(message('de', 'nav.writing'), 'Texte');
	assert.equal(localize({ en: 'About', 'zh-CN': '关于' }, 'de'), 'About');
	assert.equal(localize({ 'zh-CN': '执炬人' }, 'de', 'zh-CN'), '执炬人');
});
