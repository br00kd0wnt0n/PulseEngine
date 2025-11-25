import { AppDataSource } from '../db/data-source.js'
import { AICache } from '../db/entities/AICache.js'

export type PromptKey =
  | 'narrative_from_trends'
  | 'debrief'
  | 'refine_debrief'
  | 'opportunities'
  | 'enhancements'
  | 'recommendations'
  | 'concept_overview'
  | 'concept_proposal'
  | 'rewrite_narrative'
  | 'wildcard'
  | 'ralph_lens'

export const promptMeta: Record<PromptKey, { label: string; trigger: string }> = {
  narrative_from_trends: { label: 'Narrative from Trends', trigger: '/ai/narrative (TrendGraph mode)' },
  debrief: { label: 'Debrief (Strategic Brief)', trigger: '/ai/debrief' },
  opportunities: { label: 'Opportunities (Ranked)', trigger: '/ai/opportunities' },
  refine_debrief: { label: 'Refine Debrief', trigger: '/ai/refine-debrief' },
  enhancements: { label: 'Enhancements (Targeted)', trigger: '/ai/enhancements' },
  recommendations: { label: 'Recommendations (Framework)', trigger: '/ai/recommendations' },
  concept_overview: { label: 'Concept Overview', trigger: '/ai/concept-overview' },
  concept_proposal: { label: 'Concept Proposal', trigger: '/ai/concept-proposal' },
  rewrite_narrative: { label: 'Rewrite Narrative (Apply Enhancements)', trigger: '/ai/rewrite-narrative' },
  wildcard: { label: 'Wildcard Insight', trigger: '/ai/wildcard' },
  ralph_lens: { label: 'Ralph Philosophy & Lens', trigger: 'Injected into prompts' },
}

