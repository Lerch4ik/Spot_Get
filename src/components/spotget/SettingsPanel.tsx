'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  FolderOpen,
  FileAudio,
  Gauge,
  ScanSearch,
  Moon,
  Sun,
  Trash2,
  Info,
  Save,
  Check,
  Cookie,
  ShieldCheck,
  RefreshCw,
  Download as DownloadIcon,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { useSpotgetStore } from '@/lib/store'
import { useUpdater } from '@/lib/updater'
import { translations } from '@/lib/i18n'
import { FormatChipSelect, BitrateChipSelect } from './ChipSelect'

export function SettingsPanel() {
  const { settings, updateSettings, lang } = useSpotgetStore()
  const t = translations[lang]
  const {
    phase: updatePhase,
    progress: updateProgress,
    currentVersion,
    latestVersion,
    error: updateError,
    check: checkUpdate,
    download: downloadUpdate,
  } = useUpdater()
  const [saved, setSaved] = useState(false)
  const [localSettings, setLocalSettings] = useState(settings)
  const [hasCookies, setHasCookies] = useState(false)
  const [cookieMsg, setCookieMsg] = useState<string | null>(null)
  const [loggingIn, setLoggingIn] = useState(false)

  useEffect(() => {
    setLocalSettings(settings)
  }, [settings])

  // Load current cookies status from the main process
  useEffect(() => {
    const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined
    api?.cookiesStatus?.().then((r: any) => setHasCookies(!!r?.hasCookies)).catch(() => {})
  }, [])

  // Open the in-app YouTube login window; cookies are captured automatically.
  const handleLogin = async () => {
    const api = (window as any).electronAPI
    if (!api?.loginYouTube) return
    setCookieMsg(null)
    setLoggingIn(true)
    try {
      const res = await api.loginYouTube()
      if (res?.success) {
        setHasCookies(true)
        setCookieMsg(lang === 'ru' ? 'Вход выполнен — теперь загрузка должна работать.' : 'Signed in — downloads should work now.')
      } else if (res?.error === 'cancelled') {
        setCookieMsg(lang === 'ru' ? 'Вход отменён.' : 'Sign-in cancelled.')
      } else if (res?.error) {
        setCookieMsg(lang === 'ru' ? 'Не удалось получить cookies. Попробуйте ещё раз и убедитесь, что вошли в аккаунт.' : 'Could not capture cookies. Try again and make sure you signed in.')
      }
    } finally {
      setLoggingIn(false)
    }
  }

  const handleClearCookies = async () => {
    const api = (window as any).electronAPI
    if (!api?.clearCookies) return
    await api.clearCookies()
    setHasCookies(false)
    setCookieMsg(null)
  }

  // Apply theme to <html> element whenever localSettings.theme changes
  useEffect(() => {
    const html = document.documentElement
    if (localSettings.theme === 'dark') {
      html.classList.add('dark')
      html.classList.remove('light')
    } else {
      html.classList.remove('dark')
      html.classList.add('light')
    }
  }, [localSettings.theme])

  const handleSave = async () => {
    updateSettings(localSettings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleBrowse = async () => {
    if (typeof window !== 'undefined' && window.electronAPI?.openFolder) {
      const selected = await window.electronAPI.openFolder()
      if (selected) {
        setLocalSettings({ ...localSettings, outputDirectory: selected })
      }
    }
  }

  const handleClearHistory = async () => {
    if (!confirm(lang === 'ru' ? 'Вы уверены, что хотите очистить всю историю загрузок?' : 'Are you sure you want to clear all download history?')) return
    useSpotgetStore.getState().clearHistory()
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-2xl font-bold">{t.settingsTitle}</h2>
        <p className="text-sm text-muted-foreground mt-1">{lang === 'ru' ? 'Настройте параметры загрузки' : 'Configure your download preferences'}</p>
      </motion.div>

      {/* Cards flow into two balanced columns on large screens so the
          fullscreen view is filled instead of a narrow centered strip. */}
      <div className="lg:columns-2 lg:gap-6 [&>*]:mb-6 [&>*]:break-inside-avoid space-y-6 lg:space-y-0">

      {/* Download Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl glass-card p-6 space-y-5"
      >
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <FileAudio className="w-4 h-4 text-primary" />
          {lang === 'ru' ? 'Настройки загрузки' : 'Download Settings'}
        </h3>

        {/* Output Directory */}
        <div>
          <label className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
            <FolderOpen className="w-3 h-3" /> {lang === 'ru' ? 'Папка сохранения' : 'Output Directory'}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={localSettings.outputDirectory}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, outputDirectory: e.target.value })
              }
              className="flex-1 px-4 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-primary focus:shadow-[0_0_0_2px_rgba(30,215,96,0.2)] transition-all"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleBrowse}
              className="px-4 py-2.5 rounded-xl bg-secondary border border-border hover:border-primary/50 text-sm transition-colors flex items-center gap-1.5"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              {lang === 'ru' ? 'Обзор' : 'Browse'}
            </motion.button>
          </div>
        </div>

        {/* Default Format */}
        <FormatChipSelect
          value={localSettings.defaultFormat}
          onChange={(v) => setLocalSettings({ ...localSettings, defaultFormat: v })}
          label={lang === 'ru' ? 'Формат по умолчанию' : 'Default Format'}
        />

        {/* Default Bitrate */}
        <BitrateChipSelect
          value={localSettings.defaultBitrate}
          onChange={(v) => setLocalSettings({ ...localSettings, defaultBitrate: v })}
          label={lang === 'ru' ? 'Битрейт по умолчанию' : 'Default Bitrate'}
        />
      </motion.div>

      {/* Advanced Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl glass-card p-6 space-y-5"
      >
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Gauge className="w-4 h-4 text-primary" />
          {lang === 'ru' ? 'Дополнительно' : 'Advanced'}
        </h3>

        {/* Skip Existing */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScanSearch className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-sm">{lang === 'ru' ? 'Пропускать существующие' : 'Skip Existing Downloads'}</p>
              <p className="text-xs text-muted-foreground">{lang === 'ru' ? 'Не скачивать повторно файлы, которые уже есть' : "Don't re-download files that already exist"}</p>
            </div>
          </div>
          <button
            onClick={() =>
              setLocalSettings({ ...localSettings, skipExisting: !localSettings.skipExisting })
            }
            className={`relative w-11 h-6 rounded-full transition-colors ${
              localSettings.skipExisting ? 'bg-primary' : 'bg-secondary'
            }`}
          >
            <motion.div
              animate={{ x: localSettings.skipExisting ? 20 : 2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
            />
          </button>
        </div>

        {/* Concurrent Downloads */}
        <div>
          <label className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
            <Gauge className="w-3 h-3" /> {lang === 'ru' ? 'Параллельных загрузок' : 'Concurrent Downloads'}
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="1"
              max="8"
              value={localSettings.scanThreads}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, scanThreads: parseInt(e.target.value) })
              }
              className="flex-1 h-2 rounded-full appearance-none bg-secondary cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(30,215,96,0.3)] [&::-webkit-slider-thumb]:cursor-pointer
                [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
            />
            <span className="text-sm font-mono text-primary w-8 text-center">
              {localSettings.scanThreads}
            </span>
          </div>
        </div>
      </motion.div>

      {/* YouTube Cookies (bot-check bypass) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="rounded-2xl glass-card p-6 space-y-4"
      >
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          {lang === 'ru' ? 'Вход в YouTube (обход блокировки)' : 'YouTube Sign-in (bypass bot-check)'}
        </h3>

        <p className="text-xs text-muted-foreground leading-relaxed">
          {lang === 'ru'
            ? 'YouTube может блокировать загрузки сообщением «Sign in to confirm you\u2019re not a bot». Нажмите кнопку ниже, войдите в свой аккаунт Google один раз — приложение само сохранит доступ, и загрузки заработают. Ничего устанавливать не нужно.'
            : 'YouTube may block downloads with "Sign in to confirm you\u2019re not a bot". Click the button below and sign in to your Google account once — the app saves the session automatically and downloads will work. Nothing to install.'}
        </p>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {hasCookies ? (
              <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />
            ) : (
              <Cookie className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            )}
            <span className="text-sm truncate">
              {hasCookies
                ? (lang === 'ru' ? 'Вход выполнен' : 'Signed in')
                : (lang === 'ru' ? 'Вход не выполнен' : 'Not signed in')}
            </span>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {hasCookies && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleClearCookies}
                className="px-3 py-2 rounded-xl text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors"
              >
                {lang === 'ru' ? 'Выйти' : 'Sign out'}
              </motion.button>
            )}
            <motion.button
              whileHover={{ scale: loggingIn ? 1 : 1.05 }}
              whileTap={{ scale: loggingIn ? 1 : 0.95 }}
              onClick={handleLogin}
              disabled={loggingIn}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors flex items-center gap-1.5 disabled:opacity-60"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {loggingIn
                ? (lang === 'ru' ? 'Ожидание входа…' : 'Waiting for sign-in…')
                : hasCookies
                  ? (lang === 'ru' ? 'Войти заново' : 'Sign in again')
                  : (lang === 'ru' ? 'Войти в YouTube' : 'Sign in to YouTube')}
            </motion.button>
          </div>
        </div>

        {cookieMsg && (
          <p className="text-xs text-muted-foreground bg-secondary rounded-lg px-3 py-2">{cookieMsg}</p>
        )}
      </motion.div>

      {/* Appearance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-2xl glass-card p-6 space-y-5"
      >
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Moon className="w-4 h-4 text-primary" />
          {lang === 'ru' ? 'Внешний вид' : 'Appearance'}
        </h3>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {localSettings.theme === 'dark' ? (
              <Moon className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Sun className="w-4 h-4 text-muted-foreground" />
            )}
            <div>
              <p className="text-sm">{lang === 'ru' ? 'Тема' : 'Theme'}</p>
              <p className="text-xs text-muted-foreground">
                {localSettings.theme === 'dark' ? (lang === 'ru' ? 'Тёмная тема' : 'Dark mode') : (lang === 'ru' ? 'Светлая тема' : 'Light mode')}
              </p>
            </div>
          </div>
          <button
            onClick={() =>
              setLocalSettings({ ...localSettings, theme: localSettings.theme === 'dark' ? 'light' : 'dark' })
            }
            className={`relative w-11 h-6 rounded-full transition-colors ${
              localSettings.theme === 'dark' ? 'bg-primary' : 'bg-secondary'
            }`}
          >
            <motion.div
              animate={{ x: localSettings.theme === 'dark' ? 20 : 2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
            />
          </button>
        </div>
      </motion.div>

      {/* Danger Zone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 space-y-4"
      >
        <h3 className="text-sm font-semibold text-destructive flex items-center gap-2">
          <Trash2 className="w-4 h-4" />
          {lang === 'ru' ? 'Опасная зона' : 'Danger Zone'}
        </h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm">{lang === 'ru' ? 'Очистить историю загрузок' : 'Clear Download History'}</p>
            <p className="text-xs text-muted-foreground">{lang === 'ru' ? 'Это безвозвратно удалит все записи истории' : 'This will permanently remove all history records'}</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleClearHistory}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors"
          >
            {lang === 'ru' ? 'Очистить' : 'Clear History'}
          </motion.button>
        </div>
      </motion.div>

      </div>{/* end settings columns */}

      {/* Save Button */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleSave}
        className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 border ${
          saved
            ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_20px_rgba(30,215,96,0.3)]'
            : 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 hover:border-primary/50'
        }`}
      >
        {saved ? (
          <>
            <Check className="w-4 h-4" /> {lang === 'ru' ? 'Сохранено!' : 'Saved!'}
          </>
        ) : (
          <>
            <Save className="w-4 h-4" /> {t.saveSettings}
          </>
        )}
      </motion.button>

      {/* About */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="rounded-2xl glass-card p-6"
      >
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-primary" />
          {lang === 'ru' ? 'О программе' : 'About'}
        </h3>
        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>{lang === 'ru' ? 'Версия' : 'Version'}</span>
            <span className="font-mono">{currentVersion || '2.8.0'}</span>
          </div>
          <div className="flex justify-between">
            <span>{lang === 'ru' ? 'Движок' : 'Engine'}</span>
            <span className="font-mono text-primary">spotdl</span>
          </div>
          <div className="flex justify-between">
            <span>{lang === 'ru' ? 'Собрано на' : 'Built with'}</span>
            <span className="font-mono">Next.js + TypeScript</span>
          </div>
        </div>

        {/* Update status line */}
        {updatePhase === 'up-to-date' && (
          <div className="mt-3 flex items-center gap-2 text-xs text-primary">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {lang === 'ru' ? 'У вас последняя версия' : 'You have the latest version'}
          </div>
        )}
        {updatePhase === 'available' && (
          <div className="mt-3 flex items-center gap-2 text-xs text-primary">
            <DownloadIcon className="w-3.5 h-3.5" />
            {lang === 'ru' ? `Доступна версия ${latestVersion}` : `Version ${latestVersion} available`}
          </div>
        )}
        {updatePhase === 'error' && (
          <div className="mt-3 flex items-start gap-2 text-xs text-destructive">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              {lang === 'ru' ? 'Не удалось проверить обновления' : 'Could not check for updates'}
              {updateError ? <span className="block text-destructive/70 mt-0.5">{updateError}</span> : null}
            </span>
          </div>
        )}

        {/* Update / check button */}
        {updatePhase === 'available' || updatePhase === 'downloading' || updatePhase === 'installing' ? (
          <button
            onClick={() => { if (updatePhase === 'available') downloadUpdate() }}
            disabled={updatePhase !== 'available'}
            className="relative mt-4 w-full overflow-hidden flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold transition-colors hover:bg-primary/90 disabled:cursor-default"
          >
            {(updatePhase === 'downloading' || updatePhase === 'installing') && (
              <span className="absolute inset-0 bg-primary-foreground/15" style={{ width: `${updateProgress}%`, transition: 'width 0.2s ease' }} />
            )}
            <span className="relative flex items-center gap-2">
              {updatePhase === 'available' && <><DownloadIcon className="w-3.5 h-3.5" />{lang === 'ru' ? 'Обновить сейчас' : 'Update now'}</>}
              {updatePhase === 'downloading' && <><RefreshCw className="w-3.5 h-3.5 animate-spin" />{`${lang === 'ru' ? 'Загрузка' : 'Downloading'} ${updateProgress}%`}</>}
              {updatePhase === 'installing' && <><RefreshCw className="w-3.5 h-3.5 animate-spin" />{lang === 'ru' ? 'Установка…' : 'Installing…'}</>}
            </span>
          </button>
        ) : (
          <button
            onClick={() => checkUpdate(false)}
            disabled={updatePhase === 'checking'}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl glass-card text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${updatePhase === 'checking' ? 'animate-spin' : ''}`} />
            {updatePhase === 'checking'
              ? (lang === 'ru' ? 'Проверка…' : 'Checking…')
              : (lang === 'ru' ? 'Проверить обновления' : 'Check for updates')}
          </button>
        )}

        <button
          onClick={() => {
            if (typeof window !== 'undefined' && (window as any).electronAPI?.openLogsFolder) {
              ;(window as any).electronAPI.openLogsFolder()
            }
          }}
          className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl glass-card text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          {lang === 'ru' ? 'Открыть папку логов (spot.log)' : 'Open logs folder (spot.log)'}
        </button>
      </motion.div>
    </div>
  )
}
