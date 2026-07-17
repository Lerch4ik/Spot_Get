'use client'

import { useRef, useEffect } from 'react'
import { useSpotgetStore } from '@/lib/store'
import { getAudioAnalyser } from '@/hooks/useAudio'

export function AudioVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const barsRef = useRef<number[]>(Array(64).fill(0))
  const freqRef = useRef<Uint8Array | null>(null)

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current
      if (!canvas) {
        animRef.current = requestAnimationFrame(draw)
        return
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        animRef.current = requestAnimationFrame(draw)
        return
      }

      const playing = useSpotgetStore.getState().isPlaying
      const { width, height } = canvas
      ctx.clearRect(0, 0, width, height)

      const bars = barsRef.current
      const barCount = bars.length
      const barWidth = (width / barCount) * 0.7
      const gap = (width / barCount) * 0.3

      // Use real frequency data from the shared Web Audio analyser when it's
      // available; otherwise fall back to the smooth idle animation.
      const analyser = getAudioAnalyser()
      let freq: Uint8Array | null = null
      if (analyser && playing) {
        if (!freqRef.current || freqRef.current.length !== analyser.frequencyBinCount) {
          freqRef.current = new Uint8Array(analyser.frequencyBinCount)
        }
        freq = freqRef.current
        analyser.getByteFrequencyData(freq)
      }

      for (let i = 0; i < barCount; i++) {
        if (freq) {
          // Map bar index to a frequency bin and smooth toward it.
          const bin = Math.floor((i / barCount) * freq.length)
          const target = freq[bin] / 255
          bars[i] += (target - bars[i]) * 0.35
        } else if (playing) {
          const target = Math.random() * 0.8 + 0.1
          bars[i] += (target - bars[i]) * 0.15
        } else {
          bars[i] *= 0.92
        }

        const barHeight = bars[i] * height * 0.85
        const x = i * (barWidth + gap) + gap / 2
        const y = height - barHeight

        const gradient = ctx.createLinearGradient(x, y, x, height)
        gradient.addColorStop(0, 'rgba(30, 215, 96, 0.9)')
        gradient.addColorStop(0.5, 'rgba(30, 215, 96, 0.5)')
        gradient.addColorStop(1, 'rgba(30, 215, 96, 0.1)')

        ctx.fillStyle = gradient
        ctx.beginPath()

        const radius = Math.min(barWidth / 2, 3)
        ctx.moveTo(x + radius, y)
        ctx.lineTo(x + barWidth - radius, y)
        ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius)
        ctx.lineTo(x + barWidth, height)
        ctx.lineTo(x, height)
        ctx.lineTo(x, y + radius)
        ctx.quadraticCurveTo(x, y, x + radius, y)
        ctx.fill()

        ctx.shadowColor = 'rgba(30, 215, 96, 0.3)'
        ctx.shadowBlur = 8
        ctx.fill()
        ctx.shadowBlur = 0
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={200}
      className="w-full h-48 rounded-xl opacity-80"
    />
  )
}
