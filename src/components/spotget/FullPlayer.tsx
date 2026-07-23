'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  ChevronDown,
  ListMusic,
  Mic2,
  Sliders,
  Share2,
  MoreHorizontal,
  Gauge,
  Plus,
} from 'lucide-react'
import { useSpotgetStore, type PlayerView } from '@/lib/store'
import { TrackArtwork } from './TrackArtwork'
import { AudioVisualizer } from './AudioVisualizer'
import { Equalizer } from './Equalizer'
import { QueuePanel } from './QueuePanel'
import { LyricsDisplay } from './LyricsDisplay'
import { formatTime } from './MiniPlayer'

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2]

export function FullPlayer() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    volume,
    isMuted,
    repeatMode,
    isShuffled,
    likedTrackIds,
    playbackSpeed,
    playerView,
    playlists,
    addTrackToPlaylist,
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
    setCurrentTime,
    setPlaybackSpeed,
    setPlayerView,
  } = useSpotgetStore()

  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false)

  // In Electron the custom TitleBar (with minimize/maximize/close) is 36px
  // tall. The full player must start BELOW it, otherwise it covers the
  // window controls and the app can't be minimized.
  const hasTitleBar = typeof window !== 'undefined' && !!(window as any).electronAPI

  // Tracks queued before the artwork fix may lack thumbnailUrl —
  // fall back to the artwork stored on the matching download record.
  const downloads = useSpotgetStore((s) => s.downloads)
  const currentArtworkUrl =
    currentTrack?.thumbnailUrl ||
    ((downloads.find((d) => d.id === currentTrack?.id) as any)?.artwork ?? '')

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!currentTrack) return
      const rect = e.currentTarget.getBoundingClientRect()
      const pct = (e.clientX - rect.left) / rect.width
      seek(pct * currentTrack.duration)
    },
    [currentTrack, seek]
  )

  if (!currentTrack) return null

  const progress = currentTrack.duration > 0 ? (currentTime / currentTrack.duration) * 100 : 0
  const isLiked = likedTrackIds.has(currentTrack.id)
  const bgColor = currentTrack.color || '#1ed760'

  const repeatIcon = repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />

  const viewTabs: { id: PlayerView; label: string; icon: React.ReactNode }[] = [
    { id: 'full', label: 'Now Playing', icon: <Play className="w-3.5 h-3.5" /> },
    { id: 'lyrics', label: 'Lyrics', icon: <Mic2 className="w-3.5 h-3.5" /> },
    { id: 'queue', label: 'Queue', icon: <ListMusic className="w-3.5 h-3.5" /> },
    { id: 'eq', label: 'Equalizer', icon: <Sliders className="w-3.5 h-3.5" /> },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-x-0 bottom-0 z-50 flex flex-col overflow-hidden"
      style={{ top: hasTitleBar ? 36 : 0 }}
    >
      {/* Solid base so nothing leaks through */}
      <div className="absolute inset-0 bg-background" />
      {/* Ambient artwork-colored glow, frosted for the glass look */}
      <div
        className="absolute inset-0 transition-colors duration-1000"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% -10%, ${bgColor}30 0%, transparent 60%), radial-gradient(ellipse 60% 45% at 85% 105%, ${bgColor}14 0%, transparent 55%)`,
        }}
      />
      <div className="absolute inset-0 backdrop-blur-3xl" />

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setPlayerOpen(false)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <ChevronDown className="w-6 h-6" />
          </motion.button>

          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Now Playing</p>
            <p className="text-xs text-muted-foreground/70">{currentTrack.album}</p>
          </div>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowPlaylistMenu(!showPlaylistMenu)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors text-muted-foreground relative"
          >
            <MoreHorizontal className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Playlist add menu */}
        <AnimatePresence>
          {showPlaylistMenu && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-16 right-6 z-50 w-64 glass-strong rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="p-3 border-b border-border">
                <p className="text-xs font-semibold">Add to Playlist</p>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {playlists.map((pl) => {
                  const hasTrack = pl.trackIds.includes(currentTrack.id)
                  return (
                    <motion.button
                      key={pl.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        if (!hasTrack) addTrackToPlaylist(pl.id, currentTrack.id)
                        setShowPlaylistMenu(false)
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-secondary transition-colors ${
                        hasTrack ? 'opacity-50' : ''
                      }`}
                    >
                      <div
                        className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: pl.color + '20' }}
                      >
                        <ListMusic className="w-3 h-3" style={{ color: pl.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{pl.name}</p>
                        <p className="text-[10px] text-muted-foreground">{pl.trackIds.length} tracks</p>
                      </div>
                      {hasTrack && (
                        <span className="text-[9px] text-primary">Added</span>
                      )}
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main content area */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6 px-4 sm:px-6 lg:px-12 overflow-y-auto lg:overflow-hidden">
          {/* Left: Artwork / Visualizer / Lyrics / Queue / EQ */}
          <div className="flex-none lg:flex-1 flex flex-col items-center justify-center lg:min-h-0 lg:overflow-hidden rounded-2xl py-2">
            <AnimatePresence mode="wait">
              {playerView === 'full' && (
                <motion.div
                  key="artwork"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="w-full max-w-md"
                >
                  {/* Album Art — capped by the window height so it never gets
                      clipped when the app window is small. */}
                  <div
                    className="relative aspect-square rounded-2xl overflow-hidden shadow-2xl mb-4 group mx-auto w-full"
                    style={{ maxWidth: 'max(180px, min(100%, calc(100vh - 340px)))' }}
                  >
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `linear-gradient(135deg, ${bgColor}40 0%, ${bgColor}10 50%, ${bgColor}30 100%)`,
                      }}
                    />
                    <TrackArtwork
                      url={currentArtworkUrl}
                      alt={currentTrack.title}
                      className="absolute inset-0 w-full h-full object-cover"
                      fallback={
                        /* Artwork pattern fallback */
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div
                            className="w-32 h-32 rounded-full opacity-20"
                            style={{ background: `radial-gradient(circle, ${bgColor} 0%, transparent 70%)` }}
                          />
                          <div className="absolute text-white/40 text-6xl font-black">
                            {currentTrack.title.charAt(0)}
                          </div>
                        </div>
                      }
                    />

                    {/* Visualizer overlay on hover */}
                    <div className="absolute bottom-0 left-0 right-0 h-1/3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <AudioVisualizer />
                    </div>

                    {/* Spinning disc effect */}
                    {isPlaying && (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                        className="absolute inset-8 border-2 border-white/5 rounded-full"
                      >
                        <div className="absolute top-1/2 left-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10" />
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}

              {playerView === 'lyrics' && (
                <motion.div
                  key="lyrics"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full max-w-lg glass rounded-2xl p-4"
                >
                  <LyricsDisplay />
                </motion.div>
              )}

              {playerView === 'eq' && (
                <motion.div
                  key="eq"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full max-w-lg glass rounded-2xl p-4"
                >
                  <Equalizer />
                </motion.div>
              )}

              {playerView === 'queue' && (
                <motion.div
                  key="queue"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full max-w-lg glass rounded-2xl p-4"
                >
                  <QueuePanel />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right side - Track info + controls (visible on larger screens) */}
          <div className="lg:w-80 flex-shrink-0 flex flex-col justify-center gap-6 pb-4 lg:pb-0">
            {/* Track details */}
            <div>
              <div className="flex items-start justify-between mb-1">
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold truncate">{currentTrack.title}</h2>
                  <p className="text-sm text-muted-foreground">{currentTrack.artist}</p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.8 }}
                  onClick={() => toggleLike(currentTrack.id)}
                  className={`p-2 ml-3 ${isLiked ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                </motion.button>
              </div>
              <p className="text-xs text-muted-foreground/60">{currentTrack.album}</p>
            </div>

            {/* Progress bar */}
            <div>
              <div
                onClick={handleProgressClick}
                className="h-1.5 rounded-full bg-secondary cursor-pointer group hover:h-2 transition-all"
              >
                <div
                  className="h-full rounded-full bg-primary relative transition-none pointer-events-none"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-primary shadow-[0_0_10px_rgba(30,215,96,0.4)] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                </div>
              </div>
              <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground/60 font-mono">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(currentTrack.duration)}</span>
              </div>
            </div>

            {/* Main controls */}
            <div className="flex items-center justify-between">
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={toggleShuffle}
                className={`p-2 rounded-full transition-colors ${isShuffled ? 'text-primary glow-green-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Shuffle className="w-5 h-5" />
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={previous}
                className="p-2 rounded-full text-foreground hover:text-primary transition-colors"
              >
                <SkipBack className="w-6 h-6 fill-current" />
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={togglePlay}
                className="p-4 rounded-full bg-primary text-primary-foreground shadow-[0_0_20px_rgba(30,215,96,0.3)] hover:shadow-[0_0_30px_rgba(30,215,96,0.4)] transition-shadow"
              >
                {isPlaying ? (
                  <Pause className="w-7 h-7 fill-current" />
                ) : (
                  <Play className="w-7 h-7 fill-current ml-0.5" />
                )}
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={next}
                className="p-2 rounded-full text-foreground hover:text-primary transition-colors"
              >
                <SkipForward className="w-6 h-6 fill-current" />
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={toggleRepeat}
                className={`p-2 rounded-full transition-colors ${repeatMode !== 'off' ? 'text-primary glow-green-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {repeatIcon}
                {repeatMode === 'one' && (
                  <span className="absolute text-[8px] font-bold text-primary">1</span>
                )}
              </motion.button>
            </div>

            {/* Volume + Speed */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 flex-1">
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
                  className="flex-1 h-1 rounded-full appearance-none bg-secondary cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
                />
              </div>

              {/* Speed */}
              <div className="relative">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className={`px-2 py-1 rounded-lg text-xs font-mono transition-colors ${
                    playbackSpeed !== 1
                      ? 'bg-primary/10 text-primary border border-primary/30'
                      : 'bg-secondary text-muted-foreground border border-border'
                  }`}
                >
                  <Gauge className="w-3 h-3 inline mr-1" />
                  {playbackSpeed}x
                </motion.button>

                <AnimatePresence>
                  {showSpeedMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="absolute bottom-full mb-2 right-0 glass-strong rounded-xl shadow-xl overflow-hidden z-50"
                    >
                      {SPEED_OPTIONS.map((speed) => (
                        <button
                          key={speed}
                          onClick={() => { setPlaybackSpeed(speed); setShowSpeedMenu(false) }}
                          className={`block w-full px-4 py-2 text-xs font-mono text-left hover:bg-secondary transition-colors ${
                            playbackSpeed === speed ? 'text-primary bg-primary/5' : 'text-foreground'
                          }`}
                        >
                          {speed}x
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Visualizer always visible at bottom */}
            <AudioVisualizer />
          </div>
        </div>

        {/* Bottom: View tabs */}
        <div className="px-6 py-4 border-t border-border/30">
          <div className="flex items-center justify-center gap-2 max-w-md mx-auto">
            {viewTabs.map((tab) => (
              <motion.button
                key={tab.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => setPlayerView(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                  playerView === tab.id
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
