import { useEffect, useState } from 'react'
import { api } from '../services/api'

type PromptItem = { key: string; content: string; meta: { label: string; trigger: string } }

export default function Prompts() {
  const [items, setItems] = useState<PromptItem[]>([])
  const [dirty, setDirty] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const list = await api.listPrompts()
        if (!cancel) setItems(list)
      } catch (e: any) {
        if (!cancel) setError('Failed to load prompts')
      }
    })()
    return () => { cancel = true }
  }, [])

  const onSave = async (key: string) => {
    try {
      setSaving(s => ({ ...s, [key]: true }))
      const content = dirty[key]
      if (typeof content === 'string') {
        await api.savePrompt(key, content)
        // refresh the list item
        setItems(prev => prev.map(it => it.key === key ? { ...it, content } : it))
        const { [key]: _, ...rest } = dirty
        setDirty(rest)
      }
    } catch (e: any) {
      setError('Save failed')
    } finally {
      setSaving(s => ({ ...s, [key]: false }))
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="text-lg font-semibold">Prompt Templates</div>
      <div className="text-white/60 text-sm">View and edit the dynamic prompt templates used by backend AI routes. Changes take effect immediately without redeploy.</div>
      {error && <div className="text-red-400 text-sm">{error}</div>}
      <div className="grid md:grid-cols-2 gap-4">
        {items.map((it) => {
          const current = dirty[it.key] ?? it.content
          const isDirty = dirty[it.key] !== undefined && dirty[it.key] !== it.content
          return (
            <div key={it.key} className="panel p-3 bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <div className="text-white/90 text-sm font-medium">{it.meta?.label || it.key}</div>
                  <div className="text-white/50 text-[10px]">Trigger: {it.meta?.trigger || '-'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={!isDirty || !!saving[it.key]}
                    onClick={() => onSave(it.key)}
                    className={`text-[11px] px-2 py-1 rounded border ${isDirty ? 'border-ralph-cyan/40 bg-ralph-cyan/20 hover:bg-ralph-cyan/30' : 'border-white/10 bg-white/5 opacity-60'}`}
                  >{saving[it.key] ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
              <div className="text-white/50 text-[10px] mb-1">Use placeholders like: {'{{concept}}'}, {'{{persona}}'}, {'{{region}}'}, {'{{context}}'}. Changes persist immediately.</div>
              <textarea
                className="w-full h-56 text-xs bg-charcoal-900 border border-white/10 rounded p-2 font-mono"
                value={current}
                onChange={(e) => setDirty(d => ({ ...d, [it.key]: e.target.value }))}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

