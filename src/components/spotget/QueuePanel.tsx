'use client'

import { motion } from 'framer-motion'
import { Music, GripVertical, Play, X } from 'lucide-react'
import { useSpotgetStore, type Track } from '@/lib/store'
import { formatTime } from './MiniPlayer'
import { AddToPlaylistButton } from './AddToPlaylistButton'
import { TrackArtwork } from './TrackArtwork'

export function QueuePanel() {
  const { queue, queueIndex, currentTrack, playFromQueue, removeFromQueue, downloads } = useSpotgetStore()

  // Tracks queued before the artwork fix may lack thumbnailUrl —
  // fall back to the artwork stored on the matching download record.
  const artworkFor = (track: Track) =>
    track.thumbnailUrl || (downloads.find((d) => d.id === track.id) as any)?.artwork || ''

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Queue</h3>
        <span className="text-xs text-muted-foreground">{queue.length} tracks</span>
      </div>

      {/* Now Playing */}
      {currentTrack && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 mb-2">
          <p className="text-[10px] text-primary font-semibold mb-2 uppercase tracking-wider">Now Playing</p>
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

      {/* Up Next */}
      <div className="space-y-1 max-h-[calc(100vh-500px)] overflow-y-auto pr-1">
        {queue.map((track, index) => {
          const isCurrent = index === queueIndex
          return (
            <motion.div
              key={`${track.id}-${index}`}
              layout
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
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
                  index + 1
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
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => playFromQueue(index)}>
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
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => playFromQueue(index)}
                  className="p-1 rounded hover:bg-primary/10 text-primary"
                >
                  <Play className="w-3 h-3" />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => removeFromQueue(index)}
                  className="p-1 rounded hover:bg-destructive/10 text-destructive"
                >
                  <X className="w-3 h-3" />
                </motion.button>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
