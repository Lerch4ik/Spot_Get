'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Send, Heart, Music2, Wrench, User, ExternalLink, ShieldCheck } from 'lucide-react'
import { useSpotgetStore } from '@/lib/store'

/* ──────────────────────────────────────────────────────────────────
   ✏️ РЕДАКТИРУЙ ЗДЕСЬ — данные автора и ссылки.

   • name — твоё имя/ник, оно показывается в карточке «Автор».
   • В LINKS впиши свои ссылки в поле url (в кавычках).
     Если url пустой ('') — кнопка НЕ показывается, так что можно
     спокойно оставить ненужные пустыми.
   • icon: 'github' | 'telegram' | 'donate' | 'link' — какая иконка будет
     у кнопки. Ссылка с icon: 'donate' подсвечивается зелёным.
   ───────────────────────────────────────────────────────────────── */
const AUTHOR = {
  name: 'Lerch4ik',
  roleRu: 'Автор и разработчик',
  roleEn: 'Author & developer',
}

type AboutLink = {
  id: string
  labelRu: string
  labelEn: string
  url: string
  icon: 'github' | 'telegram' | 'donate' | 'link'
}

const LINKS: AboutLink[] = [
  { id: 'repo', labelRu: 'Проект на GitHub', labelEn: 'Project on GitHub', url: 'https://github.com/Lerch4ik/Spot_Get', icon: 'github' },
  { id: 'profile', labelRu: 'Профиль GitHub', labelEn: 'GitHub profile', url: 'https://github.com/Lerch4ik', icon: 'github' },
  // 👇 Вставь свои ссылки в кавычки url — и кнопки появятся сами:
  { id: 'telegram', labelRu: 'Telegram', labelEn: 'Telegram', url: '', icon: 'telegram' },
  { id: 'donate', labelRu: 'Поддержать автора ❤️', labelEn: 'Support the author ❤️', url: '', icon: 'donate' },
]

const CARD = 'rounded-3xl border-[1.5px] border-white/10 bg-white/[0.03] backdrop-blur-xl p-6'

// lucide-react removed the brand "Github" icon in recent versions,
// so we ship the official octocat glyph as an inline SVG instead.
function GithubGlyph() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  )
}

function LinkIcon({ icon }: { icon: AboutLink['icon'] }) {
  if (icon === 'github') return <GithubGlyph />
  if (icon === 'telegram') return <Send className="w-4 h-4" />
  if (icon === 'donate') return <Heart className="w-4 h-4" />
  return <ExternalLink className="w-4 h-4" />
}

