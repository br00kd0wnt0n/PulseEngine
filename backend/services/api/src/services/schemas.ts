import { z } from 'zod'

export const OpportunitySchema = z.object({
  title: z.string().min(3),
  why: z.string().min(3),
  impact: z.number().min(0).max(100),
})

export const OpportunitiesResultSchema = z.object({
  opportunities: z.array(OpportunitySchema).min(1),
  rationale: z.string().optional().default(''),
  personaNotes: z.array(z.string()).optional().default([]),
})
export type OpportunitiesResult = z.infer<typeof OpportunitiesResultSchema>

export const ScoresSchema = z.object({
  scores: z.object({
    narrativeStrength: z.number().min(0).max(100),
    timeToPeakWeeks: z.number().min(1).max(12),
    collaborationOpportunity: z.number().min(0).max(100),
  }),
  ralph: z.object({
    narrativeAdaptability: z.number().min(0).max(100),
    crossPlatformPotential: z.number().min(0).max(100),
    culturalRelevance: z.number().min(0).max(100),
  }),
  rationales: z.object({
    narrative: z.array(z.string()).optional().default([]),
    timing: z.array(z.string()).optional().default([]),
    cross: z.array(z.string()).optional().default([]),
    commercial: z.array(z.string()).optional().default([]),
  }).default({ narrative: [], timing: [], cross: [], commercial: [] }),
  evidence: z.array(z.string()).optional().default([]),
})
export type ScoresResult = z.infer<typeof ScoresSchema>

export const DebriefSchema = z.object({
  brief: z.string().optional().default(''),
  summary: z.string().optional().default(''),
  keyPoints: z.array(z.string()).optional().default([]),
  didYouKnow: z.array(z.string()).optional().default([]),
  personaNotes: z.preprocess(
    (val) => {
      // Handle AI returning different types instead of array
      if (!val) return []
      if (Array.isArray(val)) return val
      if (typeof val === 'string') {
        // If it's a string, try to split by newlines or return as single item
        const lines = val.split('\n').map(s => s.trim()).filter(Boolean)
        return lines.length > 0 ? lines : [val]
      }
      if (typeof val === 'object') {
        // If it's an object, extract string values
        return Object.values(val).filter(v => typeof v === 'string')
      }
      return []
    },
    z.array(z.string()).optional().default([])
  ),
})
export type DebriefResult = z.infer<typeof DebriefSchema>

export const RecommendationsSchema = z.object({
  narrative: z.array(z.string()).min(1),
  content: z.array(z.string()).min(1),
  platform: z.array(z.string()).min(1),
  collab: z.array(z.string()).min(1),
  framework: z.object({
    market: z.object({ score: z.number().min(0).max(100), why: z.string() }),
    narrative: z.object({ score: z.number().min(0).max(100), why: z.string() }),
    commercial: z.object({ score: z.number().min(0).max(100), why: z.string() }),
  }),
  personaNotes: z.array(z.string()).optional().default([]),
})
export type RecommendationsResult = z.infer<typeof RecommendationsSchema>

export const EnhancementsSchema = z.object({
  suggestions: z.array(z.object({
    text: z.string().min(3),
    target: z.string().min(2),
    deltas: z.object({
      narrative: z.number().optional().default(0),
      ttp: z.number().optional().default(0),
      cross: z.number().optional().default(0),
      commercial: z.number().optional().default(0),
    }).default({ narrative: 0, ttp: 0, cross: 0, commercial: 0 })
  })).min(1)
})
export type EnhancementsResult = z.infer<typeof EnhancementsSchema>

export const ConceptProposalSchema = z.object({
  narrative: z.string().min(10),
  personaNotes: z.array(z.string()).optional().default([])
})
export type ConceptProposalResult = z.infer<typeof ConceptProposalSchema>

export const ModelRolloutSchema = z.object({
  months: z.array(z.object({ m: z.number().min(0).max(11), followers: z.number().min(0) })).length(12),
  moments: z.array(z.object({
    m: z.number().min(0).max(11),
    label: z.string(),
    desc: z.string().optional().default(''),
    kind: z.string().optional(),
    color: z.string().optional(),
  })).optional().default([]),
  phases: z.array(z.object({
    startM: z.number().min(0).max(11),
    endM: z.number().min(0).max(11),
    label: z.string(),
    summary: z.string().optional().default(''),
    kind: z.string().optional(),
    color: z.string().optional(),
  })).optional().default([]),
  notes: z.array(z.string()).optional().default([]),
})
export type ModelRolloutResult = z.infer<typeof ModelRolloutSchema>
