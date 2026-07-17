"use client"

import { useEffect, useState } from "react"

/**
 * Resolves artwork URLs for <img> rendering.
 *
 * spotget:// URLs cannot be set directly on <img> in the Electron renderer,
 * so they are resolved to base64 data URIs via the artwork:read IPC handler.
 * Results are cached module-wide to avoid repeated IPC round-trips for the
 * same artwork file (lists re-render often).
 */
const artworkCache = new Map<string, string | null>()

function isDirectlyRenderable(url: string): boolean {
  return (
    url.startsWith("data:") ||
    url.startsWith("https://") ||
    url.startsWith("http://") ||
    url.startsWith("blob:") ||
    url.startsWith("/")
  )
}

export function useResolvedArtwork(url?: string | null): string | null {
  const [resolved, setResolved] = useState<string | null>(() => {
    if (!url) return null
    if (isDirectlyRenderable(url)) return url
    return artworkCache.get(url) ?? null
  })

  useEffect(() => {
    if (!url) {
      setResolved(null)
      return
    }
    if (isDirectlyRenderable(url)) {
      setResolved(url)
      return
    }
    if (url.startsWith("spotget://")) {
      if (artworkCache.has(url)) {
        setResolved(artworkCache.get(url) ?? null)
        return
      }
      let cancelled = false
      const api = typeof window !== "undefined" ? (window as any).electronAPI : null
      if (api?.readArtwork) {
        api
          .readArtwork(url)
          .then((dataUri: string | null) => {
            artworkCache.set(url, dataUri || null)
            if (!cancelled) setResolved(dataUri || null)
          })
          .catch(() => {
            artworkCache.set(url, null)
            if (!cancelled) setResolved(null)
          })
      } else {
        setResolved(null)
      }
      return () => {
        cancelled = true
      }
    }
    // Unknown scheme — try rendering as-is
    setResolved(url)
  }, [url])

  return resolved
}
