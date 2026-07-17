'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Trash2, Filter, Download as ExportIcon, Upload as ImportIcon } from 'lucide-react'
import { useSpotgetStore, type DownloadStatus, type SpotifyType, type Platform, getPlatformName, getPlatformColor } from '@/lib/store'
import { translations } from '@/lib/i18n'
import { HistoryItem } from './HistoryItem'
import { TypeChipSelect, PlatformChipSelect } from './ChipSelect'
import { Button } from '@/components/ui/button'
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
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between"
      >
        <div>
          <h2 className="text-2xl font-bold">{t.downloadHistory}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredDownloads.length} {lang === 'ru' ? 'из' : 'of'} {downloads.length} {lang === 'ru' ? 'записей' : 'items'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportHistory}>
            <ExportIcon className="w-3.5 h-3.5 mr-1.5" />
            {t.exportHistory}
          </Button>
          <Button variant="outline" size="sm" onClick={handleImportHistory}>
            <ImportIcon className="w-3.5 h-3.5 mr-1.5" />
            {t.importHistory}
          </Button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (confirm(lang === 'ru' ? 'Очистить все завершённые и неудачные загрузки?' : 'Clear all completed and failed downloads?')) {
                clearHistory()
              }
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t.clearHistory}
          </motion.button>
        </div>
      </motion.div>

      {/* Search & Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl glass-card p-5 space-y-4"
      >
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder={lang === 'ru' ? 'Поиск по названию или исполнителю...' : 'Search by title or artist...'}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-primary focus:shadow-[0_0_0_2px_rgba(30,215,96,0.2)] transition-all placeholder:text-muted-foreground/50"
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
