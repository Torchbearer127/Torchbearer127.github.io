import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const writing = defineCollection({
	loader: glob({
		base: './src/content/writing',
		pattern: '**/*.md',
	}),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		date: z.coerce.date(),
		dateLabel: z.string().optional(),
		type: z.enum(['research-note', 'essay']),
		draft: z.boolean().default(false),
		standalone: z.boolean().default(false),
		tags: z.array(z.string()).optional(),
		updated: z.coerce.date().optional(),
		featured: z.boolean().optional(),
		noteKind: z
			.enum(['reproduction', 'experiment', 'reading', 'implementation', 'idea', 'case-study'])
			.optional(),
	}),
});

export const collections = { writing };
