"use client"

import { create } from "zustand"
import type { Lang } from "./i18n"

export type PanelType = "download" | "stats" | "history" | "settings" | "player" | "library"
export type DownloadStatus = "pending" | "downloading" | "completed" | "failed" | "cancelled"
export type SpotifyType = "song" | "album" | "playlist" | "artist"
export type AudioFormat = "mp3" | "flac" | "ogg" | "wav"
export type Bitrate = "128k" | "192k" | "256k" | "320k"
export type RepeatMode = "off" | "all" | "one"
export type PlayerView = "mini" | "full" | "lyrics" | "queue" | "eq"
export type Platform = "spotify" | "yandex" | "soundcloud" | "youtube" | "apple" | "unknown"

export interface SubTrack {
  id: string
  title: string
  artist: string
  progress: number
  artwork?: string
}

export interface DownloadItem {
  id: string
  parentId?: string | null;
  title: string
  artist: string
  type: SpotifyType
  url: string
  platform: Platform
  format: AudioFormat
  bitrate: Bitrate
  status: DownloadStatus
  concurrency?: number;
  progress: number
  fileSize: string
  fileSizeBytes?: number
  date: string
  thumbnailUrl?: string
  errorMsg?: string
  createdAt: number
  completedAt?: number
  artwork?: string;
  audioUrl?: string;
  filePath?: string;
  failedCount?: number;
  errorMessage?: string;

  tracks?: SubTrack[]
}

export interface Settings {
  outputDirectory: string
  defaultFormat: AudioFormat
  defaultBitrate: Bitrate
  skipExisting: boolean
  scanThreads: number
  theme: "dark" | "light"
}

export interface Stats {
  totalDownloads: number
  completedDownloads: number
  failedDownloads: number
  totalSize: string
  successRate: number
  averageSpeed: string
  storageUsed: string
}

export interface HistoryFilter {
  search: string
  type: SpotifyType | "all"
  status: DownloadStatus | "all"
  platform: Platform | "all"
}

export interface Track {
  id: string
  title: string
  artist: string
  album: string
  duration: number
  thumbnailUrl: string
  audioUrl?: string
  color?: string
  lyrics?: LyricLine[]
}

export interface LyricLine {
  time: number
  text: string
}

export interface EQPreset {
  name: string
  bands: number[]
}

export interface PlaylistData {
  id: string
  name: string
  description: string
  color: string
  trackIds: string[]
  createdAt: string
}

export function detectPlatform(url: string): Platform {
  const u = url.toLowerCase()
  if (u.includes("spotify.com") || u.includes("open.spotify")) return "spotify"
  if (u.includes("music.yandex") || u.includes("yandex.ru/music") || u.includes("ya.ru/music")) return "yandex"
  if (u.includes("soundcloud.com")) return "soundcloud"
  if (u.includes("music.youtube") || u.includes("youtube.com/music") || u.includes("youtu.be")) return "youtube"
  if (u.includes("music.apple.com") || u.includes("apple.com/music")) return "apple"
  return "unknown"
}

export function getPlatformName(platform: Platform): string {
  const names: Record<Platform, string> = {
    spotify: "Spotify", yandex: "Yandex Music", soundcloud: "SoundCloud",
    youtube: "YouTube Music", apple: "Apple Music", unknown: "Unknown",
  }
  return names[platform]
}

export function getPlatformColor(platform: Platform): string {
  const colors: Record<Platform, string> = {
    spotify: "#1ed760", yandex: "#ffcc00", soundcloud: "#ff5500",
    youtube: "#ff0000", apple: "#fa2d48", unknown: "#888888",
  }
  return colors[platform]
}

function logDownload(action: string, data: any) {
  const timestamp = new Date().toLocaleTimeString("ru-RU", { hour12: false })
  console.log(`[🎵 ${timestamp}] ${action}`, data)
}

