import { useState } from 'react'

type Message = {
  id: number
  text: string
  type: 'info' | 'user'
}

export default function FloatingAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Welcome! I'm here to guide you through the campaign workflow. Start by entering your story brief above.",
      type: 'info'
    }
  ])
  const [inputValue, setInputValue] = useState('')

  const handleSend = () => {
    if (!inputValue.trim()) return

    // Add user message
    setMessages(prev => [...prev, {
      id: Date.now(),
      text: inputValue,
      type: 'user'
    }])

    setInputValue('')
  }

  const dismissMessage = (id: number) => {
    setMessages(prev => prev.filter(msg => msg.id !== id))
  }

  return (
    <>
      {/* Floating notification pills on right side */}
      <div className="fixed right-4 top-24 z-50 w-80 max-h-[calc(100vh-200px)] overflow-y-auto space-y-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`group relative p-3 rounded-lg backdrop-blur-md border text-sm shadow-lg transition-all ${
              msg.type === 'user'
                ? 'bg-ralph-cyan/20 border-ralph-cyan/40 ml-8'
                : 'bg-charcoal-800/90 border-white/10'
            }`}
          >
            {/* Dismiss button - shows on hover */}
            <button
              onClick={() => dismissMessage(msg.id)}
              className="absolute top-2 right-2 w-5 h-5 rounded-full bg-charcoal-700/80 hover:bg-charcoal-600 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              title="Dismiss"
            >
              <span className="text-white/60 text-xs leading-none">✕</span>
            </button>

            {msg.type === 'info' && (
              <div className="text-white/60 text-[10px] mb-1 uppercase tracking-wide">RalphBot</div>
            )}
            <div className="text-white/90 leading-relaxed pr-6">{msg.text}</div>
          </div>
        ))}
      </div>

      {/* Persistent input at bottom center */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
        <div className="flex gap-2 p-3 rounded-lg backdrop-blur-lg bg-charcoal-900/80 border border-white/10 shadow-2xl">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask anything..."
            className="flex-1 bg-charcoal-800/70 border border-white/10 rounded px-3 py-2 text-sm outline-none focus:border-ralph-cyan/40 transition-colors"
          />
          <button
            onClick={handleSend}
            className="px-4 py-2 rounded bg-ralph-cyan/70 hover:bg-ralph-cyan text-sm font-medium transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </>
  )
}
