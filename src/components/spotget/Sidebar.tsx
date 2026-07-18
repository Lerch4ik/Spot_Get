'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home,
  BarChart3,
  History,
  Settings,
  Menu,
  X,
  ChevronRight,
  Music,
  ListMusic,
  Play,
  Download as DownloadIcon,
  Loader2,
} from 'lucide-react'
import { useSpotgetStore, type PanelType } from '@/lib/store'
import { useUpdater } from '@/lib/updater'
import { translations } from '@/lib/i18n'

const navItems: { id: PanelType; icon: React.ReactNode }[] = [
  { id: 'download', icon: <Home className="w-5 h-5" /> },
  { id: 'player', icon: <Music className="w-5 h-5" /> },
  { id: 'stats', icon: <BarChart3 className="w-5 h-5" /> },
  { id: 'history', icon: <History className="w-5 h-5" /> },
  { id: 'library', icon: <ListMusic className="w-5 h-5" /> },
  { id: 'settings', icon: <Settings className="w-5 h-5" /> },
]

export function Sidebar() {
  const { activePanel, setActivePanel, sidebarOpen, setSidebarOpen, playlists, playPlaylist, lang, setLang } = useSpotgetStore()
  const t = translations[lang]
  const [isDesktop, setIsDesktop] = useState(true)

  // Auto-update: init the progress stream and check GitHub Releases on startup.
  const { phase: updatePhase, progress: updateProgress, currentVersion, latestVersion, download: downloadUpdate } = useUpdater()
  useEffect(() => {
    useUpdater.getState().init()
    useUpdater.getState().check(true)
  }, [])

  const labelMap: Record<string, string> = {
    download: t.download,
    player: t.player,
    stats: t.stats,
    history: t.history,
    library: t.myLibrary,
    settings: t.settings,
  }

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const shouldShowSidebar = isDesktop || sidebarOpen

  return (
    <>
      {/* Mobile hamburger */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 p-2 rounded-xl glass-strong lg:hidden shadow-lg"
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </motion.button>

      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && !isDesktop && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          x: shouldShowSidebar ? 0 : -280,
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed left-0 top-0 bottom-0 z-40 w-[240px] glass-strong border-r border-border flex flex-col lg:translate-x-0 lg:static lg:z-auto"
      >
        {/* Logo */}
        <div className="p-6 pb-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center glow-green-sm">
              <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M8 12 L12 8 L16 12 L12 16 Z" fill="currentColor" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight glow-green-text">SPOTGET</h1>
              <p className="text-[10px] text-muted-foreground tracking-widest">{lang === 'ru' ? 'ЗАГРУЗЧИК' : 'DOWNLOADER'}</p>
            </div>
          </motion.div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item, index) => (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 + 0.1 }}
              onClick={() => setActivePanel(item.id)}
              className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                activePanel === item.id
                  ? 'glass-accent text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              {activePanel === item.id && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-primary"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
              <span className={activePanel === item.id ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}>
                {item.icon}
              </span>
              <span>{labelMap[item.id]}</span>
              <ChevronRight className={`w-3.5 h-3.5 ml-auto transition-opacity ${activePanel === item.id ? 'opacity-100' : 'opacity-0'}`} />
            </motion.button>
          ))}
        </nav>

        {/* Playlists — hidden entirely when the user has none */}
        {playlists.length > 0 && (
        <div className="px-3 pt-2 pb-1">
          <div className="flex items-center justify-between px-4 mb-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">{lang === 'ru' ? 'Плейлисты' : 'Playlists'}</span>
          </div>
          <div className="space-y-0.5 max-h-40 overflow-y-auto">
            {playlists.map((pl) => (
              <motion.button
                key={pl.id}
                whileHover={{ x: 2 }}
                onClick={() => { setActivePanel('player'); playPlaylist(pl.id) }}
                className="w-full flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-all group"
              >
                <div
                  className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: pl.color + '20' }}
                >
                  <ListMusic className="w-3 h-3" style={{ color: pl.color }} />
                </div>
                <span className="truncate flex-1 text-left">{pl.name}</span>
                <span className="text-[9px] text-muted-foreground/40 flex-shrink-0">{pl.trackIds.length}</span>
              </motion.button>
            ))}
          </div>
        </div>
        )}

        {/* Language Toggle */}
        <div className="px-3 pb-1">
          <button
            onClick={() => setLang(lang === 'en' ? 'ru' : 'en')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors w-full"
          >
            <span className="text-base">{lang === 'en' ? '\u{1F1F7}\u{1F1FA}' : '\u{1F1EC}\u{1F1E7}'}</span>
            <span>{lang === 'en' ? 'Русский' : 'English'}</span>
          </button>
        </div>

        {/* Update notification — shown only when a newer release is available */}
        <AnimatePresence>
          {(updatePhase === 'available' || updatePhase === 'downloading' || updatePhase === 'installing') && (
            <motion.div
              initial={{ opacity: 0, y: 8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: 8, height: 0 }}
              className="px-3 pb-2"
            >
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  <span className="text-xs font-semibold text-primary">
                    {lang === 'ru' ? 'Доступно обновление' : 'Update available'}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
                  {lang === 'ru' ? 'Новая версия' : 'New version'}{' '}
                  <span className="font-mono text-foreground">v{latestVersion || '?'}</span>
                  {currentVersion ? (
                    <span className="text-muted-foreground/60">
                      {' '}({lang === 'ru' ? 'текущая' : 'current'} v{currentVersion})
                    </span>
                  ) : null}
                </p>
                <button
                  onClick={() => { if (updatePhase === 'available') downloadUpdate() }}
                  disabled={updatePhase !== 'available'}
                  className="relative w-full overflow-hidden flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold transition-colors hover:bg-primary/90 disabled:cursor-default"
                >
                  {(updatePhase === 'downloading' || updatePhase === 'installing') && (
                    <span
                      className="absolute inset-0 left-0 bg-primary-foreground/20"
                      style={{ width: `${updateProgress}%`, transition: 'width 0.2s ease' }}
                    />
                  )}
                  <span className="relative flex items-center gap-2">
                    {updatePhase === 'available' && <><DownloadIcon className="w-3.5 h-3.5" />{lang === 'ru' ? 'Обновить сейчас' : 'Update now'}</>}
                    {updatePhase === 'downloading' && <><Loader2 className="w-3.5 h-3.5 animate-spin" />{`${lang === 'ru' ? 'Загрузка' : 'Downloading'} ${updateProgress}%`}</>}
                    {updatePhase === 'installing' && <><Loader2 className="w-3.5 h-3.5 animate-spin" />{lang === 'ru' ? 'Установка…' : 'Installing…'}</>}
                  </span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer info */}
        <div className="p-4 border-t border-border mt-auto">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>{lang === 'ru' ? 'Система активна' : 'System Online'}</span>
          </div>
          <p className="text-[9px] text-muted-foreground/50 mt-1">v{currentVersion || '2.8.4'} • spotdl powered</p>
        </div>
      </motion.aside>
    </>
  )
}
