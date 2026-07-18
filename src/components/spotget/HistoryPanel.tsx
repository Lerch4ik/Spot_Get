'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Trash2, Filter, Download as ExportIcon, Upload as ImportIcon } from 'lucide-react'
import { useSpotgetStore, type DownloadStatus, type SpotifyType, type Platform, getPlatformName, getPlatformColor } from '@/lib/store'
import { translations } from '@/lib/i18n'
import { HistoryItem } from './HistoryItem'
import { TypeChipSelect, PlatformChipSelect } from './ChipSelect'
import { useToast } from '@/hooks/use-toast'

export function HistoryPanel() {
  const {
    downloads,
    historyFilter,
    setHistoryFilter,
    removeDownload,
    retryDownload,
    clearHistory,
    mergeHistory,
    lang,
  } = useSpotgetStore()
  const t = translations[lang]
  const { toast } = useToast()

  const [localSearch, setLocalSearch] = useState(historyFilter.search)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setHistoryFilter({ search: localSearch })
    }, 300)
    return () => clearTimeout(timer)
  }, [localSearch, setHistoryFilter])

  const filteredDownloads = useMemo(() => {
    return downloads.filter((d) => {
      if (d.id.includes("-track-")) return false
      // Search filter
      if (historyFilter.search) {
        const q = historyFilter.search.toLowerCase()
        if (
          !d.title.toLowerCase().includes(q) &&
          !d.artist.toLowerCase().includes(q)
        )
          return false
      }
      // Type filter
      if (historyFilter.type !== 'all' && d.type !== historyFilter.type) return false
      // Status filter
      if (historyFilter.status !== 'all' && d.status !== historyFilter.status) return false
      // Platform filter
      if (historyFilter.platform !== 'all' && d.platform !== historyFilter.platform) return false
      return true
    })
  }, [downloads, historyFilter])

  const statusOptions: (DownloadStatus | 'all')[] = ['all', 'completed', 'downloading', 'pending', 'failed']
  const typeOptions: (SpotifyType | 'all')[] = ['all', 'song', 'album', 'playlist', 'artist']
  const platformOptions: (Platform | 'all')[] = ['all', 'spotify', 'yandex', 'soundcloud', 'youtube', 'apple']

  const handleExportHistory = async () => {
    if (!window.electronAPI) {
      toast({ title: 'Export not available outside Electron', variant: 'destructive' })
      return
    }
    const result = await window.electronAPI.exportHistory(downloads)
    if (result.success) {
      toast({ title: 'History exported successfully' })
    }
  }

  const handleImportHistory = async () => {
    if (!window.electronAPI) {
      toast({ title: 'Import not available outside Electron', variant: 'destructive' })
      return
    }
    const result = await window.electronAPI.importHistory()
    if (result.success && result.data) {
      mergeHistory(result.data)
      toast({ title: `Imported ${result.data.length} items` })
    } else if (result.error) {
      toast({ title: result.error, variant: 'destructive' })
    }
  }

  return (
    <div className="relative max-w-3xl mx-auto space-y-6 pb-12">
      {/* ── Ambient glow ────────────────────────────────────── */}
      <div
        className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-[560px] h-[340px] rounded-full opacity-60"
        style={{
          background: "radial-gradient(ellipse at center, rgba(30,215,96,0.14) 0%, rgba(34,211,238,0.05) 45%, transparent 70%)",
          filter: "blur(48px)",
        }}
      />

      {/* ── Hero ────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative pt-8 text-center space-y-3"
      >
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
          <span className="text-white">{lang === 'ru' ? 'История ' : 'Download '}</span>
          <span
            style={{
              background: "linear-gradient(90deg, #1ed760 0%, #4ade80 50%, #22d3ee 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {lang === 'ru' ? 'загрузок' : 'history'}
          </span>
        </h1>
        <p className="text-[13px] text-white/35">
          {filteredDownloads.length} {lang === 'ru' ? 'из' : 'of'} {downloads.length} {lang === 'ru' ? 'записей' : 'items'}
        </p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportHistory}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-medium text-white/55 hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
          >
            <ExportIcon className="w-3.5 h-3.5" />
            {t.exportHistory}
          </button>
          <button
            type="button"
            onClick={handleImportHistory}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-medium text-white/55 hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
          >
            <ImportIcon className="w-3.5 h-3.5" />
            {t.importHistory}
          </button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (confirm(lang === 'ru' ? 'Очистить все завершённые и неудачные загрузки?' : 'Clear all completed and failed downloads?')) {
                clearHistory()
              }
            }}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-medium transition-colors"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", color: "rgba(239,68,68,0.85)" }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t.clearHistory}
          </motion.button>
        </div>
      </motion.div>

      {/* ── Search & Filters ────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative space-y-4"
      >
        {/* Search pill */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder={lang === 'ru' ? 'Поиск по названию или исполнителю...' : 'Search by title or artist...'}
            className="w-full pl-11 pr-5 py-3 rounded-full text-sm text-white placeholder:text-white/20 outline-none transition-all backdrop-blur-xl border-[1.5px] border-white/10 bg-white/[0.045] focus:border-primary/40 focus:shadow-[0_0_28px_rgba(30,215,96,0.14)]"
          />
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
              <Filter className="w-3 h-3" /> {lang === 'ru' ? 'Платформа' : 'Platform'}
            </label>
            <PlatformChipSelect
              value={historyFilter.platform}
              onChange={(v) => setHistoryFilter({ platform: v as any })}
              showAll
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
              <Filter className="w-3 h-3" /> {lang === 'ru' ? 'Тип' : 'Type'}
            </label>
            <TypeChipSelect
              value={historyFilter.type}
              onChange={(v) => setHistoryFilter({ type: v as any })}
              options={typeOptions.map((t) => (t === 'all' ? 'all' : t))}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
              <Filter className="w-3 h-3" /> {lang === 'ru' ? 'Статус' : 'Status'}
            </label>
            <div className="flex gap-2 flex-wrap">
              {statusOptions.map((status) => (
                <motion.button
                  key={status}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setHistoryFilter({ status })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all duration-200 border ${
                    historyFilter.status === status
                      ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_12px_rgba(30,215,96,0.3)]'
                      : 'bg-secondary text-secondary-foreground border-border hover:border-border2 hover:bg-white/10'
                  }`}
                >
                  {status}
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* History List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto pr-1"
      >
        <AnimatePresence mode="popLayout">
          {filteredDownloads.length > 0 ? (
            filteredDownloads.map((item) => (
              <HistoryItem
                key={item.id}
                item={item}
                onRetry={(id) => retryDownload(id)}
                onDelete={(id) => removeDownload(id)}
              />
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 text-muted-foreground"
            >
              <p className="text-sm">{lang === 'ru' ? 'Загрузки не найдены' : 'No downloads found'}</p>
              <p className="text-xs mt-1">{lang === 'ru' ? 'Попробуйте изменить фильтры' : 'Try adjusting your filters'}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
