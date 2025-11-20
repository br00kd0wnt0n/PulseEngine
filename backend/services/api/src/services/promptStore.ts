import { AppDataSource } from '../db/data-source.js'
import { AICache } from '../db/entities/AICache.js'

export type PromptKey =
  | 'narrative_from_trends'
  | 'debrief'
  | 'opportunities'
  | 'enhancements'
  | 'recommendations'
  | 'concept_proposal'
  | 'rewrite_narrative'
  | 'wildcard'

export const promptMeta: Record<PromptKey, { label: string; trigger: string }> = {
  narrative_from_trends: { label: 'Narrative from Trends', trigger: '/ai/narrative (TrendGraph mode)' },
  debrief: { label: 'Debrief (Strategic Brief)', trigger: '/ai/debrief' },
  opportunities: { label: 'Opportunities (Ranked)', trigger: '/ai/opportunities' },
  enhancements: { label: 'Enhancements (Targeted)', trigger: '/ai/enhancements' },
  recommendations: { label: 'Recommendations (Framework)', trigger: '/ai/recommendations' },
  concept_proposal: { label: 'Concept Proposal', trigger: '/ai/concept-proposal' },
  rewrite_narrative: { label: 'Rewrite Narrative (Apply Enhancements)', trigger: '/ai/rewrite-narrative' },
  wildcard: { label: 'Wildcard Insight', trigger: '/ai/wildcard' },
}

// Default templates with {{variables}}
export const defaultTemplates: Record<PromptKey, string> = {
  narrative_from_trends:
    `Given these active trends: {{trends}}{{#if focus}}\nFocus on: {{focus}}{{/if}}.\nExplain the narrative opportunity in 4-6 sentences: why now, which hooks, and predicted time-to-peak. Keep it direct.`,

  debrief:
    `You are a campaign strategist creating a strategic brief for persona: {{personaOrGeneral}}.

CAMPAIGN CONCEPT: "{{concept}}"

{{#if context}}# RELEVANT CONTEXT (cite these specific trends and insights):
{{context}}

{{/if}}# YOUR TASK:
Create a strategic campaign brief as JSON with these fields:

1. "brief" (2-3 sentences): Explain WHY this concept is strategically valuable right now. Reference specific trending content, platforms, or cultural moments from the context above. Be concrete and actionable.

2. "summary" (1 sentence): The core campaign insight or hook that makes this timely and engaging.

3. "keyPoints" (4 strategic bullets): Actionable campaign strategy points. Each should be specific to THIS concept and reference the context when possible.

4. "didYouKnow" (3 contextual insights): Surprising facts or trend insights from the context that support this campaign.

Return ONLY valid JSON with keys: brief, summary, keyPoints, didYouKnow.`,

  opportunities:
    `You are a campaign strategist for persona: {{personaOrGeneral}}. Analyze this campaign concept: "{{concept}}"

{{#if context}}# RELEVANT CONTEXT (reference specific trends and data):
{{context}}

{{/if}}# YOUR TASK:
Identify 5 HIGH-IMPACT campaign opportunities that are specific to this concept, grounded in the context, and actionable (story beats, formats, creator plays).

Return ONLY JSON: { "opportunities": [{ "title": string, "why": string, "impact": number }], "rationale": string }`,

  enhancements:
    `You are a campaign strategist optimizing this concept for persona: {{personaOrGeneral}}: "{{concept}}"

Current campaign scores (0-100):
- Narrative Strength: {{narrativeScore}}
- Time to Peak: {{ttpScore}}
- Cross-Platform Potential: {{crossScore}}
- Commercial Viability: {{commercialScore}}

# YOUR TASK:
Propose 4 SPECIFIC, ACTIONABLE enhancements to strengthen this campaign. Each enhancement should target a narrative block (origin|hook|arc|pivots|evidence|resolution) and provide concrete execution.

Return ONLY JSON: { "suggestions": [{ "text": string, "target": string, "deltas": { "narrative": number, "ttp": number, "cross": number, "commercial": number } }] }`,

  recommendations:
    `You are a campaign strategist for persona: {{personaOrGeneral}}. You're creating an execution plan for: "{{concept}}"

{{#if context}}# CONTEXT (for grounding):
{{context}}

{{/if}}# YOUR TASK:
Provide arrays for: narrative, content, platform, collab (execution bullets) and a framework object { market, narrative, commercial } with { score, why }.

Return ONLY JSON with keys exactly: narrative, content, platform, collab, framework.`,

  concept_proposal:
    `You are a creative strategist crafting a shareable campaign proposal for persona: {{personaOrGeneral}}.

CONCEPT: "{{concept}}"

# Narrative Blocks
Hook: {{hook}}
Origin: {{origin}}
Arc: {{arc}}
Pivots: {{pivots}}
Evidence: {{evidence}}
Resolution: {{resolution}}

{{#if context}}# CONTEXT (trends/creators/live):
{{context}}

{{/if}}Write a compelling, specific, narrative-driven proposal that can be shared with partners. Keep it crisp and persuasive.`,

  rewrite_narrative:
    `You are a campaign strategist. Rewrite the narrative below for the concept "{{concept}}"{{personaRegion}}, integrating these selected enhancements. Keep the same structure (numbered sections) and make it crisp, specific, and actionable.

# Current Narrative
{{narrative}}

# Selected Enhancements
{{enhancementsList}}

Return ONLY the rewritten narrative, preserving numbered section headings.`,

  wildcard:
    `You are a contrarian campaign strategist. Generate 1–2 WILDCARD insights that defy default assumptions AND are testable this week.
Concept: "{{concept}}"{{personaRegion}}

Grounding context (each item has an id). Cite ONLY using these ids:
{{enumerated}}

Strict rules:
- No generic advice; do not restate any existing narrative or debrief.
- Each idea must clearly challenge common platform tactics or biases and include at least one trade‑off.
- Each idea MUST include exactly 3 evidence citations using id format like "ctx3" that map to the provided context.
- Be specific, quantified where possible.

Output ONLY strict JSON with this schema and keys, no prose:
{ "ideas": [ { "title": string, "contrarianWhy": string[], "evidence": string[], "upside": string, "risks": string[], "testPlan": string[], "firstStep": string } ] }`,
}

