'use client'

import { useEffect, useRef } from 'react'
import { useSpotgetStore, filePathToSpotgetUrl } from '@/lib/store'

let globalAudio: HTMLAudioElement | null = null
// Cache blob URLs so we don't re-fetch the same file
const blobCache = new Map<string, string>()

// ── Web Audio graph (built once, lazily) ─────────────────────────────
// element → MediaElementSource → [10 peaking biquad filters] → analyser → destination
// The EQ band gains and the visualizer both read from this single graph.
// A MediaElementSourceNode can only be created ONCE per <audio> element, so
// everything is kept at module scope and reused.
const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]

let audioCtx: AudioContext | null = null
let sourceNode: MediaElementAudioSourceNode | null = null
let eqFilters: BiquadFilterNode[] = []
let analyserNode: AnalyserNode | null = null

function getAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  if (!globalAudio) {
    globalAudio = new Audio()
    globalAudio.preload = 'auto'
    globalAudio.crossOrigin = 'anonymous'
  }
  return globalAudio
}

/** Build the Web Audio graph the first time it's needed. */
function ensureGraph(audio: HTMLAudioElement) {
  if (audioCtx || typeof window === 'undefined') return
  const Ctx = window.AudioContext || (window as any).webkitAudioContext
  if (!Ctx) return
  try {
    audioCtx = new Ctx()
    sourceNode = audioCtx.createMediaElementSource(audio)

    eqFilters = EQ_FREQUENCIES.map((freq, i) => {
      const filter = audioCtx!.createBiquadFilter()
      // Shelf on the two extremes, peaking in between — sounds more natural.
      if (i === 0) filter.type = 'lowshelf'
      else if (i === EQ_FREQUENCIES.length - 1) filter.type = 'highshelf'
      else {
        filter.type = 'peaking'
        filter.Q.value = 1.1
      }
      filter.frequency.value = freq
      filter.gain.value = 0
      return filter
    })

    analyserNode = audioCtx.createAnalyser()
    analyserNode.fftSize = 128
    analyserNode.smoothingTimeConstant = 0.8

    // Chain: source → f0 → f1 → ... → f9 → analyser → destination
    let node: AudioNode = sourceNode
    for (const f of eqFilters) {
      node.connect(f)
      node = f
    }
    node.connect(analyserNode)
    analyserNode.connect(audioCtx.destination)
  } catch (e) {
    console.error('[useAudio] failed to build Web Audio graph:', e)
    audioCtx = null
    sourceNode = null
    eqFilters = []
    analyserNode = null
  }
}

function applyEqBands(bands: number[]) {
  if (!eqFilters.length) return
  bands.forEach((gain, i) => {
    if (eqFilters[i]) {
      // Clamp to the graph's range and ramp to avoid clicks.
      const g = Math.max(-24, Math.min(24, gain))
      try {
        eqFilters[i].gain.setTargetAtTime(g, audioCtx!.currentTime, 0.02)
      } catch (_) {
        eqFilters[i].gain.value = g
      }
    }
  })
}

/** Shared analyser so the visualizer can render real frequency data. */
export function getAudioAnalyser(): AnalyserNode | null {
  return analyserNode
}

/**
 * Electron's renderer blocks spotget:// URLs from being set directly on
 * HTMLAudioElement ("Media load rejected by URL safety check").
 * Workaround: fetch the file via the registered protocol handler (which
 * works fine with fetch/XHR) and hand the audio element a blob: URL instead.
 */
async function fetchAsBlobUrl(url: string): Promise<string | null> {
  if (blobCache.has(url)) return blobCache.get(url)!
  const res = await fetch(url)
  if (!res.ok) return null
  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  blobCache.set(url, blobUrl)
  return blobUrl
}

async function resolveSrc(url: string, filePath?: string): Promise<string> {
  if (!url && !filePath) return ''
  try {
    if (url && !url.startsWith('spotget://')) return url
    // 1) Try the stored audioUrl as-is
    if (url) {
      const direct = await fetchAsBlobUrl(url)
      if (direct) return direct
    }
    // 2) Fallback: rebuild a fresh URL from the native file path — this
    // rescues history entries saved with older/broken URL formats.
    if (filePath) {
      const rebuilt = filePathToSpotgetUrl(filePath)
      if (rebuilt && rebuilt !== url) {
        const viaPath = await fetchAsBlobUrl(rebuilt)
        if (viaPath) return viaPath
      }
    }
    console.error('[useAudio] resolveSrc: file not reachable', { url, filePath })
    return ''
  } catch (e) {
    console.error('[useAudio] resolveSrc failed:', e)
    // Don't return spotget:// as fallback — it's guaranteed to fail on HTMLAudioElement
    return ''
  }
}

