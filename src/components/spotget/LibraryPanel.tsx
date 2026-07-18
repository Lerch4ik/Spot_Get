'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Music, Play, FolderOpen, Download, FolderInput } from 'lucide-react'
import { useSpotgetStore, buildDownloadedTracks, buildImportedTracks } from '@/lib/store'
import { translations } from '@/lib/i18n'
import { AddToPlaylistButton } from './AddToPlaylistButton'
import { TrackArtwork } from './TrackArtwork'
import { VirtualList } from './VirtualList'
import { TrackListControls, sortTracks, filterTracks, type TrackSortMode } from './TrackListControls'
import { formatTime } from './MiniPlayer'

type LibraryTab = 'downloaded' | 'imported'

export function LibraryPanel() {
  const {
    lang,
    libraryTracks,
    libraryFolder,
    loadLibrary,
    playTrack,
    addToQueue,
    downloads,
  } = useSpotgetStore()
  const t = translations[lang]

  const [activeTab, setActiveTab] = useState<LibraryTab>('downloaded')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<TrackSortMode>('default')

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.getLibraryDir) {
      window.electronAPI.getLibraryDir().then((result: any) => {
        if (result?.tracks?.length) {
          loadLibrary(result.tracks, result.folder || '')
        }
      })
    }
  }, [loadLibrary])

  const handleImport = async () => {
    if (!window.electronAPI?.importLibrary) return
    const result = await window.electronAPI.importLibrary()
    if (result?.tracks?.length) {
      loadLibrary(result.tracks, result.folder || '')
    }
  }

  // Build "downloaded" tracks from completed downloads in history
  const downloadedTracks = buildDownloadedTracks(downloads)
  // "Imported" = the audio files scanned from the user-chosen import folder,
  // which is completely independent of the download folder.
  const importedTracks = buildImportedTracks(libraryTracks)

  const currentTracks = activeTab === 'downloaded' ? downloadedTracks : importedTracks
  // Apply the search + sort controls; the virtual list below renders only the
  // visible rows, so even thousands of tracks scroll without lag.
  const visibleTracks = sortTracks(filterTracks(currentTracks, search), sort)

  return (
    <div className="relative max-w-3xl mx-auto space-y-6 pb-12">
      {/* ── Ambient glow ────────────────────────────────── */}
      <div
        className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-[560px] h-[340px] rounded-full opacity-60"
        style={{
          background: "radial-gradient(ellipse at center, rgba(30,215,96,0.14) 0%, rgba(34,211,238,0.05) 45%, transparent 70%)",
          filter: "blur(48px)",
        }}
      />

      {/* ── Hero ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative pt-8 text-center space-y-3"
      >
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
          <span className="text-white">{lang === 'ru' ? 'Моя ' : 'My '}</span>
          <span
            style={{
              background: "linear-gradient(90deg, #1ed760 0%, #4ade80 50%, #22d3ee 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {lang === 'ru' ? 'библиотека' : 'library'}
          </span>
        </h1>
        <p className="text-[13px] text-white/35">
          {lang === 'ru' ? 'Скачанные треки и музыка из твоих папок' : 'Your downloaded tracks and imported folders'}
        </p>
        {activeTab === 'imported' && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleImport}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-medium text-white/55 hover:text-white transition-colors"
              style={{ background: "var(--wa-04)", border: "1px solid var(--wa-09)" }}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              {t.importLibrary}
            </button>
          </div>
        )}
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-full backdrop-blur-xl border-[1.5px] border-white/10 bg-white/[0.045] max-w-md mx-auto">
        <button
          onClick={() => setActiveTab('downloaded')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
            activeTab === 'downloaded'
              ? 'glass-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Download className="w-4 h-4" />
          {t.downloaded}
          {downloadedTracks.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
              {downloadedTracks.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('imported')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
            activeTab === 'imported'
              ? 'glass-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FolderInput className="w-4 h-4" />
          {t.imported}
          {importedTracks.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
              {importedTracks.length}
            </span>
          )}
        </button>
      </div>

      {/* Folder info for imported tab */}
      {activeTab === 'imported' && libraryFolder && (
        <p className="text-center text-[10px] text-white/25 truncate">{libraryFolder}</p>
      )}

      {/* Track list */}
      {currentTracks.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 gap-4 rounded-2xl"
          style={{ border: "1px dashed var(--wa-08)" }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, rgba(30,215,96,0.08), rgba(34,211,238,0.04))", border: "1px solid rgba(30,215,96,0.14)" }}
          >
            <Music className="w-7 h-7 text-primary/40" />
          </div>
          <p className="text-white/30 text-sm">
            {activeTab === 'downloaded' ? t.noDownloadedTracks : t.importLibraryDesc}
          </p>
          {activeTab === 'imported' && (
            <button
              type="button"
              onClick={handleImport}
              className="flex items-center gap-1.5 px-5 py-2 rounded-full text-[13px] font-semibold text-black transition-transform hover:scale-105"
              style={{ background: "linear-gradient(90deg, #1ed760, #4ade80)" }}
            >
              <FolderOpen className="w-4 h-4" />
              {t.browseFolder}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground mb-3">
            {visibleTracks.length} {t.tracks}
          </p>
          <TrackListControls search={search} onSearch={setSearch} sort={sort} onSort={setSort} lang={lang} />
          <VirtualList
            items={visibleTracks}
            itemHeight={68}
            maxHeight="calc(100vh - 380px)"
            renderItem={(track: any) => (
            <div key={track.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 group transition-colors">
              <div className="w-10 h-10 rounded bg-green-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                <TrackArtwork
                  url={track.thumbnailUrl}
                  alt={track.title}
                  className="w-full h-full object-cover"
                  fallback={<Music className="w-5 h-5 text-green-400" />}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{track.title}</p>
                <p className="text-xs text-muted-foreground">{track.artist}</p>
              </div>
              <span className="text-xs text-muted-foreground/60 flex-shrink-0">
                {formatTime(track.duration)}
              </span>
              <span className="text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded">
                {track.format}
              </span>
              <AddToPlaylistButton track={track} />
              <button
                onClick={() => {
                  playTrack(track, visibleTracks)
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-white/10 text-green-400"
                title="Play"
              >
                <Play className="w-4 h-4" />
              </button>
            </div>
            )}
          />
        </div>
      )}
    </div>
  )
}
