'use client'

import { useState } from 'react'
import { Music, GripVertical, Play, X, Search } from 'lucide-react'
import { useSpotgetStore, type Track } from '@/lib/store'
import { formatTime } from './MiniPlayer'
import { AddToPlaylistButton } from './AddToPlaylistButton'
import { TrackArtwork } from './TrackArtwork'
import { VirtualList } from './VirtualList'

type QueueEntry = { track: Track; qi: number }

export function QueuePanel() {
  const { queue, queueIndex, currentTrack, playFromQueue, removeFromQueue, downloads, lang } = useSpotgetStore()
  const [search, setSearch] = useState('')
  const ru = lang === 'ru'

  // Tracks queued before the artwork fix may lack thumbnailUrl —
  // fall back to the artwork stored on the matching download record.
  const artworkFor = (track: Track) =>
    track.thumbnailUrl || (downloads.find((d) => d.id === track.id) as any)?.artwork || ''

  // Keep the ORIGINAL queue index on every entry so play/remove actions still
  // hit the right track even when the list is filtered by search.
  const entries: QueueEntry[] = queue.map((track, qi) => ({ track, qi }))
  const q = search.trim().toLowerCase()
  const visible = q
    ? entries.filter(
        ({ track }) =>
          (track.title || '').toLowerCase().includes(q) || (track.artist || '').toLowerCase().includes(q),
      )
    : entries

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{ru ? 'Очередь' : 'Queue'}</h3>
        <span className="text-xs text-muted-foreground">{queue.length} {ru ? 'треков' : 'tracks'}</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={ru ? 'Поиск в очереди…' : 'Search queue…'}
          className="w-full pl-8 pr-3 py-2 rounded-full text-xs text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-primary/40"
          style={{ background: 'var(--wa-04)', border: '1px solid var(--wa-09)' }}
        />
      </div>

      {/* Now Playing */}
      {currentTrack && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 mb-2">
          <p className="text-[10px] text-primary font-semibold mb-2 uppercase tracking-wider">{ru ? 'Сейчас играет' : 'Now Playing'}</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
              <TrackArtwork
                url={artworkFor(currentTrack)}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
                fallback={<Music className="w-4 h-4 text-primary" />}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{currentTrack.title}</p>
              <p className="text-xs text-muted-foreground truncate">{currentTrack.artist}</p>
            </div>
            <span className="text-xs text-muted-foreground">
              {formatTime(currentTrack.duration)}
            </span>
          </div>
        </div>
      )}

      {/* Up Next — virtualized: only the rows on screen are rendered, so even
          a 1000-track queue scrolls without any lag. */}
      <VirtualList
        items={visible}
        itemHeight={56}
        maxHeight="max(220px, calc(100vh - 560px))"
        renderItem={({ track, qi }: QueueEntry) => {
          const isCurrent = qi === queueIndex
          return (
            <div
              className={`flex items-center gap-3 p-2.5 rounded-lg group transition-colors ${
                isCurrent ? 'bg-primary/5 border border-primary/20' : 'hover:bg-secondary'
              }`}
            >
              <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30 flex-shrink-0 cursor-grab" />

              {/* Track number */}
              <span className={`text-xs w-5 text-center flex-shrink-0 ${isCurrent ? 'text-primary font-bold' : 'text-muted-foreground/50'}`}>
                {isCurrent ? (
                  <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
                ) : (
                  qi + 1
                )}
              </span>

              {/* Thumbnail */}
              <div className="w-8 h-8 rounded bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                <TrackArtwork
                  url={artworkFor(track)}
                  alt={track.title}
                  className="w-full h-full object-cover"
                  fallback={<Music className="w-3 h-3 text-primary/60" />}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => playFromQueue(qi)}>
                <p className={`text-xs font-medium truncate ${isCurrent ? 'text-primary' : ''}`}>
                  {track.title}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">{track.artist}</p>
              </div>

              {/* Duration */}
              <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">
                {formatTime(track.duration)}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <AddToPlaylistButton track={track} />
                <button
                  onClick={() => playFromQueue(qi)}
                  className="p-1 rounded hover:bg-primary/10 text-primary"
                >
                  <Play className="w-3 h-3" />
                </button>
                <button
                  onClick={() => removeFromQueue(qi)}
                  className="p-1 rounded hover:bg-destructive/10 text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )
        }}
      />
    </div>
  )
}