export function useAudio() {
  const audioRef    = useRef<HTMLAudioElement | null>(null)
  const isSeeking   = useRef(false)
  const loadingRef  = useRef<string | null>(null) // trackId currently being loaded

  const currentTrackId  = useSpotgetStore((s) => s.currentTrack?.id)
  const currentTrackUrl = useSpotgetStore((s) => s.currentTrack?.audioUrl)
  const currentTrackFilePath = useSpotgetStore((s) => (s.currentTrack as any)?.filePath as string | undefined)
  const isPlaying  = useSpotgetStore((s) => s.isPlaying)
  const volume     = useSpotgetStore((s) => s.volume)
  const isMuted    = useSpotgetStore((s) => s.isMuted)
  const currentTime = useSpotgetStore((s) => s.currentTime)
  const playbackSpeed = useSpotgetStore((s) => s.playbackSpeed)
  const eqBands    = useSpotgetStore((s) => s.eqBands)

  useEffect(() => {
    const audio = getAudio()
    if (audio) audioRef.current = audio
  }, [])

  // Track change — resolve spotget:// → blob: before setting src
  useEffect(() => {
    if ((!currentTrackUrl && !currentTrackFilePath) || !currentTrackId || typeof window === 'undefined') return
    const audio = getAudio()
    if (!audio) return
    audioRef.current = audio

    // Already loaded this track
    if ((audio as any).__spotgetTrackId === currentTrackId) return

    loadingRef.current = currentTrackId

    resolveSrc(currentTrackUrl || '', currentTrackFilePath).then((src) => {
      // Stale: user switched track while we were fetching
      if (loadingRef.current !== currentTrackId) return
      // Never assign an empty src — it makes the <audio> element resolve the
      // page URL and throw "MEDIA_ELEMENT_ERROR: Empty src attribute".
      if (!src) return
      ;(audio as any).__spotgetTrackId = currentTrackId
      audio.src = src
      audio.load()
    })

    const onMeta = () => {
      const dur = audio.duration
      if (isFinite(dur) && dur > 0) {
        const id = useSpotgetStore.getState().currentTrack?.id
        if (id) useSpotgetStore.getState().updateTrackDuration(id, dur)
      }
    }
    const onTime = () => {
      if (!isSeeking.current) {
        useSpotgetStore.getState().setCurrentTime(audio.currentTime)
      }
    }
    const onEnd     = () => useSpotgetStore.getState().next()
    const onCanPlay = () => {
      if (useSpotgetStore.getState().isPlaying) {
        audio.play().catch(e => console.error('[useAudio] play error:', e))
      }
    }
    const onSeeked = () => {
      isSeeking.current = false
      useSpotgetStore.getState().setCurrentTime(audio.currentTime)
    }
    const onError = () => {
      const err = audio.error
      if (err && err.code !== MediaError.MEDIA_ERR_ABORTED) {
        console.error('[useAudio] error:', {
          code: err.code,
          message: err.message,
          src: audio.src?.substring(0, 120),
        })
      }
    }

    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('timeupdate',     onTime)
    audio.addEventListener('ended',          onEnd)
    audio.addEventListener('canplay',        onCanPlay)
    audio.addEventListener('seeked',         onSeeked)
    audio.addEventListener('error',          onError)

    return () => {
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('timeupdate',     onTime)
      audio.removeEventListener('ended',          onEnd)
      audio.removeEventListener('canplay',        onCanPlay)
      audio.removeEventListener('seeked',         onSeeked)
      audio.removeEventListener('error',          onError)
    }
  }, [currentTrackId, currentTrackUrl, currentTrackFilePath])

  // Play / pause
  useEffect(() => {
    if (!currentTrackUrl || typeof window === 'undefined') return
    const audio = getAudio()
    if (!audio) return
    if (isPlaying) {
      // Build the graph on the first user-initiated play (needs a user gesture
      // for the AudioContext to be allowed to start), then resume it.
      ensureGraph(audio)
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {})
      }
      // Re-apply EQ once the graph exists
      applyEqBands(useSpotgetStore.getState().eqBands)
      if (audio.readyState >= 2) {
        audio.play().catch(e => console.error('[useAudio] play error:', e))
      }
    } else {
      audio.pause()
    }
  }, [isPlaying, currentTrackUrl])

  // Volume / mute
  useEffect(() => {
    const audio = getAudio()
    if (!audio) return
    audio.volume = isMuted ? 0 : Math.max(0, Math.min(1, volume))
  }, [volume, isMuted])

  // Playback speed
  useEffect(() => {
    const audio = getAudio()
    if (!audio) return
    const rate = Math.max(0.25, Math.min(4, playbackSpeed || 1))
    audio.playbackRate = rate
    // Keep pitch natural when available (Chromium supports this).
    ;(audio as any).preservesPitch = true
    ;(audio as any).mozPreservesPitch = true
    ;(audio as any).webkitPreservesPitch = true
  }, [playbackSpeed])

  // Equalizer bands
  useEffect(() => {
    applyEqBands(eqBands)
  }, [eqBands])

  // Seek
  useEffect(() => {
    const audio = getAudio()
    if (!audio || !isFinite(currentTime)) return
    if (Math.abs(audio.currentTime - currentTime) > 1.0) {
      isSeeking.current = true
      audio.currentTime = currentTime
    }
  }, [currentTime])

  return audioRef
}
