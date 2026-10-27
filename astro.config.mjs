// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeArticle from './src/plugins/rehype-article.mjs';
import imageDimensions from './src/data/ccsc-2026-images.json' with {type: 'json'};

// https://astro.build/config
export default defineConfig({
	site: 'https://torchbearer127.github.io',
	integrations: [mdx()],
	markdown: {
		shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } },
		processor: unified({
			remarkPlugins: [remarkMath],
			rehypePlugins: [[rehypeKatex, {strict: 'ignore'}], [rehypeArticle, {imageDimensions}]],
		}),
	},
});