function persistHistory(downloads: DownloadItem[]) {
  const toSave = downloads.filter((d) => d.status === "completed" || d.status === "failed")
    .map(d => {
      // Strip only large base64 artwork blobs from electron-store.
      // Small spotget:// file URLs are kept so artwork survives restarts.
      if (d.artwork && d.artwork.startsWith("data:")) {
        const { artwork, ...rest } = d
        return rest
      }
      return d
    })
  if (typeof window !== "undefined" && window.electronAPI) {
    window.electronAPI.setStore("history", toSave)
  }
}

// Mirrors electron/main.js pathToSpotgetUrl — used as a fallback when a
// history item only has filePath (older records) but no audioUrl.
// Uses the dummy "file" host so Chromium's standard-scheme URL normalization
// can't swallow Windows drive letters (spotget:///C:/… → spotget://c/…).
// Fills in every required DownloadItem field with a safe default so records
// persisted by older app versions can never crash the UI at render time.
function sanitizeHistoryItem(it: any): DownloadItem {
  return {
    ...it,
    id: String(it.id),
    parentId: it.parentId ?? null,
    title: typeof it.title === "string" ? it.title : "Unknown",
    artist: typeof it.artist === "string" ? it.artist : "",
    type: it.type ?? "song",
    url: typeof it.url === "string" ? it.url : "",
    platform: it.platform ?? "unknown",
    format: it.format ?? "mp3",
    bitrate: it.bitrate ?? "320k",
    status: it.status ?? "completed",
    progress: typeof it.progress === "number" ? it.progress : 100,
    fileSize: typeof it.fileSize === "string" ? it.fileSize : "—",
    date: typeof it.date === "string" ? it.date : "",
    createdAt: typeof it.createdAt === "number" ? it.createdAt : Date.now(),
    tracks: Array.isArray(it.tracks)
      ? it.tracks.filter((t: any) => t && typeof t === "object" && t.id)
      : undefined,
  }
}

// ── Track duration cache ────────────────────────────────────────────────
// Durations are read from the audio files lazily in the browser (via an
// <audio> element's loadedmetadata event) because the main-process metadata
// parser doesn't decode duration. We cache the results keyed by the stable
// track id (md5 of the file path for imported tracks, the download id for
// downloads) in localStorage so they survive restarts and re-scans.
const DURATION_CACHE_KEY = "spotget:durations"
let _durationCache: Record<string, number> | null = null

function getDurationCache(): Record<string, number> {
  if (_durationCache) return _durationCache
  if (typeof window === "undefined") return {}
  try {
    _durationCache = JSON.parse(localStorage.getItem(DURATION_CACHE_KEY) || "{}") || {}
  } catch {
    _durationCache = {}
  }
  return _durationCache!
}

export function getCachedDuration(id: string): number {
  return getDurationCache()[id] || 0
}

export function setCachedDuration(id: string, duration: number) {
  if (!id || !duration || duration <= 0) return
  const cache = getDurationCache()
  if (cache[id] === duration) return
  cache[id] = duration
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(DURATION_CACHE_KEY, JSON.stringify(cache))
    } catch {}
  }
}

export function filePathToSpotgetUrl(filePath: string): string {
  if (!filePath) return ""
  const normalized = filePath.replace(/\\/g, "/")
  const winMatch = normalized.match(/^([A-Za-z]):(\/.*)$/)
  if (winMatch) {
    const encodedSegments = winMatch[2]
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/")
    return `spotget://file/${winMatch[1]}:${encodedSegments}`
  }
  return `spotget://file/${normalized.split("/").filter(Boolean).map((seg) => encodeURIComponent(seg)).join("/")}`
}

/**
 * Builds playable library Track objects from completed downloads.
 * Only items that actually have an audio file are included (this excludes
 * parent "session" cards which represent the pasted URL, not a real track).
 */
export function buildDownloadedTracks(downloads: DownloadItem[]): Track[] {
  return downloads
    .filter((d) => d.status === "completed" && (d.audioUrl || d.filePath))
    .map((d) => ({
      id: d.id,
      title: d.title,
      artist: d.artist,
      album: "Downloads",
      duration: getCachedDuration(d.id),
      thumbnailUrl: d.artwork || d.thumbnailUrl || "",
      audioUrl: d.audioUrl || (d.filePath ? filePathToSpotgetUrl(d.filePath) : ""),
      filePath: d.filePath || "",
      format: (d.format || "mp3").toUpperCase(),
      color: "#1ed760",
      source: "download",
    })) as Track[]
}

