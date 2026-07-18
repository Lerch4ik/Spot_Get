"use client"

import { useState, useEffect, useRef, CSSProperties } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Download, CheckCircle2, XCircle, HardDrive, Clipboard,
  Music2, ArrowDown, Loader2, Zap, TrendingUp, Square, Trash2
} from "lucide-react"
import {
  useSpotgetStore,
  detectPlatform,
  getPlatformName,
  getPlatformColor,
  type Platform,
} from "@/lib/store"
import { translations } from "@/lib/i18n"
import { FormatChipSelect, BitrateChipSelect } from "./ChipSelect"
import { initIpcBridge } from "@/lib/ipc-bridge"
import { GlowButton } from "./GlowButton"
import { DownloadCard } from "./DownloadCard"
import { StatCard } from "./StatCard"

// ── Platform icons ──────────────────────────────────────────────
function SpotifyIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  )
}

function YandexIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm1.8 17.4H11.4V9.001l-2.4.899V7.8l4.8-1.8v11.4z"/>
    </svg>
  )
}

function SoundCloudIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.56 8.87V17h8.76c1.03 0 1.68-.67 1.68-1.56 0-.8-.57-1.47-1.37-1.55v-.04c.1-.28.15-.58.15-.89 0-1.48-1.2-2.68-2.68-2.68-.23 0-.46.03-.67.08C16.93 9.08 15.77 8 14.37 8c-.96 0-1.81.47-2.33 1.19-.13-.2-.28-.32-.48-.32zM0 14.84c0 1.2.97 2.16 2.16 2.16S4.32 16.04 4.32 14.84c0-.9-.54-1.67-1.32-2.01V8.64a.84.84 0 0 0-1.68 0v4.19C.54 13.17 0 13.94 0 14.84zM5.52 17V9.6a.84.84 0 0 0-1.68 0V17h1.68zm2.16 0V8.16a.84.84 0 0 0-1.68 0V17h1.68zm2.16 0V9.6a.84.84 0 0 0-1.68 0V17h1.68z"/>
    </svg>
  )
}

function YouTubeIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.507a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.507 9.388.507 9.388.507s7.517 0 9.388-.507a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  )
}

function AppleMusicIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 6.628 5.374 12 12 12 6.628 0 12-5.372 12-12 0-6.627-5.372-12-12-12zm3.022 6.75l-4.5 1.286v5.606c-.332-.089-.68-.136-1.04-.136-1.55 0-2.816 1.01-2.816 2.254 0 1.245 1.266 2.254 2.816 2.254 1.55 0 2.816-1.009 2.816-2.254V9.53l3-0.857V6.75h-.276z"/>
    </svg>
  )
}

export function PlatformIcon({
  platform,
  className,
  style,
}: {
  platform: Platform
  className?: string
  style?: CSSProperties
}) {
  switch (platform) {
    case "spotify":    return <SpotifyIcon    className={className} style={style} />
    case "yandex":     return <YandexIcon     className={className} style={style} />
    case "soundcloud": return <SoundCloudIcon className={className} style={style} />
    case "youtube":    return <YouTubeIcon    className={className} style={style} />
    case "apple":      return <AppleMusicIcon className={className} style={style} />
    default:           return <HardDrive      className={className} style={style} />
  }
}

function detectPlatformFromUrl(url: string): Platform {
  const u = url.toLowerCase()
  if (u.includes("spotify.com") || u.includes("open.spotify")) return "spotify"
  if (u.includes("music.yandex") || u.includes("yandex.ru/music")) return "yandex"
  if (u.includes("soundcloud.com")) return "soundcloud"
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube"
  if (u.includes("music.apple.com")) return "apple"
  return "unknown"
}