export function AboutPanel() {
  const lang = useSpotgetStore((s) => s.lang)
  const ru = lang === 'ru'
  const [version, setVersion] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.getAppVersion) {
      ;(window as any).electronAPI.getAppVersion().then((v: string) => setVersion(v || '')).catch(() => {})
    }
  }, [])

  const visibleLinks = LINKS.filter((l) => l.url && l.url.trim().length > 0)

  const tech: { name: string; descRu: string; descEn: string }[] = [
    { name: 'spotdl', descRu: 'находит и скачивает треки из плейлистов Spotify', descEn: 'finds and downloads tracks from Spotify playlists' },
    { name: 'yt-dlp', descRu: 'загружает аудио с YouTube и других площадок', descEn: 'downloads audio from YouTube and other platforms' },
    { name: 'FFmpeg', descRu: 'конвертирует музыку в MP3, FLAC и другие форматы', descEn: 'converts music to MP3, FLAC and other formats' },
    { name: 'Electron', descRu: 'превращает веб-приложение в программу для Windows', descEn: 'turns the web app into a Windows program' },
    { name: 'Next.js + React', descRu: 'весь интерфейс приложения', descEn: 'the entire app interface' },
    { name: 'Tailwind CSS + Framer Motion', descRu: 'стиль и анимации', descEn: 'styling and animations' },
  ]

  return (
    <div className="relative max-w-3xl mx-auto space-y-6 pb-12">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-[560px] h-[340px] rounded-full opacity-60"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(30,215,96,0.14) 0%, rgba(34,211,238,0.05) 45%, transparent 70%)',
          filter: 'blur(48px)',
        }}
      />

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative text-center pt-6"
      >
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          <span className="text-white">{ru ? 'О ' : 'About the '}</span>
          <span
            style={{
              background: 'linear-gradient(90deg, #1ed760 0%, #4ade80 50%, #22d3ee 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {ru ? 'проекте' : 'project'}
          </span>
        </h1>
        <p className="text-[13px] text-white/35 mt-2">
          {ru ? 'Что такое Spot, как он работает и кто его сделал' : 'What Spot is, how it works and who made it'}
        </p>
      </motion.div>

      {/* Purpose */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut', delay: 0.05 }}
        className={CARD}
      >
        <div className="flex items-center gap-2 mb-3">
          <Music2 className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">{ru ? 'Зачем нужен Spot' : 'What Spot is for'}</h2>
        </div>
        <p className="text-[13px] text-white/55 leading-relaxed">
          {ru
            ? 'Spot — бесплатный загрузчик музыки. Вставляешь ссылку на трек, альбом или плейлист из Spotify или YouTube — и получаешь музыку файлами на своём компьютере: с обложками, тегами и в нужном формате. Встроенный плеер позволяет слушать скачанное и собирать свои плейлисты — без интернета и подписок.'
            : 'Spot is a free music downloader. Paste a link to a track, album or playlist from Spotify or YouTube — and get the music as files on your computer: with artwork, tags and in the format you want. The built-in player lets you listen to what you downloaded and build your own playlists — no internet or subscriptions needed.'}
        </p>
        <div className="flex items-start gap-2 mt-4 rounded-2xl p-3" style={{ background: 'var(--wa-04)', border: '1px solid var(--wa-09)' }}>
          <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-white/40 leading-relaxed">
            {ru
              ? 'Проект создан для личного использования. Уважай труд артистов и поддерживай их на официальных площадках.'
              : 'This project is for personal use. Respect the artists\u2019 work and support them on official platforms.'}
          </p>
        </div>
      </motion.section>

      {/* Tech stack */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut', delay: 0.1 }}
        className={CARD}
      >
        <div className="flex items-center gap-2 mb-4">
          <Wrench className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">{ru ? 'Что внутри' : 'Under the hood'}</h2>
        </div>
        <div className="space-y-2.5">
          {tech.map((item) => (
            <div key={item.name} className="flex items-baseline gap-3">
              <span
                className="flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold text-primary"
                style={{ background: 'rgba(30,215,96,0.08)', border: '1px solid rgba(30,215,96,0.18)' }}
              >
                {item.name}
              </span>
              <span className="text-[12px] text-white/40 leading-relaxed">{ru ? item.descRu : item.descEn}</span>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Author */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut', delay: 0.15 }}
        className={CARD}
      >
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">{ru ? 'Автор' : 'Author'}</h2>
        </div>

        <div className="flex items-center gap-4 mb-5">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, rgba(30,215,96,0.15), rgba(34,211,238,0.08))', border: '1px solid rgba(30,215,96,0.2)' }}
          >
            <span className="text-xl font-extrabold text-primary">{AUTHOR.name.charAt(0)}</span>
          </div>
          <div>
            <p className="text-base font-bold">{AUTHOR.name}</p>
            <p className="text-[12px] text-white/40">{ru ? AUTHOR.roleRu : AUTHOR.roleEn}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {visibleLinks.map((link) =>
            link.icon === 'donate' ? (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-semibold text-black transition-transform hover:scale-105"
                style={{ background: 'linear-gradient(90deg, #1ed760, #4ade80)', boxShadow: '0 8px 28px rgba(30,215,96,0.25)' }}
              >
                <LinkIcon icon={link.icon} />
                {ru ? link.labelRu : link.labelEn}
              </a>
            ) : (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-medium text-white/55 hover:text-white transition-colors"
                style={{ background: 'var(--wa-04)', border: '1px solid var(--wa-09)' }}
              >
                <LinkIcon icon={link.icon} />
                {ru ? link.labelRu : link.labelEn}
              </a>
            ),
          )}
        </div>
      </motion.section>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="text-center text-[11px] text-white/25"
      >
        Spot {version ? `v${version}` : ''} • {ru ? 'сделано с' : 'made with'} 💚
      </motion.p>
    </div>
  )
}
