"use client"

import { useState, useCallback, type ReactNode } from "react"
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
 */
export function TrackArtwork({ url, alt, className, fallback }: TrackArtworkProps) {
  const resolved = useResolvedArtwork(url)
  const [failed, setFailed] = useState(false)
  const onError = useCallback(() => setFailed(true), [])

  if (!resolved || failed) return <>{fallback}</>

  return (
    <img
      src={resolved || "/placeholder.svg"}
      alt={alt}
      className={className}
      onError={onError}
    />
  )
}
