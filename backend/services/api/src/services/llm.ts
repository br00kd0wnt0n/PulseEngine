import { z } from 'zod'

type ChatMessage = { role: 'system'|'user'|'assistant'; content: string }

export type CallJsonOptions<T> = {
  model?: string
  maxTokens?: number
  temperature?: number
  // If provided, bypasses network and returns this JSON (for tests/self-test)
  mockJson?: string
  // When true, also attempts to extract a JSON object from fenced / prose content
  allowExtract?: boolean
  // For retries
  retries?: number
}

export async function callJSON<T>(
  messages: ChatMessage[],
  schema: z.ZodType<T>,
  opts: CallJsonOptions<T> = {}
): Promise<T> {
  const model = opts.model || process.env.MODEL_NAME || 'gpt-4o-mini'
  const max_tokens = opts.maxTokens ?? 700
  const temperature = opts.temperature ?? 0.4

  // Test/mocked path
  if (typeof opts.mockJson === 'string') {
    const parsed = safeParseJson(opts.mockJson, true)
    return schema.parse(parsed)
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('no-openai')
  const { OpenAI } = await import('openai')
  const client = new OpenAI({ apiKey })

  let attempt = 0
  const retries = Math.max(0, opts.retries ?? 1)
  let lastErr: any = null

  while (attempt <= retries) {
    try {
      const resp = await client.chat.completions.create({
        model,
        // Prefer JSON output. Not all models honor strict schemas, but this nudges them.
        response_format: { type: 'json_object' } as any,
        messages,
        temperature,
        max_tokens,
      })
      const raw = resp.choices?.[0]?.message?.content || '{}'
      const obj = safeParseJson(raw, !!opts.allowExtract)
      return schema.parse(obj)
    } catch (e: any) {
      lastErr = e
      attempt++
      if (attempt > retries) break
      // On retry, prepend a stricter instruction
      messages = [
        { role: 'system', content: 'Return only strict JSON that matches the requested schema. No prose, no backticks.' },
        ...messages,
      ]
    }
  }
  throw lastErr || new Error('llm_call_failed')
}

export function safeParseJson(text: string, allowExtract: boolean): any {
  try { return JSON.parse(text) } catch {}
  if (allowExtract) {
    const m = text.match(/\{[\s\S]*\}/)
    if (m) { try { return JSON.parse(m[0]) } catch {} }
  }
  throw new Error('json_parse_failed')
}

