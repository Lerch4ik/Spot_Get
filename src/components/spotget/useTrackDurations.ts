'use client'

import { useEffect, useRef } from 'react'
import { useSpotgetStore, getCachedDuration } from '@/lib/store'

/**
 * Reads the real duration of local audio files that don't have one yet.
 *
 * The main-process metadata parser doesn't decode duration, so scanned tracks
 * arrive with duration 0 and would render as "0:00". This hook lazily loads
 * each such track's metadata in a throwaway <audio> element (which works for
 * every format the app can play) and writes the result back to the store.
 *
 * Work is done with limited concurrency so we never spawn hundreds of audio
 * elements at once, and every id is only ever attempted once per session.
 *
 * Results are flushed to the store in BATCHES: with 500+ imported tracks,
 * one store update per track would re-render the whole track list hundreds
 * of times and rewrite the duration cache on every single track, which
 * freezes the UI.
 */
const CONCURRENCY = 8
const FLUSH_EVERY = 25

export function useTrackDurations(tracks: Array<{ id: string; audioUrl?: string; duration?: number }>) {
  const updateTrackDurations = useSpotgetStore((s) => s.updateTrackDurations)
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
    const results: Record<string, number> = {}
    let buffered = 0

    const flush = () => {
      if (buffered === 0) return
      const batch = { ...results }
      for (const key of Object.keys(results)) delete results[key]
      buffered = 0
      updateTrackDurations(batch)
    }

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
          if (!cancelled && duration > 0) {
            results[track.id] = duration
            buffered++
            if (buffered >= FLUSH_EVERY) flush()
          }
        } catch {
          // ignore — leave as 0:00 for this file
        }
      }
    }

    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker)
    Promise.all(workers)
      .then(() => {
        if (!cancelled) flush()
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])
}
