'use client'

import { useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Repeat1,
  Shuffle,
  Heart,
  Maximize2,
} from 'lucide-react'
import { useSpotgetStore } from '@/lib/store'
import { TrackArtwork } from './TrackArtwork'

export function formatTime(seconds: number): string {
  if (!seconds || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function MiniPlayer() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    volume,
    isMuted,
    repeatMode,
    isShuffled,
    likedTrackIds,
    togglePlay,
    next,
    previous,
    seek,
    setVolume,
    toggleMute,
    toggleRepeat,
    toggleShuffle,
    toggleLike,
    setPlayerOpen,
  } = useSpotgetStore()

  const progressRef = useRef<HTMLDivElement>(null)

  const handleProgressClick = useCallback(
  (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !currentTrack) return
    const rect = progressRef.current.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    const newTime = pct * currentTrack.duration
    seek(newTime)
  },
  [currentTrack, seek]
)

  if (!currentTrack) return null

  const progress = currentTrack.duration > 0 ? (currentTime / currentTrack.duration) * 100 : 0
  const isLiked = likedTrackIds.has(currentTrack.id)

  const repeatIcon =
    repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />
  const repeatColor = repeatMode !== 'off' ? 'text-primary' : 'text-muted-foreground'

  return (
    <div className="flex-shrink-0 border-t border-border glass-strong z-20">
      {/* Progress bar (top edge) */}
      <div
        ref={progressRef}
        onClick={handleProgressClick}
        className="h-1.5 cursor-pointer group relative bg-secondary/50 hover:h-2 transition-all"
      >
        <div
          className="h-full bg-primary relative transition-none pointer-events-none"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary shadow-[0_0_8px_rgba(30,215,96,0.4)] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        </div>
      </div>

      <div className="px-4 py-4 flex items-center gap-4">
        {/* Track info */}
        <div
          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
          onClick={() => setPlayerOpen(true)}
        >
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 relative overflow-hidden"
            style={{ backgroundColor: currentTrack.color || '#1ed760' }}
          >
            <TrackArtwork
              url={currentTrack.thumbnailUrl}
              alt={currentTrack.title}
              className="absolute inset-0 w-full h-full object-cover"
              fallback={
                <>
                  <div className="absolute inset-0 bg-black/20" />
                  <span className="relative text-white text-sm font-bold">
                    {currentTrack.title.charAt(0)}
                  </span>
                </>
              }
            />
            {isPlaying && (
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                <motion.div animate={{ height: [3, 8, 3] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} className="w-0.5 bg-white rounded-full" />
                <motion.div animate={{ height: [5, 3, 5] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }} className="w-0.5 bg-white rounded-full" />
                <motion.div animate={{ height: [3, 7, 3] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }} className="w-0.5 bg-white rounded-full" />
              </div>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-base font-medium truncate">{currentTrack.title}</p>
            <p className="text-sm text-muted-foreground truncate">{currentTrack.artist}</p>
          </div>

          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={(e) => { e.stopPropagation(); toggleLike(currentTrack.id) }}
            className={`p-1 flex-shrink-0 ${isLiked ? 'text-primary' : 'text-muted-foreground/40 hover:text-muted-foreground'}`}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
          </motion.button>
        </div>

        {/* Center controls */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={toggleShuffle}
            className={`p-2 rounded-full transition-colors ${isShuffled ? 'text-primary' : 'text-muted-foreground hover:text-foreground'} hidden sm:block`}
          >
            <Shuffle className="w-4 h-4" />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={previous}
            className="p-2 rounded-full text-foreground hover:text-primary transition-colors"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={togglePlay}
            className="p-2.5 rounded-full bg-foreground text-background hover:scale-105 transition-transform"
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={next}
            className="p-2 rounded-full text-foreground hover:text-primary transition-colors"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={toggleRepeat}
            className={`p-2 rounded-full transition-colors ${repeatColor} hidden sm:block`}
          >
            {repeatIcon}
          </motion.button>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
          <span className="text-sm text-muted-foreground/50 font-mono hidden md:block">
            {formatTime(currentTime)} / {formatTime(currentTrack.duration)}
          </span>

          {/* Volume */}
          <div className="hidden sm:flex items-center gap-1.5">
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={toggleMute}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </motion.button>
            <input
              type="range"
              min={0}
              max={100}
              value={isMuted ? 0 : volume * 100}
              onChange={(e) => setVolume(parseInt(e.target.value) / 100)}
              className="w-20 h-1 rounded-full appearance-none bg-secondary cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer
                [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
            />
          </div>

          {/* Expand button */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => setPlayerOpen(true)}
            className="p-2 rounded-full text-muted-foreground hover:text-primary transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </div>
  )
}
