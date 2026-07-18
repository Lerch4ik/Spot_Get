'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { useSpotgetStore } from '@/lib/store'
import { WHATS_NEW } from '@/lib/whatsnew'

const LAST_SEEN_KEY = 'spot-last-seen-version'

// Shows a one-time "What's new" dialog after the app has been updated.
// The notes themselves live in src/lib/whatsnew.ts — edit them per release.
export function WhatsNewModal() {
  const lang = useSpotgetStore((s) => s.lang)
  const [version, setVersion] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined
    if (!api?.getAppVersion) return
    api
      .getAppVersion()
      .then((v: string) => {
        if (!v) return
        setVersion(v)
        let last: string | null = null
        try {
          last = localStorage.getItem(LAST_SEEN_KEY)
        } catch {}
        if (last && last !== v) {
          // The app was updated since the user last saw the dialog.
          setOpen(true)
        } else if (!last) {
          // First run (fresh install) — remember the version silently.
          try {
            localStorage.setItem(LAST_SEEN_KEY, v)
          } catch {}
        }
      })
      .catch(() => {})
  }, [])

  const close = () => {
    try {
      if (version) localStorage.setItem(LAST_SEEN_KEY, version)
    } catch {}
    setOpen(false)
  }

  const notes = lang === 'ru' ? WHATS_NEW.ru : WHATS_NEW.en

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-3xl p-8 text-center overflow-hidden"
            style={{
              background: 'rgba(18,18,18,0.97)',
              border: '1.5px solid rgba(255,255,255,0.1)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            }}
          >
            {/* glow inside the card */}
            <div
              className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[360px] h-[220px] rounded-full"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(30,215,96,0.18) 0%, transparent 70%)',
                filter: 'blur(40px)',
              }}
            />

            <div className="relative space-y-5">
              <div
                className="mx-auto w-16 h-16 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(30,215,96,0.15), rgba(34,211,238,0.08))',
                  border: '1px solid rgba(30,215,96,0.3)',
                }}
              >
                <Sparkles className="w-8 h-8" style={{ color: '#1ed760' }} />
              </div>

              <div className="space-y-1">
                <h2 className="text-2xl font-extrabold tracking-tight">
                  <span
                    style={{
                      background: 'linear-gradient(90deg, #1ed760 0%, #4ade80 50%, #22d3ee 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {lang === 'ru' ? 'Что нового' : "What's new"}
                  </span>
                </h2>
                {version && (
                  <p className="text-[12px] font-mono text-white/30">
                    {lang === 'ru' ? 'Версия' : 'Version'} {version}
                  </p>
                )}
              </div>

              <ul className="space-y-2.5 text-left">
                {notes.map((note, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + i * 0.07 }}
                    className="flex items-start gap-2.5 text-[13px] leading-snug text-white/70"
                  >
                    <span
                      className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: '#1ed760', boxShadow: '0 0 8px rgba(30,215,96,0.6)' }}
                    />
                    {note}
                  </motion.li>
                ))}
              </ul>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={close}
                className="w-full py-3 rounded-full font-bold text-sm text-black"
                style={{
                  background: 'linear-gradient(90deg, #1ed760, #4ade80)',
                  boxShadow: '0 8px 28px rgba(30,215,96,0.3)',
                }}
              >
                {lang === 'ru' ? 'Отлично!' : 'Got it!'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