// ── Mini progress ring for session ──────────────────────────────
function ProgressRing({ progress, color }: { progress: number; color: string }) {
  const r = 16
  const circ = 2 * Math.PI * r
  const dash = circ * (progress / 100)
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className="rotate-[-90deg]">
      <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
      <circle
        cx="20" cy="20" r={r} fill="none"
        stroke={color} strokeWidth="3"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.4s ease" }}
      />
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────
export function DownloadPanel() {
  const {
    lang, downloads, addDownload, updateDownload, removeDownload,
    stats, updateStats, clearAllData,
    isDownloadSessionActive, setDownloadSessionActive,
    addDownloadSessionId, clearDownloadSessionIds,
    totalTracksCount, setTotalTracksCount,
    completedTracksCount, setCompletedTracksCount,
    settings,
  } = useSpotgetStore()

  const [url, setUrl]             = useState("")
  const [format, setFormat]       = useState<any>(settings.defaultFormat || "mp3")
  const [bitrate, setBitrate]     = useState<any>(settings.defaultBitrate || "320k")
  const [preparing, setPreparing] = useState(false)
  const [platform, setPlatform]   = useState<Platform>("unknown")
  const [pasted, setPasted]       = useState(false)

  const t = translations[lang]

  const handleUrlChange = (val: string) => {
    setUrl(val)
    setPlatform(detectPlatformFromUrl(val))
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      handleUrlChange(text)
      setPasted(true)
      setTimeout(() => setPasted(false), 1500)
    } catch {}
  }

  // ── IPC listeners — SINGLE source of truth (store.ts bottom block removed) ──
  // ── IPC bridge — singleton, survives panel unmounts ────────────────
  useEffect(() => { initIpcBridge() }, [])

  // Follow the default format/bitrate configured in Settings. These change
  // only when the user edits them in the Settings panel, so mirroring them
  // here gives new downloads the chosen defaults.
  useEffect(() => {
    if (settings.defaultFormat) setFormat(settings.defaultFormat)
  }, [settings.defaultFormat])
  useEffect(() => {
    if (settings.defaultBitrate) setBitrate(settings.defaultBitrate)
  }, [settings.defaultBitrate])


  const handleStart = async () => {
    if (!url) return
    setPreparing(true)

    const parentId = `dl-${Date.now()}`
    clearDownloadSessionIds()
    setTotalTracksCount(null)
    setCompletedTracksCount(null)
    setDownloadSessionActive(true)
    addDownloadSessionId(parentId)

    addDownload({
      id: parentId,
      title: url.length > 40 ? url.slice(0, 40) + "…" : url,
      artist: getPlatformName(platform),
      type: "song",
      url,
      platform,
      format,
      bitrate,
      status: "pending",
      progress: 0,
      fileSize: "—",
      date: new Date().toLocaleDateString(),
      createdAt: Date.now(),
    })

    const api = (window as any).electronAPI
    if (!api) {
      setPreparing(false)
      updateDownload(parentId, { status: "failed", progress: 0, errorMsg: "No IPC bridge" })
      setDownloadSessionActive(false)
      return
    }

    try {
      const result = await api.startDownload({ id: parentId, url, format, bitrate, concurrency: 4 })
      setPreparing(false)
      setUrl("")
      setPlatform("unknown")

      if (result.success) {
        setTimeout(() => {
          const store = useSpotgetStore.getState()
          const stillActive = store.downloads.some(
            (d) => d.id !== parentId && (d.status === "downloading" || d.status === "pending")
          )
          if (stillActive) store.removeDownload(parentId)
          else store.updateDownload(parentId, { status: "completed", progress: 100, fileSize: result.fileSize || "—" })
        }, 500)
      } else if (result.cancelled) {
        useSpotgetStore.getState().updateDownload(parentId, { status: "cancelled", progress: 0 })
      } else {
        useSpotgetStore.getState().updateDownload(parentId, {
          status: "failed", progress: 0, errorMsg: result?.error || "Unknown Error",
        })
      }
    } catch (err: any) {
      setPreparing(false)
      updateDownload(parentId, { status: "failed", progress: 0, errorMsg: err.message })
    } finally {
      setDownloadSessionActive(false)
    }
  }

  const handleStopAll = async () => {
    const api = (window as any).electronAPI
    if (!api) return
    // Cancel every active download in the store
    const state = useSpotgetStore.getState()
    const activeIds = state.downloads
      .filter((d) => d.status === "downloading" || d.status === "pending")
      .map((d) => d.id)
    // Send one cancel-all IPC call
    await api.cancelAllDownloads?.()
    // Also mark each in store immediately so UI updates instantly
    for (const id of activeIds) {
      state.updateDownload(id, { status: "cancelled", progress: 0 })
    }
    state.setDownloadSessionActive(false)
    setPreparing(false)
  }

  const activeDownloads = downloads.filter(
    (d) => d.status === "downloading" || d.status === "pending"
  )
  const completedDownloads = downloads.filter((d) => d.status === "completed")
  const activeCount  = activeDownloads.length
  const platformColor = getPlatformColor(platform)

  // Real, track-level stats for the footer cards (excludes parent containers,
  // uses byte-accurate storage). Recomputed from the live downloads list.
  const footerStats = useSpotgetStore.getState().getStats()

  // Session progress (clamp completed to total so the ring/label can never
  // show more downloaded than found, e.g. 45/42).
  const shownCompleted = totalTracksCount && completedTracksCount !== null
    ? Math.min(completedTracksCount, totalTracksCount)
    : completedTracksCount
  const sessionProgress = totalTracksCount && completedTracksCount !== null
    ? Math.round((Math.min(completedTracksCount, totalTracksCount) / totalTracksCount) * 100)
    : 0

  // Aggregate failed-track count across active parent downloads (honest counter:
  // spotdl counts failures as "complete", but we track real failures separately)
  const sessionFailedCount = downloads
    .filter((d) => !d.parentId && (d.failedCount ?? 0) > 0)
    .reduce((sum, d) => sum + (d.failedCount ?? 0), 0)

  // Group sub-tracks by their parent download id
  const subTracksMap = new Map<string, typeof downloads>()
  for (const d of downloads) {
    if (d.parentId) {
      if (!subTracksMap.has(d.parentId)) subTracksMap.set(d.parentId, [])
      subTracksMap.get(d.parentId)!.push(d)
    }
  }

  // Show parent downloads only (sub-tracks are rendered inside the parent card).
  // Orphaned sub-tracks (whose parent card was removed, e.g. after a finished
  // session or app restart) are promoted to top-level so downloaded files
  // never disappear from the list.
  const existingIds = new Set(downloads.map((d) => d.id))
  const visibleDownloads = downloads.filter((d) => {
    if (d.parentId && existingIds.has(d.parentId)) return false
    return true
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 pb-10 items-start">

      {/* ── Main column ──────────────────────────────────────────── */}
      <div className="space-y-4 min-w-0">

      {/* ── URL Input card ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="rounded-2xl border border-white/[0.07] overflow-hidden backdrop-blur-xl"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.02) 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.35)",
        }}
      >
        {/* Header strip */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(30,215,96,0.12)", border: "1px solid rgba(30,215,96,0.2)" }}
            >
              <Download className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-[13px] font-bold text-white leading-tight">{t.downloadMusic}</h2>
              <p className="text-[10px] text-white/30 leading-none mt-0.5">{t.pasteUrlHelp}</p>
            </div>
          </div>

          {/* Session progress badge */}
          {isDownloadSessionActive && totalTracksCount && (
            <div className="flex items-center gap-2">
              <ProgressRing progress={sessionProgress} color="#1ed760" />
              <div className="text-right">
                <p className="text-[11px] font-bold text-primary leading-tight">
                  {shownCompleted ?? 0} / {totalTracksCount}
                </p>
                <p className="text-[10px] text-white/30 leading-none">{lang === 'ru' ? 'треков' : 'tracks'}</p>
                {sessionFailedCount > 0 && (
                  <p className="text-[10px] font-semibold text-destructive leading-none mt-0.5">
                    {sessionFailedCount} {lang === 'ru' ? 'ошибок' : 'failed'}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* URL input area */}
        <div className="px-5 pb-4 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                {platform !== "unknown" && url ? (
                  <PlatformIcon platform={platform} className="w-4 h-4" style={{ color: platformColor }} />
                ) : (
                  <Music2 className="w-4 h-4 text-white/20" />
                )}
              </div>
              <input
                type="text"
                placeholder={t.placeholderUrl}
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !preparing && url && handleStart()}
                disabled={preparing}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder:text-white/20 transition-all outline-none"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: url && platform !== "unknown"
                    ? `1px solid ${platformColor}40`
                    : "1px solid rgba(255,255,255,0.08)",
                  boxShadow: url && platform !== "unknown"
                    ? `0 0 0 3px ${platformColor}10`
                    : "none",
                }}
              />
            </div>

            {/* Paste */}
            <button
              type="button"
              onClick={handlePaste}
              title={lang === 'ru' ? 'Вставить из буфера' : 'Paste from clipboard'}
              className="w-10 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-white/40 hover:text-white transition-colors"
            >
              <AnimatePresence mode="wait">
                {pasted ? (
                  <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  </motion.span>
                ) : (
                  <motion.span key="clip" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                    <Clipboard className="w-4 h-4" />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>

            {/* Download */}
            <GlowButton
              onClick={handleStart}
              disabled={preparing || !url || isDownloadSessionActive}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 min-w-[120px] justify-center"
            >
              {preparing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {lang === 'ru' ? 'Подготовка…' : 'Preparing…'}
                </>
              ) : (
                <>
                  <ArrowDown className="w-4 h-4" />
                  {t.download}
                </>
              )}
            </GlowButton>

            {/* Stop all button — visible only during active session */}
            {isDownloadSessionActive && (
              <motion.button
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.93 }}
                onClick={handleStopAll}
                type="button"
                title={lang === 'ru' ? 'Остановить все загрузки' : 'Stop all downloads'}
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                style={{
                  background: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "rgba(239,68,68,0.9)",
                }}
              >
                <Square className="w-4 h-4" fill="currentColor" />
              </motion.button>
            )}
          </div>

          {/* Format & Bitrate */}
          <div
            className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 pt-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            <FormatChipSelect
              value={format}
              onChange={setFormat}
              options={["mp3", "flac", "ogg", "wav"]}
              label={lang === 'ru' ? 'Формат' : 'Format'}
            />
            <BitrateChipSelect
              value={bitrate}
              onChange={setBitrate}
              options={["128k", "192k", "256k", "320k"]}
              label={lang === 'ru' ? 'Битрейт' : 'Bitrate'}
            />
          </div>
        </div>
      </motion.div>

      {/* ── Active downloads list ─────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut", delay: 0.07 }}
        className="rounded-2xl overflow-hidden backdrop-blur-xl"
        style={{
          background: "rgba(255,255,255,0.022)",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <Zap className="w-3.5 h-3.5 text-white/50" />
            </div>
            <div>
              <span className="text-[13px] font-bold text-white/80 leading-tight block">
                {t.downloadedFiles || "Загруженные файлы"}
              </span>
              {visibleDownloads.length > 0 && (
                <span className="text-[10px] text-white/25 leading-none">
                  {visibleDownloads.length} {t.tracks || "треков"}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
                style={{
                  background: "rgba(30,215,96,0.1)",
                  border: "1px solid rgba(30,215,96,0.22)",
                  color: "#1ed760",
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#1ed760] animate-pulse" />
                {activeCount} {lang === 'ru' ? 'активных' : 'active'}
              </div>
            )}
            {completedDownloads.length > 0 && activeCount === 0 && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                <CheckCircle2 className="w-3 h-3" />
                {completedDownloads.length} {lang === 'ru' ? 'завершено' : 'completed'}
              </div>
            )}
            {downloads.length > 0 && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => {
                  if (confirm(lang === 'ru'
                    ? 'Очистить всё? Это удалит все загрузки, историю, плейлисты и избранное.'
                    : 'Clear everything? This removes all downloads, history, playlists and liked songs.')) {
                    clearAllData()
                  }
                }}
                title={lang === 'ru' ? 'Очистить всё' : 'Clear all'}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors"
                style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.22)",
                  color: "rgba(239,68,68,0.85)",
                }}
              >
                <Trash2 className="w-3 h-3" />
                {lang === 'ru' ? 'Очистить всё' : 'Clear all'}
              </motion.button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="p-2 space-y-1.5 max-h-[480px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <AnimatePresence initial={false}>
            {visibleDownloads.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-14 text-center gap-4"
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, rgba(30,215,96,0.06), rgba(30,215,96,0.02))",
                    border: "1px solid rgba(30,215,96,0.12)",
                  }}
                >
                  <Music2 className="w-7 h-7 text-primary/40" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-white/25">{t.noDownloadsYet || "Нет загрузок"}</p>
                  <p className="text-[11px] text-white/15 mt-1.5 leading-relaxed max-w-[200px] mx-auto">
                    {t.pasteUrlHelp}
                  </p>
                </div>
              </motion.div>
            ) : (
              [...visibleDownloads]
                .sort((a, b) => {
                  // Active (downloading/pending) items first
                  const aActive = a.status === "downloading" || a.status === "pending"
                  const bActive = b.status === "downloading" || b.status === "pending"
                  if (aActive && !bActive) return -1
                  if (!aActive && bActive) return 1
                  // Within same status group: newest first
                  return (b.createdAt || 0) - (a.createdAt || 0)
                })
                .map((item) => (
                  <DownloadCard
                    key={item.id}
                    download={item}
                    subTracks={subTracksMap.get(item.id) || []}
                    onCancel={(id) => updateDownload(id, { status: "cancelled", progress: 0 })}
                  />
                ))
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── Stats row ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut", delay: 0.14 }}
        className="grid grid-cols-2 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))] gap-3"
      >
        <StatCard title={lang === 'ru' ? 'Всего' : 'Total'}      value={footerStats.totalDownloads}     icon={<Download     className="w-4 h-4" />} />
        <StatCard title={lang === 'ru' ? 'Завершено' : 'Done'}  value={footerStats.completedDownloads} icon={<CheckCircle2 className="w-4 h-4" />} />
        <StatCard title={lang === 'ru' ? 'Ошибки' : 'Errors'}   value={footerStats.failedDownloads}    icon={<XCircle      className="w-4 h-4" />} />
        <StatCard title={lang === 'ru' ? 'Хранилище' : 'Storage'}  value={footerStats.storageUsed || '—'}  icon={<HardDrive    className="w-4 h-4" />} />
      </motion.div>
      </div>{/* end main column */}

      {/* ── Right rail ───────────────────────────────────────────── */}
      <DownloadSideRail
        lang={lang}
        stats={footerStats}
        successRate={footerStats.successRate}
        activeCount={activeCount}
      />
    </div>
  )
}

