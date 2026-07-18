"use client"

import { useState, useEffect, useRef, CSSProperties } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Download, CheckCircle2, XCircle, HardDrive, Clipboard,
  Music2, ArrowDown, Loader2, Zap, TrendingUp, Square, Trash2, FolderOpen
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
  const [folderName, setFolderName] = useState("")
  const [recentFolders, setRecentFolders] = useState<string[]>([])

  // Recently used folder names — shown as quick chips under the folder input.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("spot-recent-folders") || "[]")
      if (Array.isArray(saved)) setRecentFolders(saved.filter((f) => typeof f === "string").slice(0, 6))
    } catch {}
  }, [])

  const rememberFolder = (name: string) => {
    if (!name) return
    setRecentFolders((prev) => {
      const next = [name, ...prev.filter((f) => f !== name)].slice(0, 6)
      try { localStorage.setItem("spot-recent-folders", JSON.stringify(next)) } catch {}
      return next
    })
  }

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

    // First download and no base folder chosen yet — ask the user to pick one.
    const bridge = (window as any).electronAPI
    if (!useSpotgetStore.getState().settings.outputDirectory && bridge?.openFolder) {
      const selected = await bridge.openFolder()
      if (selected) {
        useSpotgetStore.getState().updateSettings({ outputDirectory: selected })
      }
    }

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
      rememberFolder(folderName.trim())
      const result = await api.startDownload({ id: parentId, url, format, bitrate, concurrency: 4, folderName: folderName.trim() })
      setPreparing(false)
      setUrl("")
      setFolderName("")
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
  // Cap how many download cards are rendered at once — a 500-track playlist
  // would otherwise mount hundreds of animated cards and freeze the UI.
  const [shownCards, setShownCards] = useState(60)
  const visibleDownloads = downloads.filter((d) => {
    if (d.parentId && existingIds.has(d.parentId)) return false
    return true
  })

  const ru = lang === 'ru'

  return (
    <div className="relative max-w-3xl mx-auto space-y-6 pb-12">

      {/* ── Ambient glow ────────────────────────────────────── */}
      <div
        className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-[560px] h-[340px] rounded-full opacity-60"
        style={{
          background: "radial-gradient(ellipse at center, rgba(30,215,96,0.18) 0%, rgba(34,211,238,0.06) 45%, transparent 70%)",
          filter: "blur(48px)",
        }}
      />

      {/* ── Hero ────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative pt-8 text-center space-y-3"
      >
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
          <span className="text-white">{ru ? 'Скачай ' : 'Download '}</span>
          <span
            style={{
              background: "linear-gradient(90deg, #1ed760 0%, #4ade80 50%, #22d3ee 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {ru ? 'любую музыку' : 'any music'}
          </span>
        </h1>
        <p className="text-[13px] text-white/35 max-w-md mx-auto leading-relaxed">
          {ru
            ? 'Вставь ссылку на трек, альбом или плейлист — Spotify, YouTube, SoundCloud или Яндекс Музыка'
            : 'Paste a track, album or playlist link — Spotify, YouTube, SoundCloud or Yandex Music'}
        </p>
      </motion.div>

      {/* ── Big search-style input ──────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.08 }}
        className="relative space-y-3"
      >
        <div
          className="flex items-center gap-2 rounded-full pl-5 pr-2 py-2 backdrop-blur-xl transition-all"
          style={{
            background: "var(--wa-045)",
            border: url && platform !== "unknown"
              ? `1.5px solid ${platformColor}55`
              : "1.5px solid var(--wa-09)",
            boxShadow: url && platform !== "unknown"
              ? `0 0 36px ${platformColor}22, inset 0 1px 0 var(--wa-06)`
              : "0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 var(--wa-06)",
          }}
        >
          {platform !== "unknown" && url ? (
            <PlatformIcon platform={platform} className="w-5 h-5 flex-shrink-0" style={{ color: platformColor }} />
          ) : (
            <Music2 className="w-5 h-5 text-white/20 flex-shrink-0" />
          )}
          <input
            type="text"
            placeholder={t.placeholderUrl}
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !preparing && url && handleStart()}
            disabled={preparing}
            className="flex-1 min-w-0 bg-transparent py-2 text-sm text-white placeholder:text-white/20 outline-none"
          />
          <button
            type="button"
            onClick={handlePaste}
            title={ru ? 'Вставить из буфера' : 'Paste from clipboard'}
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white/40 hover:text-white hover:bg-white/[0.07] transition-colors"
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
          {isDownloadSessionActive ? (
            <motion.button
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.93 }}
              onClick={handleStopAll}
              type="button"
              title={ru ? 'Остановить все загрузки' : 'Stop all downloads'}
              className="h-10 px-5 rounded-full flex items-center gap-2 flex-shrink-0 text-[13px] font-semibold transition-colors"
              style={{ background: "rgba(239,68,68,0.14)", border: "1px solid rgba(239,68,68,0.35)", color: "rgba(239,68,68,0.95)" }}
            >
              <Square className="w-3.5 h-3.5" fill="currentColor" />
              {ru ? 'Стоп' : 'Stop'}
            </motion.button>
          ) : (
            <GlowButton
              onClick={handleStart}
              disabled={preparing || !url}
              className="px-6 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 min-w-[130px] justify-center flex-shrink-0"
            >
              {preparing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {ru ? 'Подготовка…' : 'Preparing…'}
                </>
              ) : (
                <>
                  <ArrowDown className="w-4 h-4" />
                  {t.download}
                </>
              )}
            </GlowButton>
          )}
        </div>

        {/* Folder pill */}
        <div
          className="flex items-center gap-2 rounded-full pl-5 pr-4 py-1 backdrop-blur-xl"
          style={{
            background: "var(--wa-03)",
            border: folderName.trim() ? "1.5px solid rgba(34,197,94,0.35)" : "1.5px solid var(--wa-07)",
          }}
        >
          <FolderOpen className="w-4 h-4 flex-shrink-0" style={{ color: folderName.trim() ? "#22c55e" : "var(--wa-20)" }} />
          <input
            type="text"
            placeholder={ru ? 'Название папки (необязательно) — например, название плейлиста' : 'Folder name (optional) — e.g. playlist name'}
            value={folderName}
            onChange={(e) => setFolderName(e.target.value.replace(/[<>:"/\\|?*]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && !preparing && url && handleStart()}
            disabled={preparing}
            className="flex-1 min-w-0 bg-transparent py-2 text-[13px] text-white placeholder:text-white/20 outline-none"
          />
        </div>

        {/* Recent folders */}
        {recentFolders.length > 0 && (
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {recentFolders.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setFolderName(folderName === name ? "" : name)}
                className="px-3 py-1 rounded-full text-[11px] transition-colors"
                style={{
                  background: folderName === name ? "rgba(30,215,96,0.12)" : "var(--wa-04)",
                  border: folderName === name ? "1px solid rgba(30,215,96,0.3)" : "1px solid var(--wa-08)",
                  color: folderName === name ? "#1ed760" : "var(--wa-45)",
                }}
              >
                {name}
              </button>
            ))}
          </div>
        )}
        <p className="text-center text-[10px] text-white/25 leading-none">
          {(ru ? 'Сохранится в: ' : 'Saves to: ') +
            (settings.outputDirectory || (ru ? 'Музыка\\Spotget (спросим при первой скачке)' : 'Music\\Spotget (asked on first download)')) +
            (folderName.trim() ? `\\${folderName.trim()}` : '')}
        </p>

        {/* Format & bitrate */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 max-w-xl mx-auto pt-1">
          <FormatChipSelect
            value={format}
            onChange={setFormat}
            options={["mp3", "flac", "ogg", "wav"]}
            label={ru ? 'Формат' : 'Format'}
          />
          <BitrateChipSelect
            value={bitrate}
            onChange={setBitrate}
            options={["128k", "192k", "256k", "320k"]}
            label={ru ? 'Битрейт' : 'Bitrate'}
          />
        </div>
      </motion.div>

      {/* ── Session progress ───────────────────────────────── */}
      <AnimatePresence>
        {isDownloadSessionActive && totalTracksCount ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl px-5 py-4 backdrop-blur-xl flex items-center gap-4"
            style={{
              background: "linear-gradient(135deg, rgba(30,215,96,0.07), var(--wa-02))",
              border: "1px solid rgba(30,215,96,0.2)",
            }}
          >
            <ProgressRing progress={sessionProgress} color="#1ed760" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-white/85 leading-tight">
                {ru ? 'Скачивается…' : 'Downloading…'}
                <span className="text-primary ml-2">{shownCompleted ?? 0} / {totalTracksCount}</span>
                {sessionFailedCount > 0 && (
                  <span className="text-destructive ml-2">{sessionFailedCount} {ru ? 'ошибок' : 'failed'}</span>
                )}
              </p>
              <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--wa-07)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${sessionProgress}%`, background: "linear-gradient(90deg, #1ed760, #4ade80)" }}
                />
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ── Downloads ──────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut", delay: 0.14 }}
        className="relative"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary/70" />
            <h2 className="text-[15px] font-bold text-white/85 leading-none">
              {t.downloadedFiles || (ru ? 'Загруженные файлы' : 'Downloaded files')}
            </h2>
            {visibleDownloads.length > 0 && (
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: "var(--wa-05)", border: "1px solid var(--wa-08)", color: "var(--wa-40)" }}
              >
                {visibleDownloads.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
                style={{ background: "rgba(30,215,96,0.1)", border: "1px solid rgba(30,215,96,0.22)", color: "#1ed760" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#1ed760] animate-pulse" />
                {activeCount} {ru ? 'активных' : 'active'}
              </div>
            )}
            {completedDownloads.length > 0 && activeCount === 0 && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
                style={{ background: "var(--wa-04)", border: "1px solid var(--wa-08)", color: "var(--wa-40)" }}
              >
                <CheckCircle2 className="w-3 h-3" />
                {completedDownloads.length} {ru ? 'завершено' : 'completed'}
              </div>
            )}
            {downloads.length > 0 && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => {
                  if (confirm(ru
                    ? 'Очистить всё? Это удалит все загрузки, историю, плейлисты и избранное.'
                    : 'Clear everything? This removes all downloads, history, playlists and liked songs.')) {
                    clearAllData()
                  }
                }}
                title={ru ? 'Очистить всё' : 'Clear all'}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", color: "rgba(239,68,68,0.85)" }}
              >
                <Trash2 className="w-3 h-3" />
                {ru ? 'Очистить всё' : 'Clear all'}
              </motion.button>
            )}
          </div>
        </div>

        <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <AnimatePresence initial={false}>
            {visibleDownloads.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-16 text-center gap-4 rounded-2xl"
                style={{ border: "1px dashed var(--wa-08)" }}
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, rgba(30,215,96,0.08), rgba(34,211,238,0.04))", border: "1px solid rgba(30,215,96,0.14)" }}
                >
                  <Music2 className="w-7 h-7 text-primary/40" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-white/30">{t.noDownloadsYet || (ru ? 'Нет загрузок' : 'No downloads yet')}</p>
                  <p className="text-[11px] text-white/15 mt-1.5 leading-relaxed max-w-[220px] mx-auto">{t.pasteUrlHelp}</p>
                </div>
              </motion.div>
            ) : (
              [...visibleDownloads]
                .sort((a, b) => {
                  const aActive = a.status === "downloading" || a.status === "pending"
                  const bActive = b.status === "downloading" || b.status === "pending"
                  if (aActive && !bActive) return -1
                  if (!aActive && bActive) return 1
                  return (b.createdAt || 0) - (a.createdAt || 0)
                })
                .slice(0, shownCards)
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
          {visibleDownloads.length > shownCards && (
            <button
              type="button"
              onClick={() => setShownCards((n) => n + 100)}
              className="w-full mt-2 py-2.5 rounded-full text-xs font-medium text-white/55 hover:text-white border border-white/10 bg-white/[0.03] transition-colors"
            >
              {ru ? `Показать ещё (${visibleDownloads.length - shownCards})` : `Show more (${visibleDownloads.length - shownCards})`}
            </button>
          )}
        </div>
      </motion.section>

      {/* ── Stats ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut", delay: 0.2 }}
        className="space-y-3"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary/70" />
          <h2 className="text-[15px] font-bold text-white/85 leading-none">{ru ? 'Статистика' : 'Statistics'}</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: <Download className="w-4 h-4" />, label: ru ? 'Всего' : 'Total', value: footerStats.totalDownloads, color: "#22d3ee" },
            { icon: <CheckCircle2 className="w-4 h-4" />, label: ru ? 'Скачано' : 'Done', value: footerStats.completedDownloads, color: "#1ed760" },
            { icon: <XCircle className="w-4 h-4" />, label: ru ? 'Ошибки' : 'Errors', value: footerStats.failedDownloads, color: "#ef4444" },
            { icon: <HardDrive className="w-4 h-4" />, label: ru ? 'На диске' : 'Storage', value: footerStats.storageUsed || '—', color: "#a78bfa" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl px-4 py-3 flex items-center gap-3 backdrop-blur-xl"
              style={{ background: "var(--wa-03)", border: "1px solid var(--wa-07)" }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${s.color}14`, border: `1px solid ${s.color}30`, color: s.color }}
              >
                {s.icon}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-white/30 leading-none">{s.label}</p>
                <p className="text-[15px] font-bold text-white/85 leading-tight truncate">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
