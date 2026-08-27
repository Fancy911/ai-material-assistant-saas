import { z } from 'zod';

export const capabilities = ['doubao', 'douyin', 'xhs', 'qianwen'] as const;
export type Capability = (typeof capabilities)[number];
export const mediaTypes = ['video', 'image', 'gallery'] as const;
export type MediaType = (typeof mediaTypes)[number];

export const resolveRequestSchema = z.object({ input: z.string().min(1).max(4000), idempotencyKey: z.string().min(8).max(128).optional() });
export const mediaItemSchema = z.object({ type: z.enum(['video', 'image']), sourceUrl: z.string().url(), width: z.number().int().positive().nullable().optional(), height: z.number().int().positive().nullable().optional(), sizeBytes: z.number().int().nonnegative().nullable().optional(), mimeType: z.string().nullable().optional() });
export const resolveResultSchema = z.object({ success: z.boolean(), platform: z.enum(capabilities), mediaType: z.enum(mediaTypes).nullable(), title: z.string().nullable(), author: z.string().nullable(), coverUrl: z.string().url().nullable(), media: z.array(mediaItemSchema), durationSec: z.number().nonnegative().nullable(), provider: z.string(), rawCode: z.string().nullable(), errorCode: z.string().nullable() });
export type ResolveResult = z.infer<typeof resolveResultSchema>;

