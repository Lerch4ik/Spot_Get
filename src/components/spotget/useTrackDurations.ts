'use client'

import { useEffect, useRef } from 'react'
import { useSpotgetStore, getCachedDuration } from '@/lib/store'

/**
 * Reads the real duration of local audio files that don't have one yet.
 *
 * The main-process metadata parser doesn't decode duration, so scanned tracks
 * arrive with duration 0 and would render as "0:00". This hook lazily loads
 * each such track's metadata in a throwaway <audio> element (which works for
 * every format the app can play) and writes the result back through
 * updateTrackDuration, which also persists it to the duration cache.
 *
 * Work is done with limited concurrency so we never spawn hundreds of audio
 * elements at once, and every id is only ever attempted once per session.
 */
const CONCURRENCY = 4

export function useTrackDurations(tracks: Array<{ id: string; audioUrl?: string; duration?: number }>) {
  const updateTrackDuration = useSpotgetStore((s) => s.updateTrackDuration)
  const attempted = useRef<Set<string>>(new Set())

  // A stable signature so the effect only re-runs when the set of tracks needing
  // work actually changes (not on every render / duration update).
  const pending = tracks.filter(
    (t) => t.audioUrl && !(t.duration && t.duration > 0) && !getCachedDuration(t.id) && !attempted.current.has(t.id),
  )
  const signature = pending.map((t) => t.id).join('|')

  useEffect(() => {
    if (pending.length === 0) return
    let cancelled = false
    const queue = [...pending]

    const measure = (audioUrl: string) =>
      new Promise<number>((resolve) => {
        const audio = new Audio()
        audio.preload = 'metadata'
        const cleanup = () => {
          audio.onloadedmetadata = null
          audio.onerror = null
          audio.src = ''
        }
        audio.onloadedmetadata = () => {
          const d = Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0
          cleanup()
          resolve(d)
        }
        audio.onerror = () => {
          cleanup()
          resolve(0)
        }
        audio.src = audioUrl
      })

    const worker = async () => {
      while (!cancelled) {
        const track = queue.shift()
        if (!track) break
        attempted.current.add(track.id)
        try {
          const duration = await measure(track.audioUrl as string)
          if (!cancelled && duration > 0) updateTrackDuration(track.id, duration)
        } catch {
          // ignore — leave as 0:00 for this file
        }
      }
    }

    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker)
    Promise.all(workers).catch(() => {})

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])
}
