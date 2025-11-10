import { useState } from 'react'
import { useTrends } from '../../context/TrendContext'
import { generateNarrative } from '../../services/ai'

export default function NarrativePanel() {
  const { selected, snapshot } = useTrends()
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')

  const onGenerate = async () => {
    setLoading(true)
    const res = await generateNarrative(snapshot(), selected?.id || null)
    setText(res)
    setLoading(false)
  }

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">Narrative Generation</div>
        <button
          onClick={onGenerate}
          className="px-3 py-2 rounded-md text-sm border border-white/5 bg-ralph-purple/20 hover:bg-ralph-purple/30"
          disabled={loading}
        >{loading ? 'Generating...' : 'Generate'}</button>
      </div>
      <div className="text-xs text-white/60 mb-2">Narrative-first interpretation of current trend map.</div>
      <div className="min-h-[120px] whitespace-pre-wrap text-sm leading-relaxed">{text || 'No narrative yet. Click Generate to create insights.'}</div>
    </div>
  )
}

