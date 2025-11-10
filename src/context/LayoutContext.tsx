import { createContext, useContext, useState } from 'react'

type Ctx = {
  sidebarOpen: boolean
  openSidebar: () => void
  closeSidebar: () => void
  toggleSidebar: () => void
}

const LayoutCtx = createContext<Ctx | null>(null)

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setOpen] = useState(false)
  const value: Ctx = {
    sidebarOpen,
    openSidebar: () => setOpen(true),
    closeSidebar: () => setOpen(false),
    toggleSidebar: () => setOpen((v) => !v),
  }
  return <LayoutCtx.Provider value={value}>{children}</LayoutCtx.Provider>
}

export function useLayout() {
  const v = useContext(LayoutCtx)
  if (!v) throw new Error('LayoutContext missing')
  return v
}

