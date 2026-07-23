'use client'

/**
 * useVoiceDucking — automatically lowers the music volume when the microphone
 * hears speech (e.g. a Discord conversation) and restores it after silence.
 *
 * Self-ducking protection (the app must never duck itself because of its own
 * music) works on two levels:
 *   1. echoCancellation on the mic stream — Chromium subtracts the audio the
 *      app itself is playing from the mic signal.
 *   2. Leak compensation — we also measure the app's own output level via the
 *      shared player analyser and raise the trigger threshold proportionally,
 *      so whatever music still leaks from the speakers into the mic cannot
 *      cross it. Voices are louder than the leaked music and still trigger.
 */

import { useEffect } from 'react'
import { useSpotgetStore } from '@/lib/store'
import { getAudioAnalyser } from '@/hooks/useAudio'

const POLL_MS = 100
// How long the mic must stay quiet before the volume is restored.
const RESTORE_AFTER_MS = 1500
// Voice must be detected on N consecutive polls before we duck — filters out
// single clicks/pops.
const CONSECUTIVE_POLLS = 2
// Base mic RMS thresholds per sensitivity setting.
const BASE_THRESHOLDS: Record<string, number> = { high: 0.012, medium: 0.025, low: 0.05 }
// How strongly the app's own output raises the threshold (leak compensation).
const LEAK_FACTOR = 0.12

export function useVoiceDucking() {
  const enabled = useSpotgetStore((s) => s.settings.duckingEnabled ?? false)
  const duckLevel = useSpotgetStore((s) => s.settings.duckingLevel ?? 0.2)
  const sensitivity = useSpotgetStore((s) => s.settings.duckingSensitivity ?? 'medium')

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    let cancelled = false
    let stream: MediaStream | null = null
    let micCtx: AudioContext | null = null
    let timer: ReturnType<typeof setInterval> | null = null

    let ducked = false
    let baseVolume = 0
    let lastSetVolume = -1
    let lastVoiceAt = 0
    let voiceStreak = 0

    const restoreIfOwned = () => {
      // Only restore the volume if the user hasn't touched the slider while
      // we were ducked — otherwise adopt their new value.
      const s = useSpotgetStore.getState()
      if (ducked && Math.abs(s.volume - lastSetVolume) < 0.01) {
        s.setVolume(baseVolume)
      }
      ducked = false
      lastSetVolume = -1
    }

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            // Chromium subtracts the app's own playback from the mic signal,
            // so our music mostly never reaches the detector.
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false,
          },
        })
      } catch (e) {
        console.warn('[useVoiceDucking] mic unavailable:', e)
        return
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }

      const Ctx = window.AudioContext || (window as any).webkitAudioContext
      if (!Ctx) return
      micCtx = new Ctx()
      const source = micCtx.createMediaStreamSource(stream)
      const micAnalyser = micCtx.createAnalyser()
      micAnalyser.fftSize = 1024
      micAnalyser.smoothingTimeConstant = 0.3
      source.connect(micAnalyser)
      const micBuf = new Float32Array(micAnalyser.fftSize)

      timer = setInterval(() => {
        const s = useSpotgetStore.getState()

        // If the user moved the volume slider while we were ducked, adopt
        // their value and stop managing this speech episode. This check MUST
        // run at the start of the tick with fresh state — checking it right
        // after setVolume (with a stale snapshot) made every duck look like
        // a user change, so the volume kept ratcheting down and never
        // restored.
        if (ducked && lastSetVolume >= 0 && Math.abs(s.volume - lastSetVolume) > 0.01) {
          ducked = false
          lastSetVolume = -1
        }

        // If playback stopped while we were ducked, restore right away.
        if (ducked && !s.isPlaying) {
          restoreIfOwned()
        }

        // ── Mic level ──
        micAnalyser.getFloatTimeDomainData(micBuf)
        let sum = 0
        for (let i = 0; i < micBuf.length; i++) sum += micBuf[i] * micBuf[i]
        const micRms = Math.sqrt(sum / micBuf.length)

        // ── App's own output level (leak compensation) ──
        // If our music is playing, whatever escapes the echo canceller is
        // proportional to this level — raise the bar so it can never duck us.
        let musicRms = 0
        const musicAnalyser = getAudioAnalyser()
        if (musicAnalyser && s.isPlaying && !s.isMuted && s.volume > 0) {
          const buf = new Uint8Array(musicAnalyser.fftSize)
          musicAnalyser.getByteTimeDomainData(buf)
          let m = 0
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128
            m += v * v
          }
          musicRms = Math.sqrt(m / buf.length) * s.volume
        }

        const base = BASE_THRESHOLDS[sensitivity] ?? BASE_THRESHOLDS.medium
        const threshold = base + musicRms * LEAK_FACTOR

        const now = Date.now()
        if (micRms > threshold) {
          voiceStreak++
          if (voiceStreak >= CONSECUTIVE_POLLS) {
            lastVoiceAt = now
            if (s.isPlaying && !ducked) {
              ducked = true
              baseVolume = s.volume
              const target = Math.max(0, baseVolume * duckLevel)
              s.setVolume(target)
              lastSetVolume = target
            }
          }
        } else {
          voiceStreak = 0
          if (ducked && now - lastVoiceAt > RESTORE_AFTER_MS) {
            restoreIfOwned()
          }
        }

      }, POLL_MS)
    }

    start()

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
      restoreIfOwned()
      try { stream?.getTracks().forEach((t) => t.stop()) } catch {}
      try { micCtx?.close() } catch {}
    }
  }, [enabled, duckLevel, sensitivity])
}
