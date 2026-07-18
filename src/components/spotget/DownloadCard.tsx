"use client"

import { useState, useCallback } from "react"
import { useResolvedArtwork } from "@/hooks/useArtwork"
import { motion, AnimatePresence } from "framer-motion"
import { X, CheckCircle2, XCircle, Ban, Clock, SkipForward, ChevronDown, ChevronRight } from "lucide-react"
import type { DownloadItem } from "@/lib/store"
import { getPlatformColor } from "@/lib/store"
import { PlatformIcon } from "./DownloadPanel"

interface DownloadCardProps {
  download: DownloadItem
  subTracks?: DownloadItem[]
  onCancel?: (id: string) => void
}

function cleanLabel(s?: string | null): string {
  if (!s) return ""
  return s.replace(/[\s\-]+$/, "").replace(/^[\s\-]+/, "").trim()
}

function StatusBadge({ status, progress, platformColor }: {
  status: DownloadItem["status"]
  progress: number
  platformColor: string
}) {
  if (status === "downloading") {
    return (
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {progress > 0 && (
          <span
            className="text-[12px] font-bold tabular-nums leading-none"
            style={{ color: platformColor }}
          >
            {progress}%
          </span>
        )}
        <div
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: platformColor }}
        />
      </div>
    )
  }
  if (status === "pending") {
    return (
      <div className="flex items-center gap-1 text-white/30">
        <Clock className="w-3 h-3" />
        <span className="text-[11px]">in queue</span>
      </div>
    )
  }
  if (status === "completed") {
    return <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: platformColor }} />
  }
  if (status === "failed") {
    return <XCircle className="w-4 h-4 flex-shrink-0 text-red-400/80" />
  }
  if (status === "cancelled") {
    return <Ban className="w-4 h-4 flex-shrink-0 text-white/20" />
  }
  return null
}