/**
 * The "Imported" library list is simply the audio files scanned from the
 * folder the user chose to import from. That folder is independent of the
 * download folder, so no filtering against downloads is needed — we return
 * the scanned tracks as-is.
 */
export function buildImportedTracks(libraryTracks: any[]): Track[] {
  return (libraryTracks || []).map((t: any) => ({
    ...t,
    duration: t.duration || getCachedDuration(t.id),
  })) as Track[]
}

const defaultEQ: EQPreset = { name: "Flat", bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }

const eqPresets: EQPreset[] = [
  { name: "Flat", bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: "Bass Boost", bands: [8, 6, 4, 2, 0, 0, 0, 0, 0, 0] },
  { name: "Treble Boost", bands: [0, 0, 0, 0, 0, 2, 4, 6, 8, 8] },
  { name: "Rock", bands: [4, 3, 1, 0, -1, 0, 2, 3, 4, 4] },
  { name: "Pop", bands: [-1, 1, 3, 4, 3, 1, -1, -1, 1, 2] },
  { name: "Jazz", bands: [3, 2, 1, 2, 0, -1, 0, 1, 2, 3] },
  { name: "Classical", bands: [4, 3, 2, 1, 0, 0, 0, 1, 3, 4] },
  { name: "Electronic", bands: [6, 5, 2, 0, -2, -1, 1, 3, 5, 5] },
  { name: "Hip Hop", bands: [5, 4, 2, 1, 2, 0, -1, -1, 1, 3] },
  { name: "Vocal", bands: [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1] },
]

const mockDownloads: DownloadItem[] = []
const defaultPlaylists: PlaylistData[] = []

interface SpotgetState {
  lang: Lang
  setLang: (lang: Lang) => void

  activePanel: PanelType
  sidebarOpen: boolean
  setActivePanel: (panel: PanelType) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void

  downloads: DownloadItem[]
  addDownload: (download: DownloadItem) => void
  updateDownload: (id: string, updates: Partial<DownloadItem>) => void
  removeDownload: (id: string) => void
  retryDownload: (id: string) => void

  spotifyUrl: string
  detectedType: SpotifyType | null
  detectedPlatform: Platform
  selectedFormat: AudioFormat
  selectedBitrate: Bitrate
  setSpotifyUrl: (url: string) => void
  setDetectedType: (type: SpotifyType | null) => void
  setSelectedFormat: (format: AudioFormat) => void
  setSelectedBitrate: (bitrate: Bitrate) => void

  historyFilter: HistoryFilter
  setHistoryFilter: (filter: Partial<HistoryFilter>) => void
  clearHistory: () => void
  clearAllData: () => void
  loadHistory: (items: DownloadItem[]) => void
  mergeHistory: (imported: DownloadItem[]) => void

  settings: Settings
  updateSettings: (updates: Partial<Settings>) => void

  getStats: () => Stats


  currentTrack: Track | null
  queue: Track[]
  queueIndex: number
  isPlaying: boolean
  currentTime: number
  volume: number
  isMuted: boolean
  repeatMode: RepeatMode
  isShuffled: boolean
  playerView: PlayerView
  isPlayerOpen: boolean

  playTrack: (track: Track, playlist?: Track[]) => void
  togglePlay: () => void
  pause: () => void
  resume: () => void
  next: () => void
  previous: () => void
  seek: (time: number) => void
  setCurrentTime: (time: number) => void
  updateTrackDuration: (trackId: string, duration: number) => void
  setVolume: (vol: number) => void
  toggleMute: () => void
  toggleRepeat: () => void
  toggleShuffle: () => void
  setPlayerView: (view: PlayerView) => void
  togglePlayerOpen: () => void
  setPlayerOpen: (open: boolean) => void
  addToQueue: (track: Track) => void
  removeFromQueue: (index: number) => void
  clearQueue: () => void
  playFromQueue: (index: number) => void

