import { createContext, useContext, useState } from 'react'
import { ProcessedContent } from '../types'

type Ctx = {
  processed: ProcessedContent[]
  addFiles: (files: File[]) => void
  addUrl: (url: string) => void
  removeContent: (id: string) => void
}

const UploadCtx = createContext<Ctx | null>(null)

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [processed, setProcessed] = useState<ProcessedContent[]>([])

  const addFiles = (files: File[]) => {
    const items = files.map((f, i) => mockProcess(f, processed.length + i))
    setProcessed((p) => [...items, ...p])
    try { window.dispatchEvent(new CustomEvent('context-updated')) } catch {}
  }

  const addUrl = (url: string) => {
    const item = mockProcessUrl(url, processed.length)
    setProcessed((p) => [item, ...p])
    try { window.dispatchEvent(new CustomEvent('context-updated')) } catch {}
  }

  const removeContent = (id: string) => {
    setProcessed((p) => p.filter((c) => c.id !== id))
    try { window.dispatchEvent(new CustomEvent('context-updated')) } catch {}
  }

  return <UploadCtx.Provider value={{ processed, addFiles, addUrl, removeContent }}>{children}</UploadCtx.Provider>
}

export const useUpload = () => {
  const v = useContext(UploadCtx)
  if (!v) throw new Error('UploadContext missing')
  return v
}

function mockProcess(file: File, idx: number): ProcessedContent {
  const name = file.name
  const ext = name.split('.').pop()?.toLowerCase() || 'dat'
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']
  const docExts = ['pdf', 'doc', 'docx', 'txt', 'md']

  let type: ProcessedContent['type'] = 'file'
  if (imageExts.includes(ext)) type = 'image'
  else if (docExts.includes(ext)) type = 'document'

  const tags = [
    ext,
    name.toLowerCase().includes('ai') ? 'ai' : 'content',
    name.toLowerCase().includes('dance') ? 'dance' : 'general',
  ]
  const cats = ['Short-form', 'Long-form', 'Social', 'Editorial']
  const category = cats[(name.length + idx) % cats.length]

  // Mock preview for images
  const preview = type === 'image' ? URL.createObjectURL(file) : undefined

  return {
    id: `p${idx}-${Date.now()}`,
    name,
    tags,
    category,
    type,
    preview,
    summary: `Analyzing ${name}...`
  }
}

function mockProcessUrl(url: string, idx: number): ProcessedContent {
  const urlObj = new URL(url)
  const domain = urlObj.hostname.replace('www.', '')
  const name = domain + urlObj.pathname

  const tags = ['web', 'url', domain]
  const cats = ['Article', 'Social Post', 'Video', 'Reference']
  const category = cats[idx % cats.length]

  return {
    id: `url${idx}-${Date.now()}`,
    name: url.length > 50 ? url.substring(0, 47) + '...' : url,
    tags,
    category,
    type: 'url',
    url,
    summary: `Fetching content from ${domain}...`
  }
}