// Default templates with {{variables}}
export const defaultTemplates: Record<PromptKey, string> = {
  narrative_from_trends:
    `Given these active trends: {{trends}}{{#if focus}}\nFocus on: {{focus}}{{/if}}.\nExplain the narrative opportunity in 4-6 sentences: why now, which hooks, and predicted time-to-peak. Keep it direct.`,

  debrief:
    `You are a {{personaRole}} creating a strategic brief.
{{#if targetAudience}}Target audience: {{targetAudience}}. Tailor all insights to this audience.{{/if}}

CAMPAIGN CONCEPT: "{{concept}}"

{{#if context}}# RELEVANT CONTEXT (cite these specific trends and insights):
{{context}}

{{/if}}# YOUR TASK:
Apply the Ralph Storytelling Philosophy and Lens:
{{ralphLens}}

Create a strategic campaign brief as JSON with these fields:

1. "brief" (2-3 sentences): Explain WHY this concept is strategically valuable right now. Reference specific trending content, platforms, or cultural moments from the context above. Be concrete and actionable.

2. "summary" (1 sentence): The core campaign insight or hook that makes this timely and engaging.

3. "keyPoints" (4 strategic bullets, each ≤ 12 words): Actionable campaign strategy points. Each should be specific to THIS concept and reference the context when possible.

4. "didYouKnow" (3 contextual insights, each ≤ 12 words): Surprising facts or trend insights from the context that support this campaign.

Return ONLY valid JSON with keys: brief, summary, keyPoints, didYouKnow, personaNotes.

Persona-specific guidance:
- If user role contains 'Strategist', personaNotes should include 2 bullets on KPIs, pacing, and measurement.
- If role contains 'Creative', personaNotes should include 2 bullets on story beats, tone, visual system.
- If role contains 'Creator', personaNotes should include 2 bullets on formats, scripts, captioning, posting cadence.`,

  opportunities:
    `You are a {{personaRole}}. Analyze this campaign concept: "{{concept}}"
{{#if targetAudience}}Target audience: {{targetAudience}}. Prioritize opportunities that reach and resonate with them.{{/if}}

{{#if context}}# RELEVANT CONTEXT (reference specific trends and data):
{{context}}

{{/if}}# YOUR TASK:
Apply the Ralph Storytelling Philosophy and Lens:
{{ralphLens}}

Identify 5 HIGH-IMPACT campaign opportunities that are specific to this concept, grounded in the context, and actionable (story beats, formats, creator plays).

Return ONLY JSON: { "opportunities": [{ "title": string, "why": string, "impact": number }], "rationale": string, "personaNotes": string[] }
personaNotes: 2 bullets tailored to {{personaRole}} explaining which opportunities to prioritize and why.`,

  refine_debrief:
    `You are a {{personaRole}}. Refine the existing strategic debrief below based on the user's instruction.
{{#if targetAudience}}Target audience: {{targetAudience}}. Reflect nuances for this audience.{{/if}}

CONCEPT: "{{concept}}"

CURRENT DEBRIEF:
- brief: {{brief}}
- summary: {{summary}}
- keyPoints: {{keyPoints}}
- didYouKnow: {{didYouKnow}}

USER INSTRUCTION:
"""
{{message}}
"""

{{#if context}}# CONTEXT (selected):
{{context}}
{{/if}}

Return ONLY JSON with keys: brief, summary, keyPoints, didYouKnow, personaNotes. Keep changes tight and specific.`,

  enhancements:
    `You are a {{personaRole}} optimizing this concept: "{{concept}}"

Current campaign scores (0-100):
- Narrative Strength: {{narrativeScore}}
- Time to Peak: {{ttpScore}}
- Cross-Platform Potential: {{crossScore}}
- Commercial Viability: {{commercialScore}}

# YOUR TASK:
Propose 4 SPECIFIC, ACTIONABLE enhancements to strengthen this campaign. Each enhancement should target a narrative block (origin|hook|arc|pivots|evidence|resolution) and provide concrete execution.

Return ONLY JSON: { "suggestions": [{ "text": string, "target": string, "deltas": { "narrative": number, "ttp": number, "cross": number, "commercial": number } }] }`,

  recommendations:
    `You are a {{personaRole}}. You're creating an execution plan for: "{{concept}}"
{{#if targetAudience}}Target audience: {{targetAudience}}. Optimize formats, platforms, and hooks for this audience.{{/if}}

{{#if context}}# CONTEXT (for grounding):
{{context}}

{{/if}}# YOUR TASK:
Apply the Ralph Storytelling Philosophy and Lens:
{{ralphLens}}

Provide arrays for: narrative, content, platform, collab (execution bullets) and a framework object { market, narrative, commercial } with { score, why }.

Return ONLY JSON with keys exactly: narrative, content, platform, collab, framework, personaNotes.
personaNotes: 2 bullets of guidance specific to {{personaRole}}.`,

  concept_overview:
    `You are a {{personaRole}} crafting a single, shareable CONCEPT OVERVIEW for: "{{concept}}"
{{#if targetAudience}}Target audience: {{targetAudience}}. Optimize tone and examples accordingly.{{/if}}
{{#if region}}Region: {{region}}.{{/if}}

# Inputs to synthesize (do not repeat verbatim):
{{#if debrief}}Debrief (summary): {{debrief}}
{{/if}}{{#if narrative}}Narrative (key beats): {{narrative}}
{{/if}}{{#if opportunitiesList}}Opportunities (top):
{{opportunitiesList}}
{{/if}}{{#if enhancementsList}}Enhancements (applied/considered):
{{enhancementsList}}
{{/if}}

# Ralph Philosophy & Lens (weigh ideas against this):
{{ralphLens}}

# OUTPUT — Markdown only, structured with these sections:
### Campaign Essence
- 2–3 sentences that stitch the concept, strongest opportunity and narrative "why-now" into a single POV tailored to {{personaOrGeneral}}.

### Core Story & Pillars
- 3–5 bullets. Each bullet = a pillar with a short descriptor and an example beat. Tie at least two bullets to items from Opportunities/Enhancements.

### Platform & Format Plan
- 3–5 bullets, each names a platform + primary format + timing (e.g., TikTok — 30–45s hook + stitch, weekly mini-arcs).

### Creator/Partner Angle
- 2–4 bullets on collaboration types and selection criteria (not specific names), grounded in the concept’s culture.

### Next Steps to Finalize Concept (not production)
- 5–7 checklist items (start each with "- [ ] ") focused on concept development: sharpen logline, define POV + tone, lock 3 pillars + sample segments, draft 1-page treatment, align brand fit & guardrails, define success criteria & learning loop, identify proof-of-concept pilot.

### Risks & Mitigations
- 3 bullets: one creative risk, one audience/fit risk, one operational risk — each with a mitigation.

Keep it specific, non-generic, and avoid repeating the inputs. Use compact, scannable bullets.`,

  concept_proposal:
    `You are a {{personaRole}} crafting a shareable campaign proposal.
{{#if targetAudience}}Target audience: {{targetAudience}}. Ensure the pitch resonates with them.{{/if}}

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

{{/if}}Apply the Ralph Storytelling Philosophy and Lens:
{{ralphLens}}

Write a compelling, specific, narrative-driven proposal that can be shared with partners. Keep it crisp and persuasive.

Return ONLY JSON: { "narrative": string, "personaNotes": string[] }`,

  rewrite_narrative:
    `You are a {{personaRole}}. Rewrite the narrative below for the concept "{{concept}}"{{personaRegion}}, integrating these selected enhancements. Keep the same structure (numbered sections) and make it crisp, specific, and actionable.

# Current Narrative
{{narrative}}

# Selected Enhancements
{{enhancementsList}}

Return ONLY the rewritten narrative, preserving numbered section headings.`,

  wildcard:
    `You are a contrarian {{personaRole}}. Generate 1–2 WILDCARD insights that defy default assumptions AND are testable this week.
Concept: "{{concept}}"{{personaRegion}}

Grounding context (each item has an id). Cite ONLY using these ids:
{{enumerated}}

Strict rules:
- No generic advice; do not restate any existing narrative or debrief.
- Each idea must clearly challenge common platform tactics or biases and include at least one trade‑off.
- Each idea MUST include exactly 3 evidence citations using id format like "ctx3" that map to the provided context.
- Be specific, quantified where possible.

Apply the Ralph Storytelling Philosophy and Lens:
{{ralphLens}}

Output ONLY strict JSON with this schema and keys, no prose:
{ "ideas": [ { "title": string, "contrarianWhy": string[], "evidence": string[], "upside": string, "risks": string[], "testPlan": string[], "firstStep": string } ] }`,

  ralph_lens:
    `Core Values:
- Make entertainment that brings people together
- Celebrate things that make life feel good
- Bring back joy, not feed despair
- Create experiences driven by happiness, not addiction
- Foster cultural connection, not division
- Encourage authentic enjoyment without judgment

Creative Principles:
- Believe in backing bold, creative ideas
- Take creative risks, don't just feed algorithms
- Celebrate niches and what people genuinely love
- Invest in creativity across multiple domains:
  * Comedy
  * Food & drink
  * TV & film
  * Music
  * Gaming
  * Beyond traditional categories

When relevant - consider a transmedia Approach:
- Create content across:
  * Live events
  * Digital platforms
  * Print media
  * AV streams
  * Radio
  * Magazines

Fundamental Ethos:
"If it's new, different, or makes you smile - we're into it."

Recommendation Weighting:
- Prioritize ideas that:
  * Foster human connection
  * Generate genuine happiness
  * Challenge conventional thinking
  * Celebrate creativity and diversity`,
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
  const persona = vars.persona ? String(vars.persona) : ''
  const personaRole = persona ? `campaign strategist for ${persona}` : 'campaign strategist'
  const pl = (persona || '').toLowerCase()
  let personaTone = 'insight-first, specific, execution-ready'
  if (/cmo|executive|vp|brand|marketing/.test(pl)) personaTone = 'board-ready, ROI-oriented, concise'
  else if (/creator|influencer|ugc/.test(pl)) personaTone = 'creator-first, social-native, practical'
  else if (/gen\s*z|teen|youth/.test(pl)) personaTone = 'punchy, culturally current, minimal jargon'
  else if (/gaming|gamer|esports/.test(pl)) personaTone = 'platform-savvy, gaming vernacular, concise'

  return tpl
    .replace(/\{\{personaOrGeneral\}\}/g, vars.persona ? String(vars.persona) : 'General')
    .replace(/\{\{personaRegion\}\}/g, (() => {
      const parts = [] as string[]
      if (vars.persona) parts.push(`persona: ${vars.persona}`)
      if (vars.region) parts.push(`region: ${vars.region}`)
      return parts.length ? ` (${parts.join(', ')})` : ''
    })())
    .replace(/\{\{personaRole\}\}/g, personaRole)
    .replace(/\{\{personaTone\}\}/g, personaTone)
    .replace(/\{\{trends\}\}/g, String(vars.trends || ''))
    .replace(/\{\{focus\}\}/g, String(vars.focus || ''))
    .replace(/\{\{concept\}\}/g, String(vars.concept || ''))
    .replace(/\{\{persona\}\}/g, String(vars.persona || ''))
    .replace(/\{\{region\}\}/g, String(vars.region || ''))
    .replace(/\{\{context\}\}/g, String(vars.context || ''))
    .replace(/\{\{targetAudience\}\}/g, String(vars.targetAudience || ''))
    .replace(/\{\{narrative\}\}/g, String(vars.narrative || ''))
    .replace(/\{\{enhancementsList\}\}/g, String(vars.enhancementsList || ''))
    .replace(/\{\{enumerated\}\}/g, String(vars.enumerated || ''))
    .replace(/\{\{hook\}\}/g, String(vars.hook || ''))
    .replace(/\{\{origin\}\}/g, String(vars.origin || ''))
    .replace(/\{\{arc\}\}/g, String(vars.arc || ''))
    .replace(/\{\{pivots\}\}/g, String(vars.pivots || ''))
    .replace(/\{\{evidence\}\}/g, String(vars.evidence || ''))
    .replace(/\{\{resolution\}\}/g, String(vars.resolution || ''))
    .replace(/\{\{ralphLens\}\}/g, String(vars.ralphLens || ''))
    .replace(/\{\{narrativeScore\}\}/g, String(vars.narrativeScore ?? ''))
    .replace(/\{\{ttpScore\}\}/g, String(vars.ttpScore ?? ''))
    .replace(/\{\{crossScore\}\}/g, String(vars.crossScore ?? ''))
    .replace(/\{\{commercialScore\}\}/g, String(vars.commercialScore ?? ''))
    // remove simple {{#if var}}...{{/if}} blocks when var is falsy
    .replace(/\{\{#if ([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_m, v, inner) => vars[v.trim()] ? inner : '')
}
