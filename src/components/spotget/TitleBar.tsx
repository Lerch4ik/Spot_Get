'use client'

import { useEffect, useState } from 'react'
import { Minus, Square, X, Maximize2 } from 'lucide-react'

export function TitleBar() {
  const [mounted, setMounted] = useState(false)
  const [isElectron, setIsElectron] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    setMounted(true)
    const electron = !!(window as any).electronAPI
    setIsElectron(electron)
    if (!electron) return
    const api = (window as any).electronAPI
    api.isMaximized().then(setIsMaximized)
    const cleanup = api.onMaximizeChange(setIsMaximized)
    return cleanup
  }, [])

  if (!mounted || !isElectron) return null

  const api = (window as any).electronAPI

  return (
    <div
      className="flex items-center justify-between h-9 glass-strong border-b border-border select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* App name */}
      <div className="px-4 flex items-center gap-2">
        <svg className="w-3.5 h-3.5 text-primary" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M8 12 L12 8 L16 12 L12 16 Z" fill="currentColor" />
        </svg>
        <span className="text-[11px] font-semibold tracking-widest text-muted-foreground/70">
          SPOTGET
        </span>
      </div>

      {/* Window controls */}
      <div
        className="flex h-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={() => api.minimize()}
          className="w-12 h-full flex items-center justify-center hover:bg-white/5 transition-colors"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <button
          onClick={() => api.maximize()}
          className="w-12 h-full flex items-center justify-center hover:bg-white/5 transition-colors"
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized
            ? <Square className="w-3 h-3 text-muted-foreground" />
            : <Maximize2 className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>
        <button
          onClick={() => api.close()}
          className="w-12 h-full flex items-center justify-center hover:bg-red-500/80 transition-colors group"
          title="Close"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground group-hover:text-white" />
        </button>
      </div>
    </div>
  )
}