  eqBands: number[]
  eqPreset: string
  eqPresets: EQPreset[]
  setEqBand: (index: number, value: number) => void
  setEqPreset: (name: string) => void

  playbackSpeed: number
  setPlaybackSpeed: (speed: number) => void

  likedTrackIds: Set<string>
  toggleLike: (id: string) => void
  isLiked: (id: string) => boolean

  libraryTracks: any[]
  libraryFolder: string | null
  loadLibrary: (tracks: any[], folder: string) => void

  totalTracksCount: number | null
  completedTracksCount: number | null
  setTotalTracksCount: (n: number | null) => void
  setCompletedTracksCount: (n: number | null) => void
  isDownloadSessionActive: boolean
  setDownloadSessionActive: (active: boolean) => void
  downloadSessionIds: string[]
  addDownloadSessionId: (id: string) => void
  activeDownloadId: string | null
  setActiveDownloadId: (id: string | null) => void

  playlists: PlaylistData[]
  addPlaylist: (name: string, description?: string, color?: string) => string
  updatePlaylist: (id: string, updates: Partial<Pick<PlaylistData, "name" | "description" | "color">>) => void
  deletePlaylist: (id: string) => void
  addTrackToPlaylist: (playlistId: string, trackId: string) => void
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void
  getPlaylistTracks: (playlistId: string) => Track[]
  playPlaylist: (playlistId: string) => void

  stats: Stats // Добавляем состояние stats
  updateStats: (updates: Partial<Stats>) => void // Функция для обновления статистики
  clearDownloadSessionIds: () => void // Функция для очистки сессии
}

// Persist volume/mute in localStorage so the player never blasts at full
// volume after a restart.
function loadSavedVolume(): { volume: number; isMuted: boolean } {
  try {
    if (typeof window !== "undefined") {
      const v = JSON.parse(localStorage.getItem("spot-volume") || "null")
      if (v && typeof v.volume === "number" && isFinite(v.volume)) {
        return { volume: Math.max(0, Math.min(1, v.volume)), isMuted: !!v.isMuted }
      }
    }
  } catch {}
  return { volume: 0.75, isMuted: false }
}
const savedVolume = loadSavedVolume()

function persistVolume(volume: number, isMuted: boolean) {
  try { localStorage.setItem("spot-volume", JSON.stringify({ volume, isMuted })) } catch {}
}