export function DownloadCard({ download, subTracks = [], onCancel }: DownloadCardProps) {
  const isActive      = download.status === "downloading" || download.status === "pending"
  const isDownloading = download.status === "downloading"
  const isCompleted   = download.status === "completed"
  const isFailed      = download.status === "failed"
  const isSkipped     = isCompleted && download.fileSize === "Skipped"

  const platformColor = getPlatformColor(download.platform ?? "unknown")

  const title  = cleanLabel(download.title)  || "Unknown Track"
  const artist = cleanLabel(download.artist) || "Unknown Artist"

  const [expanded, setExpanded] = useState(false)
  const hasSubTracks = subTracks.length > 0

  const rawArt = download.artwork || download.thumbnailUrl
  const artwork =
    rawArt &&
    !rawArt.includes("unsplash.com") &&
    (rawArt.startsWith("data:") || rawArt.startsWith("https://") || rawArt.startsWith("spotget://"))
      ? rawArt
      : null

  // Resolve spotget:// URLs via the shared cached resolver
  const resolvedArtwork = useResolvedArtwork(artwork)

  const [imgFailed, setImgFailed] = useState(false)
  const onImgError = useCallback(() => setImgFailed(true), [])
  const showArtwork = resolvedArtwork && !imgFailed

  const handleCancel = () => {
    if ((window as any).electronAPI?.cancelDownload) {
      (window as any).electronAPI.cancelDownload(download.id)
    }
    onCancel?.(download.id)
  }

  const progress = download.progress ?? 0

  return (
    <>
    <motion.div
      layout
      initial={{ opacity: 0, y: -6, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 16, scale: 0.97, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className="group relative flex items-center gap-3 px-3 py-3 rounded-xl overflow-hidden transition-colors"
      style={{
        background: isActive
          ? `linear-gradient(135deg, ${platformColor}0a 0%, transparent 60%)`
          : "rgba(255,255,255,0.025)",
        border: isActive
          ? `1px solid ${platformColor}28`
          : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Left accent bar — active only */}
      {isActive && (
        <span
          className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full"
          style={{
            background: `linear-gradient(to bottom, ${platformColor}, ${platformColor}66)`,
            boxShadow: `2px 0 8px ${platformColor}55`,
          }}
        />
      )}

      {/* Artwork / platform icon block */}
      <div className="relative flex-shrink-0 w-11 h-11">
        <div
          className="w-full h-full rounded-xl overflow-hidden flex items-center justify-center"
          style={{
            background: showArtwork
              ? "transparent"
              : `linear-gradient(135deg, ${platformColor}22, ${platformColor}0a)`,
            border: `1px solid ${platformColor}22`,
          }}
        >
          {showArtwork ? (
            <img
              key={`${download.id}-art`}
              src={resolvedArtwork!}
              alt={title}
              className="w-full h-full object-cover"
              onError={onImgError}
            />
          ) : (
            <PlatformIcon
              platform={download.platform ?? "unknown"}
              className="w-5 h-5"
              style={{ color: platformColor } as any}
            />
          )}
        </div>

        {/* Platform badge when artwork visible */}
        {showArtwork && (
          <span
            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-md flex items-center justify-center"
            style={{ background: platformColor, boxShadow: `0 1px 4px ${platformColor}88` }}
          >
            <PlatformIcon
              platform={download.platform ?? "unknown"}
              className="w-2.5 h-2.5 text-black"
            />
          </span>
        )}

        {/* Spinning ring while downloading */}
        {isDownloading && (
          <div
            className="absolute inset-0 rounded-xl border-2 border-transparent"
            style={{
              borderTopColor: platformColor,
              borderRightColor: `${platformColor}33`,
              animation: "spin 1s linear infinite",
            }}
          />
        )}
      </div>

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <p
            className="text-[13px] font-semibold leading-snug truncate text-white/90"
            title={title}
          >
            {title}
          </p>
          {isSkipped && (
            <span
              className="flex-shrink-0 flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{
                background: `${platformColor}18`,
                color: platformColor,
                border: `1px solid ${platformColor}30`,
              }}
            >
              <SkipForward className="w-2.5 h-2.5" />
              skip
            </span>
          )}
        </div>

        <p className="text-[11px] text-white/35 truncate mt-0.5 leading-none">
          {artist}
          <span className="mx-1.5 opacity-50">·</span>
          <span className="uppercase tracking-wide">{download.format || "mp3"}</span>
          {download.bitrate && (
            <span className="ml-1 opacity-70">{download.bitrate}</span>
          )}
        </p>

        {/* Progress bar */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              exit={{ opacity: 0 }}
              className="mt-2 h-[3px] rounded-full overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.06)",
                transformOrigin: "left",
              }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: isDownloading
                    ? `linear-gradient(90deg, ${platformColor}cc, ${platformColor})`
                    : `${platformColor}40`,
                }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error message */}
        {isFailed && download.errorMsg && (
          <p className="mt-1 text-[10px] text-red-400/70 truncate leading-none">
            {download.errorMsg}
          </p>
        )}
      </div>

      {/* Right side: status + cancel */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {hasSubTracks && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 transition-colors"
            title={expanded ? "Collapse tracks" : "Show tracks"}
          >
            {expanded
              ? <ChevronDown className="w-3.5 h-3.5" />
              : <ChevronRight className="w-3.5 h-3.5" />
            }
          </button>
        )}

        <StatusBadge
          status={download.status}
          progress={progress}
          platformColor={platformColor}
        />

        {isActive && onCancel && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.85 }}
            onClick={handleCancel}
            type="button"
            title="Cancel"
            className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/15 transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </motion.button>
        )}
      </div>
    </motion.div>

    {/* Sub-tracks expandable list */}
    <AnimatePresence>
      {hasSubTracks && expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="overflow-hidden"
        >
          <div className="ml-4 mr-2 mt-1 mb-2 space-y-1 max-h-[240px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {[...subTracks]
              .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) // newest first
              .map((track) => {
                const trackColor = getPlatformColor(track.platform ?? "unknown")
                const isTrackActive = track.status === "downloading"
                const isTrackCompleted = track.status === "completed"
                const isTrackSkipped = isTrackCompleted && track.fileSize === "Skipped"
                const trackProgress = track.progress ?? 0

                return (
                  <motion.div
                    key={track.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors"
                    style={{
                      background: isTrackActive
                        ? `linear-gradient(135deg, ${trackColor}08 0%, transparent 60%)`
                        : "rgba(255,255,255,0.02)",
                    }}
                  >
                    {/* Track status icon */}
                    <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                      {isTrackCompleted && isTrackSkipped && (
                        <SkipForward className="w-3 h-3 text-white/30" />
                      )}
                      {isTrackCompleted && !isTrackSkipped && (
                        <CheckCircle2 className="w-3 h-3" style={{ color: trackColor }} />
                      )}
                      {isTrackActive && (
                        <div
                          className="w-2 h-2 rounded-full animate-pulse"
                          style={{ background: trackColor }}
                        />
                      )}
                      {track.status === "pending" && (
                        <Clock className="w-3 h-3 text-white/20" />
                      )}
                      {track.status === "failed" && (
                        <XCircle className="w-3 h-3 text-red-400/60" />
                      )}
                    </div>

                    {/* Track info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-white/60 truncate leading-tight">
                        {cleanLabel(track.title) || "Unknown Track"}
                      </p>
                      <p className="text-[10px] text-white/25 truncate leading-none">
                        {cleanLabel(track.artist) || "Unknown Artist"}
                      </p>
                    </div>

                    {/* Progress / status */}
                    <div className="flex-shrink-0 flex items-center gap-1.5">
                      {isTrackSkipped && (
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-white/5 text-white/30">
                          skip
                        </span>
                      )}
                      {isTrackActive && trackProgress > 0 && (
                        <span
                          className="text-[10px] font-bold tabular-nums"
                          style={{ color: trackColor }}
                        >
                          {trackProgress}%
                        </span>
                      )}
                    </div>

                    {/* Mini progress bar for active tracks */}
                    {isTrackActive && (
                      <div className="absolute bottom-0 left-2 right-2 h-[1px] rounded-full overflow-hidden"
                        style={{ background: "rgba(255,255,255,0.04)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${trackProgress}%`,
                            background: `linear-gradient(90deg, ${trackColor}88, ${trackColor})`,
                          }}
                        />
                      </div>
                    )}
                  </motion.div>
                )
              })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  )
}
