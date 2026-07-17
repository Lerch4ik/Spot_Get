'use client'

import { motion } from 'framer-motion'
import { RotateCcw, Trash2, Music, Disc3, ListMusic, User, FolderOpen } from 'lucide-react'
import { format } from 'date-fns'
import type { DownloadItem, Platform } from '@/lib/store'
import { getPlatformColor, getPlatformName } from '@/lib/store'
import { PlatformIcon } from './DownloadPanel'
import { TrackArtwork } from './TrackArtwork'

interface HistoryItemProps {
  item: DownloadItem
  onRetry?: (id: string) => void
  onDelete?: (id: string) => void
}

const typeIcons: Record<string, React.ReactNode> = {
  song: <Music className="w-3.5 h-3.5" />,
  album: <Disc3 className="w-3.5 h-3.5" />,
  playlist: <ListMusic className="w-3.5 h-3.5" />,
  artist: <User className="w-3.5 h-3.5" />,
}

const statusStyles: Record<string, string> = {
  completed: 'bg-primary/10 text-primary border-primary/20',
  downloading: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  pending: 'bg-muted text-muted-foreground border-border',
  failed: 'bg-destructive/10 text-destructive border-destructive/20',
}

export function HistoryItem({ item, onRetry, onDelete }: HistoryItemProps) {
  const handleShowInFolder = () => {
    if (typeof window !== 'undefined' && window.electronAPI?.showInFolder && item.url) {
      window.electronAPI.showInFolder(item.url)
    } else if (typeof window !== 'undefined' && window.electronAPI?.showFolder) {
      // Fallback: open the output directory
      const settings = (window as any).__spotgetSettings
      if (settings?.outputDirectory) {
        window.electronAPI.showFolder(settings.outputDirectory)
      }
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileHover={{ x: 2, transition: { duration: 0.15 } }}
      className="flex items-center gap-3 p-3 rounded-xl glass-card transition-colors group"
    >
      {/* Thumbnail */}
      <div
        className="relative flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${getPlatformColor(item.platform || 'unknown')}25 0%, ${getPlatformColor(item.platform || 'unknown')}08 100%)`,
        }}
      >
        <TrackArtwork
          url={(item as any).artwork || item.thumbnailUrl}
          alt={item.title}
          className="w-full h-full object-cover"
          fallback={
            <span className="text-sm font-bold" style={{ color: getPlatformColor(item.platform || 'unknown') }}>
              {item.title.charAt(0).toUpperCase()}
            </span>
          }
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium truncate">{item.title}</h4>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span style={{ color: getPlatformColor(item.platform || 'unknown') + 'aa' }}>{typeIcons[item.type]}</span>
          <span className="text-xs text-muted-foreground truncate">
            {item.status === 'failed' && item.errorMsg ? item.errorMsg : item.artist}
          </span>
        </div>
      </div>

      {/* Platform badge */}
      <div
        className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold"
        style={{
          backgroundColor: getPlatformColor(item.platform || 'unknown') + '10',
          color: getPlatformColor(item.platform || 'unknown'),
          border: `1px solid ${getPlatformColor(item.platform || 'unknown')}20`,
        }}
      >
        <PlatformIcon platform={(item.platform || 'unknown') as Platform} className="w-2.5 h-2.5" />
        {getPlatformName(item.platform || 'unknown')}
      </div>

      {/* Format & Size */}
      <div className="hidden sm:flex flex-col items-end">
        <span className="text-xs text-muted-foreground">{item.format.toUpperCase()} • {item.bitrate}</span>
        {item.fileSize && item.fileSize !== '—' && (
          <span className="text-[10px] text-muted-foreground/60">{item.fileSize}</span>
        )}
      </div>

      {/* Status */}
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${statusStyles[item.status]}`}>
        {item.status}
      </span>

      {/* Date */}
      <span className="hidden md:block text-[10px] text-muted-foreground/60 min-w-[60px] text-right">
        {(() => {
          if (!item.date) return "—"
          
          const parsedDate = new Date(item.date)
          // Проверяем, что дата действительно валидна (не NaN)
          if (isNaN(parsedDate.getTime())) {
            return "—"
          }

          try {
            return format(parsedDate, 'MMM d')
          } catch (error) {
            console.error("Ошибка форматирования даты:", error)
            return "—"
          }
        })()}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {item.status === 'completed' && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleShowInFolder}
            className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
            title="Show in folder"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </motion.button>
        )}
        {item.status === 'failed' && onRetry && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onRetry(item.id)}
            className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
            title="Retry"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </motion.button>
        )}
        {onDelete && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onDelete(item.id)}
            className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}
