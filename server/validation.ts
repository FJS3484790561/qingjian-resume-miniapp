import { z } from 'zod'
import sanitizeHtml from 'sanitize-html'
import { definitions, basicFields, validateFields, type Field } from '../src/features/resume/schema'

export const identifier = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/)
export const revision = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1)
function fieldsSchema(fields: Field[]) {
  return z.object(Object.fromEntries(fields.map(f => [f.key, z.string().max(f.kind === 'rich' ? 80000 : 500).optional()]))).strict()
    .superRefine((value, ctx) => {
      for (const [key, message] of Object.entries(validateFields(value as Record<string, string>, fields))) {
        ctx.addIssue({ code: 'custom', path: [key], message })
      }
    })
}
const modules = Object.fromEntries(definitions.map(d => {
  const entry = fieldsSchema(d.fields).safeExtend({ id: identifier }).transform(e => {
    const cleaned = { ...e } as Record<string, string>
    for (const field of d.fields.filter(f => f.kind === 'rich')) {
      if (cleaned[field.key]) cleaned[field.key] = sanitizeHtml(cleaned[field.key], {
        allowedTags: ['p','br','strong','b','em','i','u','ul','ol','li','span','div'], allowedAttributes: {}
      })
    }
    return cleaned
  })
  return [d.id, z.object({ name: z.string().trim().min(1).max(30), visible: z.boolean(), entries: z.array(entry).max(100)
    .refine(entries => new Set(entries.map(e => e.id)).size === entries.length, '条目 ID 不得重复') }).strict()]
}))
export const resumeSchema = z.object({
  id: identifier,
  title: z.string().trim().min(1).max(60),
  updatedAt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  sample: z.boolean(),
  basic: fieldsSchema(basicFields).safeExtend({ photo: z.literal('').optional(), photoId: identifier.optional() }),
  modules: z.object(modules).strict(),
  order: z.array(z.string()).length(definitions.length).refine(ids => new Set(ids).size === definitions.length && ids.every(id => definitions.some(d => d.id === id)), '模块顺序无效'),
  chronological: z.boolean(),
  layout: z.object({ templateId: identifier, color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    cover: z.enum(['none','quiet','arch','line']), font: z.number().int().min(0).max(4),
    line: z.number().int().min(0).max(4), gap: z.number().int().min(0).max(4) }).strict()
}).strict()
export const saveSchema = z.object({ resume: resumeSchema, expectedRevision: revision }).strict()
