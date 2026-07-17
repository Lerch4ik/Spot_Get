/**
 * ipc-bridge.ts
 *
 * Singleton that wires Electron IPC events → Zustand store.
 * Lives outside React, so it survives panel unmounts when the user
 * switches tabs.  Call initIpcBridge() once (idempotent).
 */
import { useSpotgetStore } from "./store"

const cleanStr = (s?: string | null) =>
  (s || "").replace(/[\s\-]+$/, "").replace(/^[\s\-]+/, "").trim()

export function initIpcBridge() {
  if (typeof window === "undefined") return

  // Guard lives on `window`, not module scope: a module-scope flag resets
  // whenever this file is re-evaluated (e.g. Next.js Fast Refresh in dev),
  // which let initIpcBridge() re-run and — before the preload.js fix —
  // register a second set of IPC listeners, doubling every event.
  // Keeping the guard on window also makes this safe even now, in case
  // initIpcBridge() ever gets called from more than one place.
  if ((window as any).__spotgetIpcBridgeInitialised) {
    console.log('[initIpcBridge] already initialised, skipping')
    return
  }

  const api = (window as any).electronAPI
  if (!api) {
    console.warn('[initIpcBridge] electronAPI not found')
    return
  }

  console.log('[initIpcBridge] initialising IPC listeners...')
  ;(window as any).__spotgetIpcBridgeInitialised = true

  // ── new track ──────────────────────────────────────────────────
  api.onNewTrack((data: any) => {
    const state = useSpotgetStore.getState()
    // Filter out garbage-only strings like "-", ",", "  -  ,"
    const isGarbage = (s: string) => !s || /^[\-,\s]+$/.test(s)
    const rawTitle  = cleanStr(data.title)
    const rawArtist = cleanStr(data.artist)
    const cleanTitle  = isGarbage(rawTitle)  ? (isGarbage(rawArtist) ? "Unknown Track" : rawArtist) : rawTitle
    const cleanArtist = isGarbage(rawArtist) ? "Unknown Artist" : rawArtist

    const exists = state.downloads.some((d) => d.id === data.id)
    console.log(`[onNewTrack] id=${data.id} parent=${data.parentId} exists=${exists} title="${cleanTitle}" artist="${cleanArtist}"`)

    // Update parent status to "downloading" when first sub-track appears
    if (data.parentId) {
      const parent = state.downloads.find((d) => d.id === data.parentId)
      if (parent && parent.status === "pending") {
        state.updateDownload(data.parentId, { status: "downloading" })
      }
    }

    if (exists) {
      state.updateDownload(data.id, {
        title: cleanTitle,
        artist: cleanArtist,
        ...(data.artwork ? { artwork: data.artwork } : {}),
      })
      return
    }

    const parent = state.downloads.find((d) => d.id === data.parentId)
    state.addDownload({
      id: data.id,
      parentId: data.parentId,
      title: cleanTitle,
      artist: cleanArtist,
      artwork: data.artwork ?? undefined,
      type: "song",
      url: "",
      platform: data.platform || parent?.platform || "unknown",
      format: data.format   || parent?.format   || "mp3",
      bitrate: data.bitrate || parent?.bitrate  || "320k",
      status: "downloading",
      progress: 0,
      fileSize: "—",
      date: new Date().toLocaleDateString(),
      createdAt: Date.now(),
    })
    state.addDownloadSessionId(data.id)
  })

  // ── progress ───────────────────────────────────────────────────
  api.onDownloadProgress((data: any) => {
    const state = useSpotgetStore.getState()
    const cleanTitle  = data.title  ? cleanStr(data.title)  : undefined
    const cleanArtist = data.artist ? cleanStr(data.artist) : undefined
    
    const exists = state.downloads.some((d) => d.id === data.id)
    console.log(`[onDownloadProgress] id=${data.id} progress=${data.progress} exists=${exists} title="${cleanTitle}" artist="${cleanArtist}"`)

    if (!exists) {
      // Don't create a new download here — onNewTrack or onTrackSkipped handles that.
      // If we don't have a matching download yet, just skip this progress event.
      return
    }

    state.updateDownload(data.id, {
      progress: data.progress,
      status: data.progress >= 100 ? "completed" : "downloading",
      ...(cleanTitle  ? { title: cleanTitle }   : {}),
      ...(cleanArtist ? { artist: cleanArtist } : {}),
    })
  })

  // ── track completed ────────────────────────────────────────────
  api.onTrackCompleted((data: any) => {
    const state = useSpotgetStore.getState()
    // main.js reads the REAL title/artist from the saved filename (correct even
    // when spotdl's stdout had an empty/garbled title). Apply them here so the
    // card no longer shows the artist in both the title and artist fields.
    const cleanTitle  = data.title  ? cleanStr(data.title)  : ""
    const cleanArtist = data.artist ? cleanStr(data.artist) : ""
    const isGarbage = (s: string) => !s || /^[\-?,\s]+$/.test(s)
    console.log(`[onTrackCompleted] id=${data.id} title="${cleanTitle}" artist="${cleanArtist}" hasArtwork=${!!data.artwork} hasAudioUrl=${!!data.audioUrl}`)
    state.updateDownload(data.id, {
      status: "completed",
      progress: 100,
      ...(!isGarbage(cleanTitle)  ? { title: cleanTitle }   : {}),
      ...(!isGarbage(cleanArtist) ? { artist: cleanArtist } : {}),
      ...(data.artwork ? { artwork: data.artwork } : {}),
      ...(data.audioUrl ? { audioUrl: data.audioUrl } : {}),
      ...(data.filePath ? { filePath: data.filePath } : {}),
      ...(data.fileSize ? { fileSize: data.fileSize } : {}),
      ...(typeof data.fileSizeBytes === "number" ? { fileSizeBytes: data.fileSizeBytes } : {}),
    })
  })

  // ── track skipped ──────────────────────────────────────────────
  api.onTrackSkipped((data: any) => {
    const state = useSpotgetStore.getState()
    // main.js sends title = raw filename (may be "Song - Artist"), artist = "Local File"
    // Parse "Title - Artist" from the filename when artist is the placeholder
    let cleanTitle  = cleanStr(data.title)  || "Unknown Track"
    let cleanArtist = cleanStr(data.artist) || "Local File"
    if (cleanArtist === "Local File") {
      const idx = cleanTitle.indexOf(" - ")
      if (idx > 0) {
        cleanArtist = cleanTitle.substring(idx + 3).trim() || "Local File"
        cleanTitle  = cleanTitle.substring(0, idx).trim()  || "Unknown Track"
      }
    }

    if (!state.downloads.some((d) => d.id === data.id)) {
      const parent = state.downloads.find((d) => d.id === data.parentId)
      state.addDownload({
        id: data.id,
        parentId: data.parentId,
        title: cleanTitle,
        artist: cleanArtist,
        artwork: data.artwork ?? undefined,
        audioUrl: data.audioUrl ?? undefined,
        filePath: data.filePath ?? undefined,
        type: "song",
        url: "",
        platform: parent?.platform || "unknown",
        format: parent?.format   || "mp3",
        bitrate: parent?.bitrate || "320k",
        status: "completed",
        progress: 100,
        fileSize: data.fileSize || "Skipped",
        fileSizeBytes: typeof data.fileSizeBytes === "number" ? data.fileSizeBytes : 0,
        date: new Date().toLocaleDateString(),
        createdAt: Date.now(),
      })
      return
    }

    state.updateDownload(data.id, {
      status: "completed",
      progress: 100,
      fileSize: data.fileSize || "Skipped",
      ...(typeof data.fileSizeBytes === "number" ? { fileSizeBytes: data.fileSizeBytes } : {}),
      ...(data.artwork ? { artwork: data.artwork } : {}),
      ...(data.audioUrl ? { audioUrl: data.audioUrl } : {}),
      ...(data.filePath ? { filePath: data.filePath } : {}),
    })
  })

  // ── total tracks ───────────────────────────────────────────────
  api.onTotalTracks((data: any) => {
    useSpotgetStore.getState().setTotalTracksCount(data.totalTracks)
  })

  // ── stats ───────────────────────────────���──────────────────────
  api.onDownloadStats((data: any) => {
    const state = useSpotgetStore.getState()
    // Clamp completed to total so the ring can never show e.g. 45/42.
    const total = data.totalTracks ?? state.totalTracksCount ?? 0
    const completed = total ? Math.min(data.completedTracks ?? 0, total) : (data.completedTracks ?? 0)
    state.setCompletedTracksCount(completed)
    if (data.totalTracks) state.setTotalTracksCount(data.totalTracks)
    // Keep the parent card's net failure badge in sync (can decrease when the
    // fallback recovers a track). The stats event's `id` is the parent id.
    if (data.id && typeof data.failedTracks === "number") {
      state.updateDownload(data.id, { failedCount: data.failedTracks })
    }
    // Update stats panel counter from backend's actual count
    state.updateStats({ completedDownloads: completed })
  })

  // ── meta: real UTF-8 playlist/album title from Spotify oEmbed ──
  // spotdl's Windows console output loses Cyrillic names; this event carries
  // the correct title fetched directly from Spotify.
  if (api.onDownloadMeta) {
    api.onDownloadMeta((data: any) => {
      const state = useSpotgetStore.getState()
      console.log(`[onDownloadMeta] id=${data.id} title="${data.title}"`)
      if (data.id && data.title) {
        state.updateDownload(data.id, { title: data.title })
      }
    })
  }

  // ── bot-walled: YouTube flagged the IP/session, no cookies imported ──
  if (api.onBotWalled) {
    api.onBotWalled((data: any) => {
      const state = useSpotgetStore.getState()
      console.log(`[onBotWalled] parent=${data.parentId}`)
      const notice =
        "YouTube требует подтверждения аккаунта («Sign in to confirm you're not a bot»). " +
        "Откройте Настройки → «Вход в YouTube» и нажмите «Войти в YouTube» — после входа загрузки заработают."
      if (data.parentId) {
        state.updateDownload(data.parentId, { errorMessage: notice })
      }
      // Also surface it prominently so the user sees it even off the card.
      if (typeof window !== "undefined") {
        setTimeout(() => window.alert(notice), 0)
      }
    })
  }

  // ── track failed: keep an honest failure counter on the parent card ──
  if (api.onTrackFailed) {
    api.onTrackFailed((data: any) => {
      const state = useSpotgetStore.getState()
      console.log(`[onTrackFailed] parent=${data.parentId} failed=${data.failedTracks} reason="${data.reason}"`)
      if (data.parentId) {
        state.updateDownload(data.parentId, {
          failedCount: data.failedTracks,
          errorMessage: data.reason,
        })
      }
    })
  }
}
