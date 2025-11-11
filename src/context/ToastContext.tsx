import { createContext, useCallback, useContext, useMemo, useState } from 'react'

type Toast = { id: string; message: string; type?: 'success' | 'error' | 'info' };

type ToastCtx = {
  toasts: Toast[]
  show: (message: string, type?: Toast['type']) => void
  dismiss: (id: string) => void
}

const Ctx = createContext<ToastCtx | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800)
  }, [])

  const dismiss = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const value = useMemo(() => ({ toasts, show, dismiss }), [toasts, show, dismiss])

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed right-4 top-16 z-50 space-y-2">
        {toasts.map((t) => (
          <div key={t.id} className={`px-3 py-2 rounded-md text-sm border shadow-md ${
              t.type === 'success' ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-200' :
              t.type === 'error' ? 'bg-red-500/15 border-red-400/30 text-red-200' :
              'bg-white/10 border-white/20 text-white'
            }`}>{t.message}</div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const v = useContext(Ctx)
  if (!v) throw new Error('ToastContext missing')
  return v
}

