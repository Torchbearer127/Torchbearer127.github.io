import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const writing = defineCollection({
	loader: glob({
		base: './src/content/writing',
		pattern: '**/*.{md,mdx}',
	}),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		locale: z.enum(['zh-CN', 'en', 'de']),
		date: z.coerce.date().optional(),
		dateLabel: z.string().optional(),
		draft: z.boolean().optional(),
		tags: z.array(z.string()).optional(),
		updated: z.coerce.date().optional(),
		featured: z.boolean().optional(),
		noteKind: z
			.enum(['reproduction', 'experiment', 'reading', 'implementation', 'idea', 'case-study'])
			.optional(),
	}),
});

export const collections = { writing };
