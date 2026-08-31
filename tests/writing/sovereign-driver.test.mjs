import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const mdx = readFileSync(new URL('../../src/content/writing/essays/sovereign-driver/index.mdx', import.meta.url), 'utf8');

const decode = (value) => value
	.replaceAll('&#39;', "'")
	.replaceAll('&quot;', '"')
	.replaceAll('&amp;', '&')
	.replaceAll('&lt;', '<')
	.replaceAll('&gt;', '>')
	.replaceAll('&nbsp;', ' ');

const normalize = (value) => decode(value)
	.replace(/<[^>]+>/g, '')
	.replace(/\s+/g, ' ')
	.trim();

const mdxBody = mdx.replace(/^---[\s\S]*?---\s*/, '').replace(/^import .*;\s*$/gm, '');
const mdxBlocks = mdxBody
	.split('\n')
	.map((line) => {
		if (line.startsWith('## ')) return normalize(line.slice(3));
		const match = line.match(/^<(p|KeyLine|Epigraph|Attribution)(?:\s[^>]*)?>([\s\S]*)<\/\1>$/);
		return match ? normalize(match[2]) : null;
	})
	.filter(Boolean);

test('migration keeps the verified legacy heading and paragraph sequence', () => {
	assert.equal(mdxBlocks.length, 235);
	const digest = createHash('sha256').update(mdxBlocks.join('\n')).digest('hex');
	assert.equal(digest, '62438432a9477279241ffa8b4d15d31891db0064f7a87537bdd4d0eb45539ffb');
});

test('migrated essay keeps its structural reading features', () => {
	assert.equal((mdx.match(/^## /gm) ?? []).length, 5);
	assert.ok((mdx.match(/<KeyLine>/g) ?? []).length > 40);
	assert.ok((mdx.match(/<Epigraph/g) ?? []).length >= 8);
	assert.ok((mdx.match(/<Attribution>/g) ?? []).length >= 3);
	assert.match(mdx, /locale: zh-CN/);
	assert.match(mdx, /dateLabel: 2026\/08/);
});
