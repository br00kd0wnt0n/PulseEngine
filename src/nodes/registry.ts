export type NodeKey =
  | 'debrief'
  | 'opportunities'
  | 'narrative'
  | 'scoring'
  | 'enhancements'
  | 'concept-overview'
  | 'model-rollout'
  | 'export-pdf'
  | 'course-correct'

export type NodeSpec = {
  key: NodeKey
  title: string
  unique?: boolean
  requires: string[]
  provides: string[]
  multi?: boolean
}

export const NODE_REGISTRY: NodeSpec[] = [
  { key: 'debrief', title: 'Debrief', unique: true, requires: ['concept'], provides: ['debrief'] },
  { key: 'opportunities', title: 'Opportunities', unique: true, requires: ['debrief'], provides: ['opportunities'] },
  { key: 'narrative', title: 'Narrative Structure', unique: true, requires: ['debrief'], provides: ['narrative'] },
  { key: 'scoring', title: 'Scoring', unique: true, requires: ['debrief'], provides: ['scores'] },
  { key: 'enhancements', title: 'Enhancements', unique: true, requires: ['debrief'], provides: ['enhancements'] },
  { key: 'concept-overview', title: 'Concept Overview', unique: true, requires: ['debrief'], provides: ['overview'] },
  { key: 'model-rollout', title: 'Model Rollout', unique: true, requires: ['overview'], provides: ['rollout'] },
  { key: 'export-pdf', title: 'Export to PDF', unique: false, requires: ['overview'], provides: [] },
  { key: 'course-correct', title: 'Course Correct', multi: true, requires: ['any'], provides: ['mutations'] },
]

export function filterAvailable(present: Set<string>, existingKeys: Set<string>): { key: NodeKey; title: string }[] {
  return NODE_REGISTRY
    .filter(spec => {
      if (spec.unique && existingKeys.has(spec.key)) return false
      // "any" means allowed if any present
      const reqs = spec.requires
      if (reqs.includes('any')) return true
      return reqs.every(r => present.has(r))
    })
    .map(s => ({ key: s.key, title: s.title }))
}