// ── Right rail: fills the fullscreen width with useful, live content ──
function DownloadSideRail({
  lang, stats, successRate, activeCount,
}: {
  lang: string
  stats: { completedDownloads: number; failedDownloads: number; totalDownloads: number; storageUsed: string }
  successRate: number
  activeCount: number
}) {
  const ru = lang === 'ru'
  const platforms: { name: string; color: string; Icon: any }[] = [
    { name: 'Spotify',    color: '#1ed760', Icon: SpotifyIcon },
    { name: 'YouTube',    color: '#ff0000', Icon: YouTubeIcon },
    { name: 'SoundCloud', color: '#ff5500', Icon: SoundCloudIcon },
    { name: 'Yandex',     color: '#ffcc00', Icon: YandexIcon },
  ]
  const quality: { fmt: string; desc: string; tag: string }[] = [
    { fmt: 'FLAC', desc: ru ? 'Без потерь, максимум качества' : 'Lossless, maximum quality', tag: ru ? 'Лучшее' : 'Best' },
    { fmt: 'WAV',  desc: ru ? 'Несжатый, большой размер'     : 'Uncompressed, large files',  tag: ru ? 'Студия' : 'Studio' },
    { fmt: 'MP3',  desc: ru ? '320 kbps, универсальный'       : '320 kbps, universal',         tag: ru ? 'Обычный' : 'Common' },
    { fmt: 'OGG',  desc: ru ? 'Компактный, открытый формат'   : 'Compact, open format',        tag: 'Vorbis' },
  ]

  const card = "rounded-2xl border border-white/[0.07] backdrop-blur-xl overflow-hidden"
  const cardStyle: CSSProperties = {
    background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.018) 100%)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 32px rgba(0,0,0,0.3)",
  }

  return (
    <div className="space-y-4 lg:sticky lg:top-2">
      {/* Session summary with radial gauge */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut", delay: 0.05 }}
        className={card}
        style={cardStyle}
      >
        <div className="px-5 pt-4 pb-3 flex items-center gap-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(30,215,96,0.12)", border: "1px solid rgba(30,215,96,0.2)" }}>
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-[13px] font-bold text-white leading-tight">{ru ? 'Сводка' : 'Overview'}</h3>
            <p className="text-[10px] text-white/30 leading-none mt-0.5">{ru ? 'по вашей библиотеке' : 'of your library'}</p>
          </div>
        </div>

        <div className="p-5 flex items-center gap-5">
          {/* Radial success gauge */}
          <div className="relative w-[86px] h-[86px] flex-shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="9" />
              <circle
                cx="50" cy="50" r="42" fill="none" stroke="#1ed760" strokeWidth="9" strokeLinecap="round"
                strokeDasharray={`${(successRate / 100) * 263.9} 263.9`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[20px] font-extrabold text-white leading-none">{successRate}%</span>
              <span className="text-[9px] text-white/35 mt-0.5">{ru ? 'успех' : 'success'}</span>
            </div>
          </div>

          <div className="flex-1 space-y-2.5 min-w-0">
            <RailStat label={ru ? 'Скачано' : 'Downloaded'} value={stats.completedDownloads} color="#1ed760" />
            <RailStat label={ru ? 'Ошибки' : 'Failed'}     value={stats.failedDownloads}    color="#ef4444" />
            <RailStat label={ru ? 'Активных' : 'Active'}    value={activeCount}              color="#eab308" />
          </div>
        </div>

        <div className="px-5 pb-4 flex items-center justify-between text-[11px]" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <span className="text-white/35 pt-3">{ru ? 'Занято н�� диске' : 'Storage used'}</span>
          <span className="text-white/70 font-semibold pt-3">{stats.storageUsed || '—'}</span>
        </div>
      </motion.div>

      {/* Supported platforms */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut", delay: 0.1 }}
        className={card}
        style={cardStyle}
      >
        <div className="px-5 pt-4 pb-3">
          <h3 className="text-[13px] font-bold text-white/80 leading-tight">{ru ? 'Поддерживаемые сервисы' : 'Supported services'}</h3>
        </div>
        <div className="px-4 pb-4 grid grid-cols-2 gap-2">
          {platforms.map((p) => (
            <div
              key={p.name}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p.Icon className="w-4 h-4 flex-shrink-0" style={{ color: p.color }} />
              <span className="text-[12px] font-medium text-white/70 truncate">{p.name}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Quality guide */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut", delay: 0.15 }}
        className={card}
        style={cardStyle}
      >
        <div className="px-5 pt-4 pb-3">
          <h3 className="text-[13px] font-bold text-white/80 leading-tight">{ru ? 'Форматы и качество' : 'Formats & quality'}</h3>
        </div>
        <div className="px-4 pb-4 space-y-1.5">
          {quality.map((q) => (
            <div
              key={q.fmt}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <span className="text-[12px] font-bold text-primary w-10 flex-shrink-0">{q.fmt}</span>
              <span className="text-[11px] text-white/45 flex-1 leading-tight">{q.desc}</span>
              <span className="text-[9px] font-semibold text-white/40 px-1.5 py-0.5 rounded-md flex-shrink-0" style={{ background: "rgba(30,215,96,0.1)", border: "1px solid rgba(30,215,96,0.18)" }}>
                {q.tag}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

function RailStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="text-[12px] text-white/45 truncate">{label}</span>
      </div>
      <span className="text-[14px] font-bold text-white/80">{value}</span>
    </div>
  )
}
