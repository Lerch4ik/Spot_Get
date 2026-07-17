'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, Check, ListMusic } from 'lucide-react'
import { useSpotgetStore } from '@/lib/store'
import type { Track } from '@/lib/store'

interface Props {
  track: Track
}

export function AddToPlaylistButton({ track }: Props) {
  const { playlists, addTrackToPlaylist } = useSpotgetStore()
  const [open, setOpen] = useState(false)
  const [added, setAdded] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleAdd = (playlistId: string) => {
    addTrackToPlaylist(playlistId, track.id)
    setAdded(playlistId)
    setTimeout(() => { setAdded(null); setOpen(false) }, 1000)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        className="p-1.5 rounded hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
        title="Add to playlist"
      >
        <Plus className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-1 z-50 glass-strong rounded-xl shadow-xl min-w-[160px] py-1">
          {playlists.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-2">No playlists yet</p>
          ) : (
            playlists.map(pl => (
              <button
                key={pl.id}
                onClick={() => handleAdd(pl.id)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-white/5 transition-colors"
              >
                <ListMusic className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="flex-1 text-left truncate">{pl.name}</span>
                {added === pl.id && <Check className="w-3.5 h-3.5 text-green-400" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