export const useSpotgetStore = create<SpotgetState>((set, get) => ({
  lang: "en",
  setLang: (lang) => {
    set({ lang })
    if (typeof window !== "undefined" && window.electronAPI) {
      window.electronAPI.setStore("lang", lang)
    }
  },

  activePanel: "download",
  sidebarOpen: false,
  setActivePanel: (panel) => set({ activePanel: panel, sidebarOpen: false }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  downloads: mockDownloads,
  addDownload: (download) =>
    set((s) => {
      if (s.downloads.some((d) => d.id === download.id)) {
        logDownload("⚠️ addDownload skipped (duplicate id)", { id: download.id })
        return {}
      }
      const downloadWithTimestamp = { ...download, createdAt: Date.now(), tracks: download.tracks || [] }
      logDownload("➕ addDownload", { id: download.id, title: download.title, status: download.status })
      const newDownloads = [downloadWithTimestamp, ...s.downloads]
      persistHistory(newDownloads)
      return { downloads: newDownloads }
    }),
  updateDownload: (id, updates) =>
    set((s) => {
      const oldItem = s.downloads.find((d) => d.id === id)
      const newDownloads = s.downloads.map((d) =>
        d.id === id
          ? {
              ...d,
              ...updates,
              ...(updates.status === "completed" && d.status !== "completed" ? { completedAt: Date.now() } : {}),
            }
          : d
      )
      const newItem = newDownloads.find((d) => d.id === id)
      logDownload("🔄 updateDownload", {
        id,
        oldStatus: oldItem?.status,
        newStatus: newItem?.status,
        oldProgress: oldItem?.progress,
        newProgress: newItem?.progress,
        title: newItem?.title,
      })
      persistHistory(newDownloads)
      return { downloads: newDownloads }
    }),
  removeDownload: (id) =>
    set((s) => {
      logDownload("🗑️ removeDownload", { id })
      const newDownloads = s.downloads.filter((d) => d.id !== id)
      persistHistory(newDownloads)
      return { downloads: newDownloads }
    }),
  retryDownload: (id) =>
    set((s) => {
      logDownload("🔄 retryDownload", { id })
      const newDownloads = s.downloads.map((d) =>
        d.id === id ? { ...d, status: "pending" as const, progress: 0, createdAt: Date.now() } : d
      )
      persistHistory(newDownloads)
      return { downloads: newDownloads }
    }),

  spotifyUrl: "",
  detectedType: null,
  detectedPlatform: "unknown" as Platform,
  selectedFormat: "mp3",
  selectedBitrate: "320k",
  setSpotifyUrl: (url) => {
    let detectedType: SpotifyType | null = null
    const detectedPlatform = detectPlatform(url)
    const u = url.toLowerCase()
    if (
      u.includes("/track/") ||
      u.includes("/song/") ||
      u.includes("/watch") ||
      u.includes("/tracks/") ||
      (u.includes("/album/") && u.includes("track"))
    ) {
      detectedType = "song"
    }
    if (u.includes("/album/") || u.includes("/release/")) {
      detectedType = "album"
    }
    if (u.includes("/playlist/") || u.includes("/sets/") || u.includes("/playlists/") || u.includes("/collection/")) {
      detectedType = "playlist"
    }
    if (u.includes("/artist/") || u.includes("/user/") || u.includes("/channel/")) {
      detectedType = "artist"
    }
    if (!detectedType && detectedPlatform !== "unknown") {
      detectedType = "song"
    }
    set({ spotifyUrl: url, detectedType, detectedPlatform })
  },
  setDetectedType: (type) => set({ detectedType: type }),
  setSelectedFormat: (format) => set({ selectedFormat: format }),
  setSelectedBitrate: (bitrate) => set({ selectedBitrate: bitrate }),

  historyFilter: { search: "", type: "all", status: "all", platform: "all" },
  setHistoryFilter: (filter) => set((s) => ({ historyFilter: { ...s.historyFilter, ...filter } })),
  clearHistory: () =>
    set((s) => {
      const newDownloads = s.downloads.filter((d) => d.status === "downloading" || d.status === "pending")
      persistHistory(newDownloads)
      return { downloads: newDownloads }
    }),
  clearAllData: () => {
    logDownload("🧹 clearAllData", {})
    set({
      downloads: [],
      playlists: [],
      likedTrackIds: new Set<string>(),
      queue: [],
      queueIndex: 0,
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      isPlayerOpen: false,
      totalTracksCount: null,
      completedTracksCount: null,
      isDownloadSessionActive: false,
      downloadSessionIds: [],
      activeDownloadId: null,
      historyFilter: { search: "", type: "all", status: "all", platform: "all" },
      stats: {
        totalDownloads: 0,
        completedDownloads: 0,
        failedDownloads: 0,
        totalSize: "0.0 MB",
        successRate: 0,
        averageSpeed: "0.0 MB/s",
        storageUsed: "0.0 MB",
      },
    })
    if (typeof window !== "undefined" && window.electronAPI) {
      window.electronAPI.setStore("history", [])
    }
  },
  loadHistory: (items: DownloadItem[]) =>
    set((s) => ({
      // Sanitize every persisted record: electron-store data can come from
      // older app versions with missing fields. One malformed item used to
      // crash the render, and Next dev responds to render errors with a full
      // page reload → infinite reload loop in Electron.
      downloads: [
        ...(Array.isArray(items) ? items : [])
          .filter((it) => it && typeof it === "object" && it.id)
          .map((it) => sanitizeHistoryItem(it)),
        ...s.downloads.filter((d) => d.status === "downloading" || d.status === "pending"),
      ],
    })),
  mergeHistory: (imported: DownloadItem[]) =>
    set((s) => {
      const existingIds = new Set(s.downloads.map((d) => d.id))
      const newItems = (Array.isArray(imported) ? imported : [])
        .filter((d) => d && typeof d === "object" && d.id && !existingIds.has(d.id))
        .map((d) => sanitizeHistoryItem(d))
      const merged = [...newItems, ...s.downloads]
      persistHistory(merged)
      return { downloads: merged }
    }),

  settings: {
    outputDirectory: "",
    defaultFormat: "mp3",
    defaultBitrate: "320k",
    skipExisting: true,
    scanThreads: 4,
    theme: "dark",
  },
  updateSettings: (updates) =>
    set((s) => {
      const newSettings = { ...s.settings, ...updates }
      if (typeof window !== "undefined" && window.electronAPI) {
        window.electronAPI.setStore("settings", newSettings)
      }
      return { settings: newSettings }
    }),

  getStats: () => {
    const downloads = get().downloads
    // Count only individual TRACK rows, not the parent playlist/album/artist
    // cards (those are containers, not files). A parent is any row that has
    // sub-tracks pointing at it. This fixes the inflated totals and the wrong
    // success rate (previously parents were counted as downloads too).
    const parentIds = new Set(downloads.filter((d) => d.parentId).map((d) => d.parentId))
    const isTrackRow = (d: DownloadItem) => !parentIds.has(d.id)
    const trackRows = downloads.filter(isTrackRow)

    const completed = trackRows.filter((d) => d.status === "completed")
    const failed = trackRows.filter((d) => d.status === "failed")

    // Prefer exact byte sizes; fall back to parsing the "12.3 MB" string.
    const totalBytes = completed.reduce((acc, d) => {
      if (typeof d.fileSizeBytes === "number" && d.fileSizeBytes > 0) return acc + d.fileSizeBytes
      const m = (d.fileSize || "").match(/([\d.]+)\s*MB/i)
      return acc + (m ? parseFloat(m[1]) * 1024 * 1024 : 0)
    }, 0)
    const fmtSize = (bytes: number) => {
      if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
      return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    }
    const sizeStr = fmtSize(totalBytes)
    const finished = completed.length + failed.length

    return {
      totalDownloads: trackRows.length,
      completedDownloads: completed.length,
      failedDownloads: failed.length,
      totalSize: sizeStr,
      successRate: finished > 0 ? Math.round((completed.length / finished) * 100) : 0,
      averageSpeed: "—",
      storageUsed: sizeStr,
    }
  },

  stats: {
    totalDownloads: 0,
    completedDownloads: 0,
    failedDownloads: 0,
    totalSize: "0.0 MB",
    successRate: 0,
    averageSpeed: "0.0 MB/s",
    storageUsed: "0.0 MB",
  },
  updateStats: (updates) =>
    set((s) => ({
      stats: { ...s.stats, ...updates },
    })),

  // Добавьте это рядом с addDownloadSessionId
  clearDownloadSessionIds: () => {
    logDownload("🆔 clearDownloadSessionIds", {})
    set({ downloadSessionIds: [] })
  },

  currentTrack: null,
  queue: [],
  queueIndex: 0,
  isPlaying: false,
  currentTime: 0,
  volume: savedVolume.volume,
  isMuted: savedVolume.isMuted,
  repeatMode: "off",
  isShuffled: false,
  playerView: "mini",
  isPlayerOpen: false,

  playTrack: (track, playlist) =>
    set((s) => {
      const queue = playlist && playlist.length > 0 ? playlist : s.queue.length > 0 ? s.queue : [track]
      const index = queue.findIndex((t) => t.id === track.id)
      return {
        currentTrack: track,
        queue,
        queueIndex: index >= 0 ? index : 0,
        isPlaying: true,
        currentTime: 0,
        isPlayerOpen: true,
        playerView: "full" as const,
      }
    }),

  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  pause: () => set({ isPlaying: false }),
  resume: () => set({ isPlaying: true }),

  next: () =>
    set((s) => {
      if (s.queue.length === 0) return {}
      let nextIndex: number
      if (s.repeatMode === "one") {
        nextIndex = s.queueIndex
      } else if (s.isShuffled) {
        nextIndex = Math.floor(Math.random() * s.queue.length)
        while (nextIndex === s.queueIndex && s.queue.length > 1) {
          nextIndex = Math.floor(Math.random() * s.queue.length)
        }
      } else {
        nextIndex = s.queueIndex + 1
        if (nextIndex >= s.queue.length) {
          if (s.repeatMode === "all") {
            nextIndex = 0
          } else {
            return { isPlaying: false }
          }
        }
      }
      return { queueIndex: nextIndex, currentTrack: s.queue[nextIndex], currentTime: 0, isPlaying: true }
    }),

  previous: () =>
    set((s) => {
      if (s.queue.length === 0) return {}
      if (s.currentTime > 3) {
        return { currentTime: 0 }
      }
      let prevIndex = s.queueIndex - 1
      if (prevIndex < 0) {
        prevIndex = s.repeatMode === "all" ? s.queue.length - 1 : 0
      }
      return { queueIndex: prevIndex, currentTrack: s.queue[prevIndex], currentTime: 0, isPlaying: true }
    }),

  seek: (time) => set({ currentTime: time }),
  setCurrentTime: (time) => set({ currentTime: time }),
  updateTrackDuration: (trackId, duration) => {
    setCachedDuration(trackId, duration)
    set((s) => ({
      currentTrack: s.currentTrack?.id === trackId ? { ...s.currentTrack, duration } : s.currentTrack,
      libraryTracks: s.libraryTracks.map((t) => (t.id === trackId ? { ...t, duration } : t)),
      queue: s.queue.map((t) => (t.id === trackId ? { ...t, duration } : t)),
    }))
  },

  setVolume: (vol) => {
    const v = Math.max(0, Math.min(1, vol))
    persistVolume(v, false)
    set({ volume: v, isMuted: false })
  },
  toggleMute: () =>
    set((s) => {
      persistVolume(s.volume, !s.isMuted)
      return { isMuted: !s.isMuted }
    }),
  toggleRepeat: () =>
    set((s) => {
      const modes: RepeatMode[] = ["off", "all", "one"]
      const idx = modes.indexOf(s.repeatMode)
      return { repeatMode: modes[(idx + 1) % modes.length] }
    }),
  toggleShuffle: () => set((s) => ({ isShuffled: !s.isShuffled })),

  setPlayerView: (view) => set({ playerView: view }),
  togglePlayerOpen: () =>
    set((s) => ({
      isPlayerOpen: !s.isPlayerOpen,
      ...(!s.isPlayerOpen ? { playerView: "full" as const } : {}),
    })),
  setPlayerOpen: (open) => set({ isPlayerOpen: open, ...(open ? { playerView: "full" as const } : {}) }),

  addToQueue: (track) => set((s) => ({ queue: [...s.queue, track] })),
  removeFromQueue: (index) =>
    set((s) => {
      const newQueue = s.queue.filter((_, i) => i !== index)
      let newIndex = s.queueIndex
      if (index < s.queueIndex) newIndex--
      if (newIndex < 0) newIndex = 0
      if (newIndex >= newQueue.length && newQueue.length > 0) newIndex = newQueue.length - 1
      return { queue: newQueue, queueIndex: newIndex, currentTrack: newQueue[newIndex] || null }
    }),
  clearQueue: () => set({ queue: [], queueIndex: 0 }),
  playFromQueue: (index) =>
    set((s) => ({
      queueIndex: index,
      currentTrack: s.queue[index],
      isPlaying: true,
      currentTime: 0,
    })),

  eqBands: defaultEQ.bands,
  eqPreset: defaultEQ.name,
  eqPresets,
  setEqBand: (index, value) =>
    set((s) => {
      const bands = [...s.eqBands]
      bands[index] = value
      return { eqBands: bands, eqPreset: "Custom" }
    }),
  setEqPreset: (name) =>
    set((s) => {
      const preset = s.eqPresets.find((p) => p.name === name)
      if (preset) return { eqBands: [...preset.bands], eqPreset: name }
      return {}
    }),

  playbackSpeed: 1,
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

  likedTrackIds: new Set<string>(),
  toggleLike: (id) =>
    set((s) => {
      const newSet = new Set(s.likedTrackIds)
      if (newSet.has(id)) newSet.delete(id)
      else newSet.add(id)
      return { likedTrackIds: newSet }
    }),
  isLiked: (id) => get().likedTrackIds.has(id),

  libraryTracks: [],
  libraryFolder: null,
  loadLibrary: (tracks, folder) => set({ libraryTracks: tracks, libraryFolder: folder }),

  totalTracksCount: null,
  completedTracksCount: null,
  setTotalTracksCount: (n) => {
    logDownload("📊 setTotalTracksCount", { total: n })
    set({ totalTracksCount: n })
  },
  setCompletedTracksCount: (n) => {
    logDownload("📊 setCompletedTracksCount", { completed: n })
    set({ completedTracksCount: n })
  },
  isDownloadSessionActive: false,
  setDownloadSessionActive: (active) => {
    logDownload("🎯 setDownloadSessionActive", { active })
    set({ isDownloadSessionActive: active })
  },
  downloadSessionIds: [],
  addDownloadSessionId: (id) =>
    set((s) => {
      if (s.downloadSessionIds.includes(id)) return {}
      logDownload("🆔 addDownloadSessionId", { id, allIds: [...s.downloadSessionIds, id] })
      return { downloadSessionIds: [...s.downloadSessionIds, id] }
    }),
  activeDownloadId: null,
  setActiveDownloadId: (id) => {
    logDownload("🎯 setActiveDownloadId", { id })
    set({ activeDownloadId: id })
  },

  playlists: defaultPlaylists,
  addPlaylist: (name, description, color) => {
    const id = `pl_${Date.now()}`
    const playlist: PlaylistData = {
      id, name, description: description || "",
      color: color || "#1ed760", trackIds: [],
      createdAt: new Date().toISOString().split("T")[0],
    }
    set((s) => ({ playlists: [...s.playlists, playlist] }))
    return id
  },
  updatePlaylist: (id, updates) =>
    set((s) => ({
      playlists: s.playlists.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),
  deletePlaylist: (id) =>
    set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) })),
  addTrackToPlaylist: (playlistId, trackId) =>
    set((s) => ({
      playlists: s.playlists.map((p) =>
        p.id === playlistId && !p.trackIds.includes(trackId)
          ? { ...p, trackIds: [...p.trackIds, trackId] }
          : p
      ),
    })),
  removeTrackFromPlaylist: (playlistId, trackId) =>
    set((s) => ({
      playlists: s.playlists.map((p) =>
        p.id === playlistId ? { ...p, trackIds: p.trackIds.filter((id) => id !== trackId) } : p
      ),
    })),
  getPlaylistTracks: (playlistId) => {
    const playlist = get().playlists.find((p) => p.id === playlistId)
    if (!playlist) return []
    // Search both imported library tracks and downloaded tracks
    const allTracks = [...get().libraryTracks, ...buildDownloadedTracks(get().downloads)]
    return playlist.trackIds
      .map((tid) => allTracks.find((t) => t.id === tid))
      .filter(Boolean) as Track[]
  },
  playPlaylist: (playlistId) => {
    const playlist = get().playlists.find((p) => p.id === playlistId)
    if (!playlist || playlist.trackIds.length === 0) return
    // Search both imported library tracks and downloaded tracks
    const allTracks = [...get().libraryTracks, ...buildDownloadedTracks(get().downloads)]
    const tracks = playlist.trackIds
      .map((tid) => allTracks.find((t) => t.id === tid))
      .filter(Boolean) as Track[]
    if (tracks.length > 0) {
      set({
        queue: tracks,
        queueIndex: 0,
        currentTrack: tracks[0],
        isPlaying: true,
        currentTime: 0,
      })
    }
  },
}))


export { eqPresets, defaultEQ }
