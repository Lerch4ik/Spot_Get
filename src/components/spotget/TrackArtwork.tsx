"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { useResolvedArtwork } from "@/hooks/useArtwork"

interface TrackArtworkProps {
  url?: string | null
  alt: string
  className?: string
  /** Rendered when there is no artwork or the image fails to load */
  fallback: ReactNode
}

/**
 * Renders track artwork, transparently resolving spotget:// URLs
 * (which <img> cannot display directly) into data URIs via IPC.
 *
 * Artwork is resolved lazily: the IPC round-trip only starts once the
 * element scrolls near the viewport. Without this, a large library
 * (500+ tracks) fires hundreds of simultaneous IPC calls and decodes
 * hundreds of images at once, freezing the UI.
 */
export function TrackArtwork({ url, alt, className, fallback }: TrackArtworkProps) {
  const holderRef = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  const [failed, setFailed] = useState(false)
  const onError = useCallback(() => setFailed(true), [])

  useEffect(() => {
    if (visible) return
    const el = holderRef.current
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: "300px" },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [visible])

  // Only kick off the (potentially IPC-backed) resolution when visible.
  const resolved = useResolvedArtwork(visible ? url : null)

  if (!resolved || failed) {
    return (
      <span ref={holderRef} className="w-full h-full flex items-center justify-center">
        {fallback}
      </span>
    )
  }

  return (
    <img
      src={resolved || "/placeholder.svg"}
      alt={alt}
      className={className}
      onError={onError}
    />
  )
}
