import { createContext, useContext, useState, useEffect } from 'react'
import { ProcessedContent } from '../types'
import { logActivity } from '../utils/activity'

type Ctx = {
  processed: ProcessedContent[]
  addFiles: (files: File[]) => Promise<void>
  addUrl: (url: string) => Promise<void>
  removeContent: (id: string) => void
}

const UploadCtx = createContext<Ctx | null>(null)

const INGESTION_URL = ((import.meta as any).env?.VITE_INGESTION_URL as string | undefined) || 'https://ingestion-production-c716.up.railway.app'
const API_BASE = ((import.meta as any).env?.VITE_API_BASE as string | undefined) || 'https://api-production-768d.up.railway.app'
const USER_ID = '087d78e9-4bbe-49f6-8981-1588ce4934a2' // TODO: Get from auth context

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [processed, setProcessed] = useState<ProcessedContent[]>([])

  const addFiles = async (files: File[]) => {
    // Add placeholder items immediately for UI feedback
    const placeholders = files.map((f, i) => createPlaceholder(f, processed.length + i))
    setProcessed((p) => [...placeholders, ...p])
    console.log('[UploadContext] Added', files.length, 'file placeholders')

    try {
      // Get active project ID for context association
      let activeProjectId = localStorage.getItem('activeProjectId')

      // Validate that projectId is a valid UUID (not 'local' string)
      const isValidUUID = activeProjectId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activeProjectId)

      // If no valid project ID, create a default project for this user
      if (!isValidUUID) {
        console.log('[UploadContext] No valid project found, creating default project')
        try {
          const response = await fetch(`${API_BASE}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Default Project', ownerId: USER_ID }),
          })
          if (response.ok) {
            const project = await response.json()
            if (!project.id) {
              throw new Error('Project created but no ID returned')
            }
            activeProjectId = project.id
            localStorage.setItem('activeProjectId', project.id) // Use project.id directly to satisfy TypeScript
            console.log('[UploadContext] Created default project:', activeProjectId)
            try { window.dispatchEvent(new CustomEvent('project-created', { detail: project })) } catch {}
          } else {
            console.error('[UploadContext] Project creation failed:', response.status, response.statusText)
            throw new Error(`Failed to create default project: ${response.status}`)
          }
        } catch (e) {
          console.error('[UploadContext] Failed to create default project:', e)
          // If we can't create a project, we shouldn't upload with projectId=NULL (that's RKB)
          throw new Error('No valid project found. Please create a project first.')
        }
      } else {
        console.log('[UploadContext] Using existing project:', activeProjectId)
      }

      // At this point, activeProjectId must be a valid string
      if (!activeProjectId) {
        throw new Error('No valid project ID available')
      }

      // Upload files to ingestion service
      const formData = new FormData()
      files.forEach(file => formData.append('files', file))
      formData.append('ownerId', USER_ID)
      formData.append('projectId', activeProjectId!) // activeProjectId is now guaranteed to be valid

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
      // Get active project ID for context association
      let activeProjectId = localStorage.getItem('activeProjectId')

      // Validate that projectId is a valid UUID (not 'local' string)
      const isValidUUID = activeProjectId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activeProjectId)

      // If no valid project ID, create a default project for this user
      if (!isValidUUID) {
        try {
          const response = await fetch(`${API_BASE}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Default Project', ownerId: USER_ID }),
          })
          if (response.ok) {
            const project = await response.json()
            if (!project.id) {
              throw new Error('Project created but no ID returned')
            }
            activeProjectId = project.id
            localStorage.setItem('activeProjectId', project.id) // Use project.id directly to satisfy TypeScript
            try { window.dispatchEvent(new CustomEvent('project-created', { detail: project })) } catch {}
          } else {
            throw new Error('Failed to create default project')
          }
        } catch (e) {
          console.error('Failed to create default project:', e)
          throw new Error('No valid project found. Please create a project first.')
        }
      }

      // At this point, activeProjectId must be a valid string
      if (!activeProjectId) {
        throw new Error('No valid project ID available')
      }

      const response = await fetch(`${INGESTION_URL}/ingest/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, ownerId: USER_ID, projectId: activeProjectId }),
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
