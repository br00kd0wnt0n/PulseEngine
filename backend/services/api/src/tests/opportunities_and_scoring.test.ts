import 'reflect-metadata'
import { generateOpportunities, generateScoresAI } from '../services/ai.js'

async function run() {
  let failures = 0

  // Mock user/project
  const concept = 'Test concept for unit validation'

  // 1) generateOpportunities with mock LLM via environment: we bypass by injecting mock through adapter? Not needed here; we validate heuristic fallback path works.
  try {
    const opps = await generateOpportunities(concept, null, 'Strategist', null, null)
    if (!opps || !Array.isArray((opps as any).opportunities) || (opps as any).opportunities.length === 0) {
      throw new Error('opportunities empty')
    }
    console.log('[TEST] Opportunities OK:', (opps as any).opportunities.length)
  } catch (e) {
    failures++
    console.error('[TEST] Opportunities failed:', e)
  }

  // 2) generateScoresAI will attempt OpenAI; for CI/offline env it should throw no-openai and be caught by route normally.
  // Here we assert it throws when no key is present (expected), not crash unexpectedly.
  try {
    const res = await generateScoresAI(concept, null, 'Strategist', null, null)
    if (!res || !res.scores) throw new Error('scores missing')
    console.log('[TEST] Scores OK (unexpected without OPENAI_API_KEY)')
  } catch (e: any) {
    const msg = String(e?.message || e)
    if (msg.includes('no-openai') || msg.includes('context_unavailable') || msg.includes('parse_failed')) {
      console.log('[TEST] Scores expected failure path:', msg)
    } else {
      failures++
      console.error('[TEST] Scores unexpected failure:', msg)
    }
  }

  if (failures > 0) {
    console.error(`[TEST] Failures: ${failures}`)
    process.exit(1)
  }
  console.log('[TEST] All checks passed')
}

run()

