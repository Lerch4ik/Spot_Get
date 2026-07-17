'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useSpotgetStore } from '@/lib/store'

export function LyricsDisplay() {
  const { currentTrack, currentTime } = useSpotgetStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const activeLineRef = useRef<HTMLDivElement>(null)

  const lyrics = currentTrack?.lyrics || []

  // Auto-scroll to active line
  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      const container = containerRef.current
      const line = activeLineRef.current
      const containerRect = container.getBoundingClientRect()
      const lineRect = line.getBoundingClientRect()
      const offset = lineRect.top - containerRect.top - containerRect.height / 3
      container.scrollBy({ top: offset, behavior: 'smooth' })
    }
  }, [currentTime])

  // Find current lyric line
  let activeIndex = -1
  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (currentTime >= lyrics[i].time) {
      activeIndex = i
      break
    }
  }

  if (lyrics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-muted-foreground text-sm">No lyrics available</p>
        <p className="text-xs text-muted-foreground/50 mt-1">Lyrics will appear here when available</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="h-[calc(100vh-380px)] overflow-y-auto pr-2 scroll-smooth custom-scrollbar"
    >
      <div className="space-y-4 py-8">
        {lyrics.map((line, index) => {
          const isActive = index === activeIndex
          const isPast = index < activeIndex
          const isNear = Math.abs(index - activeIndex) <= 2

          return (
            <motion.div
              key={index}
              ref={isActive ? activeLineRef : undefined}
              initial={false}
              animate={{
                opacity: isActive ? 1 : isNear ? 0.75 : 0.45,
                scale: isActive ? 1.02 : 1,
              }}
              transition={{ duration: 0.3 }}
              className={`cursor-pointer transition-colors px-2 py-1 rounded-lg ${
                isActive
                  ? 'text-primary font-semibold'
                  : isPast
                  ? 'text-foreground/70'
                  : 'text-foreground/50'
              }`}
              onClick={() => useSpotgetStore.getState().seek(line.time)}
            >
              <p className={`text-lg md:text-xl leading-relaxed ${isActive ? 'glow-green-text' : ''}`}>
                {line.text}
              </p>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
