export type TrendNode = {
  id: string
  label: string
  kind: 'trend' | 'creator' | 'content'
}

export type TrendGraph = {
  nodes: TrendNode[]
  links: { source: string; target: string }[]
}

export type Creator = {
  id: string
  name: string
  platform: 'TikTok' | 'YouTube' | 'Instagram' | 'Twitch'
  category: string
  resonance: number
  collaboration: number
  tags: string[]
}

export type ProcessedContent = {
  id: string
  name: string
  tags: string[]
  category: string
  type: 'file' | 'url' | 'image' | 'document'
  url?: string
  preview?: string
  summary?: string
}

