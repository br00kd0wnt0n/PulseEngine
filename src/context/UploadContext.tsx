import { createContext, useContext, useState } from 'react'
import { api } from '../services/api'
import { ProcessedContent } from '../types'
import { logActivity } from '../utils/activity'
import { useAuth } from './AuthContext'

type Ctx = {
  processed: ProcessedContent[]
  addFiles: (files: File[]) => Promise<void>
  addUrl: (url: string) => Promise<void>
  removeContent: (id: string) => void
}

const UploadCtx = createContext<Ctx | null>(null)

const INGESTION_URL = ((import.meta as any).env?.VITE_INGESTION_URL as string | undefined) || 'https://ingestion-production-c716.up.railway.app'
const FALLBACK_USER_ID = '087d78e9-4bbe-49f6-8981-1588ce4934a2'

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const USER_ID = user?.id || FALLBACK_USER_ID
  const [processed, setProcessed] = useState<ProcessedContent[]>([])

  const addFiles = async (files: File[]) => {
    // Add placeholder items immediately for UI feedback
    const placeholders = files.map((f, i) => createPlaceholder(f, processed.length + i))
    setProcessed((p) => [...placeholders, ...p])
    console.log('[UploadContext] Added', files.length, 'file placeholders')

    try {
      // Ensure a server project exists before uploading so assets associate correctly
      let activeProjectId = localStorage.getItem('activeProjectId')
      let isValidUUID = activeProjectId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activeProjectId)
      if (!isValidUUID) {
        try {
          const concept = (typeof localStorage !== 'undefined' && localStorage.getItem('concept')) || 'Untitled Project'
          const created = await api.createPublicProject({ concept: concept || 'Untitled Project', graph: { nodes: [], links: [] }, focusId: null })
          if (created && created.id && typeof created.id === 'string') {
            activeProjectId = created.id
            try { localStorage.setItem('activeProjectId', created.id) } catch {}
            console.log('[UploadContext] Created project for uploads:', created.id)
          }
        } catch (e) {
          console.warn('[UploadContext] Could not create server project before upload; continuing without association')
        }
        isValidUUID = !!(activeProjectId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activeProjectId))
      } else {
        console.log('[UploadContext] Using existing project:', activeProjectId)
      }

      // Upload files to ingestion service
      const formData = new FormData()
      files.forEach(file => formData.append('files', file))
      formData.append('ownerId', USER_ID)
      formData.append('scope', 'project') // explicit: treat as project-scoped context, not RKB
      // Only add projectId if we have a valid one
      if (activeProjectId) {
        formData.append('projectId', activeProjectId)
      }

      const response = await fetch(`${INGESTION_URL}/ingest/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      const assets = await response.json()

      // Replace placeholders with real processed items
      const processedItems = assets.map((asset: any, i: number) => ({
        id: asset.id,
        name: asset.name,
        tags: Object.values(asset.tags?.list || asset.tags || {}).filter(Boolean) as string[],
        category: inferCategory(asset),
        type: inferType(asset),
        summary: generateSummary(asset),
      }))

      setProcessed((p) => {
        // Remove placeholders and add real items
        const withoutPlaceholders = p.filter(item => !placeholders.find(ph => ph.id === item.id))
        return [...processedItems, ...withoutPlaceholders]
      })

      try { window.dispatchEvent(new CustomEvent('context-updated')) } catch {}
      try { logActivity(`${files.length} file(s) uploaded and processed successfully`) } catch {}
    } catch (error) {
      console.error('Upload failed:', error)
      // Remove failed placeholders
      setProcessed((p) => p.filter(item => !placeholders.find(ph => ph.id === item.id)))
      try { logActivity(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`) } catch {}
      throw error
    }
  }

  const addUrl = async (url: string) => {
    const placeholder = createUrlPlaceholder(url, processed.length)
    setProcessed((p) => [placeholder, ...p])

    try {
      // Ensure a server project exists before URL ingestion
      let activeProjectId = localStorage.getItem('activeProjectId')
      let isValidUUID = activeProjectId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activeProjectId)
      if (!isValidUUID) {
        try {
          const concept = (typeof localStorage !== 'undefined' && localStorage.getItem('concept')) || 'Untitled Project'
          const created = await api.createPublicProject({ concept: concept || 'Untitled Project', graph: { nodes: [], links: [] }, focusId: null })
          if (created && created.id && typeof created.id === 'string') {
            activeProjectId = created.id
            try { localStorage.setItem('activeProjectId', created.id) } catch {}
            console.log('[UploadContext] Created project for URL ingestion:', created.id)
          }
        } catch (e) {
          console.warn('[UploadContext] Could not create server project before URL ingestion; continuing without association')
        }
        isValidUUID = !!(activeProjectId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activeProjectId))
      } else {
        console.log('[UploadContext] Using existing project:', activeProjectId)
      }

      const response = await fetch(`${INGESTION_URL}/ingest/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          ownerId: USER_ID,
          scope: 'project',
          ...(activeProjectId && isValidUUID ? { projectId: activeProjectId } : {})
        }),
      })

      if (!response.ok) {
        throw new Error(`URL ingestion failed: ${response.statusText}`)
      }

      const asset = await response.json()

      const processedItem: ProcessedContent = {
        id: asset.id,
        name: asset.name,
        tags: Object.values(asset.tags || {}).filter(Boolean) as string[],
        category: inferCategory(asset),
        type: 'url',
        url: asset.url,
        summary: `Ingested from ${new URL(url).hostname}`,
      }

      setProcessed((p) => p.map(item => item.id === placeholder.id ? processedItem : item))

      try { window.dispatchEvent(new CustomEvent('context-updated')) } catch {}
      try { logActivity('URL ingested successfully') } catch {}
    } catch (error) {
      console.error('URL ingestion failed:', error)
      setProcessed((p) => p.filter(item => item.id !== placeholder.id))
      try { logActivity(`URL ingestion failed: ${error instanceof Error ? error.message : 'Unknown error'}`) } catch {}
      throw error
    }
  }

  const removeContent = (id: string) => {
    setProcessed((p) => p.filter((c) => c.id !== id))
    try { window.dispatchEvent(new CustomEvent('context-updated')) } catch {}
    try { logActivity('Context item removed; context updated') } catch {}
  }

  return <UploadCtx.Provider value={{ processed, addFiles, addUrl, removeContent }}>{children}</UploadCtx.Provider>
}

export const useUpload = () => {
  const v = useContext(UploadCtx)
  if (!v) throw new Error('UploadContext missing')
  return v
}

// Helper functions
function createPlaceholder(file: File, idx: number): ProcessedContent {
  const name = file.name
  const ext = name.split('.').pop()?.toLowerCase() || 'dat'
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']
  const docExts = ['pdf', 'doc', 'docx', 'txt', 'md']

  let type: ProcessedContent['type'] = 'file'
  if (imageExts.includes(ext)) type = 'image'
  else if (docExts.includes(ext)) type = 'document'

  const preview = type === 'image' ? URL.createObjectURL(file) : undefined

  return {
    id: `placeholder-${idx}-${Date.now()}`,
    name,
    tags: ['uploading'],
    category: 'Processing',
    type,
    preview,
    summary: `Uploading ${name}...`
  }
}

function createUrlPlaceholder(url: string, idx: number): ProcessedContent {
  const urlObj = new URL(url)
  const domain = urlObj.hostname.replace('www.', '')

  return {
    id: `url-placeholder-${idx}-${Date.now()}`,
    name: url.length > 50 ? url.substring(0, 47) + '...' : url,
    tags: ['processing'],
    category: 'Ingesting',
    type: 'url',
    url,
    summary: `Fetching content from ${domain}...`
  }
}

function inferType(asset: any): ProcessedContent['type'] {
  const mime = asset.metadata?.mime || asset.tags?.type || ''
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('application/pdf') || mime.startsWith('text/')) return 'document'
  return 'file'
}

function inferCategory(asset: any): string {
  const tags = Object.values(asset.tags || {}).join(' ').toLowerCase()
  if (tags.includes('dance')) return 'Dance'
  if (tags.includes('ai') || tags.includes('music')) return 'AI/Music'
  if (tags.includes('gaming')) return 'Gaming'
  if (tags.includes('fashion')) return 'Fashion'
  return 'General'
}

function generateSummary(asset: any): string {
  const insights = asset.metadata?.insights
  if (insights?.keyPhrases && insights.keyPhrases.length > 0) {
    return `Key themes: ${insights.keyPhrases.slice(0, 3).join(', ')}`
  }
  const text = asset.metadata?.text
  if (text) {
    return text.slice(0, 100) + (text.length > 100 ? '...' : '')
  }
  return `Processed ${asset.name}`
}