export async function getPrompt(key: PromptKey): Promise<string> {
  const repo = AppDataSource.getRepository(AICache)
  const found = await repo.findOne({ where: { key: `prompt:${key}` } })
  if (found && typeof found.value?.content === 'string') return found.value.content
  return defaultTemplates[key]
}

export async function setPrompt(key: PromptKey, content: string) {
  const repo = AppDataSource.getRepository(AICache)
  await repo.upsert({ key: `prompt:${key}`, value: { content, updatedAt: new Date().toISOString() } as any }, ['key'])
}

export async function listPrompts(): Promise<{ key: PromptKey; content: string; meta: { label: string; trigger: string } }[]> {
  const out: { key: PromptKey; content: string; meta: { label: string; trigger: string } }[] = []
  for (const key of Object.keys(defaultTemplates) as PromptKey[]) {
    const content = await getPrompt(key)
    out.push({ key, content, meta: promptMeta[key] })
  }
  return out
}

export function renderTemplate(tpl: string, vars: Record<string, any>): string {
  // simple {{var}} replacement with a couple of helpers
  return tpl
    .replace(/\{\{personaOrGeneral\}\}/g, vars.persona ? String(vars.persona) : 'General')
    .replace(/\{\{personaRegion\}\}/g, (() => {
      const parts = [] as string[]
      if (vars.persona) parts.push(`persona: ${vars.persona}`)
      if (vars.region) parts.push(`region: ${vars.region}`)
      return parts.length ? ` (${parts.join(', ')})` : ''
    })())
    .replace(/\{\{trends\}\}/g, String(vars.trends || ''))
    .replace(/\{\{focus\}\}/g, String(vars.focus || ''))
    .replace(/\{\{concept\}\}/g, String(vars.concept || ''))
    .replace(/\{\{persona\}\}/g, String(vars.persona || ''))
    .replace(/\{\{region\}\}/g, String(vars.region || ''))
    .replace(/\{\{context\}\}/g, String(vars.context || ''))
    .replace(/\{\{narrative\}\}/g, String(vars.narrative || ''))
    .replace(/\{\{enhancementsList\}\}/g, String(vars.enhancementsList || ''))
    .replace(/\{\{enumerated\}\}/g, String(vars.enumerated || ''))
    .replace(/\{\{hook\}\}/g, String(vars.hook || ''))
    .replace(/\{\{origin\}\}/g, String(vars.origin || ''))
    .replace(/\{\{arc\}\}/g, String(vars.arc || ''))
    .replace(/\{\{pivots\}\}/g, String(vars.pivots || ''))
    .replace(/\{\{evidence\}\}/g, String(vars.evidence || ''))
    .replace(/\{\{resolution\}\}/g, String(vars.resolution || ''))
    .replace(/\{\{narrativeScore\}\}/g, String(vars.narrativeScore ?? ''))
    .replace(/\{\{ttpScore\}\}/g, String(vars.ttpScore ?? ''))
    .replace(/\{\{crossScore\}\}/g, String(vars.crossScore ?? ''))
    .replace(/\{\{commercialScore\}\}/g, String(vars.commercialScore ?? ''))
    // remove simple {{#if var}}...{{/if}} blocks when var is falsy
    .replace(/\{\{#if ([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_m, v, inner) => vars[v.trim()] ? inner : '')
}

