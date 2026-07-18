'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useSpotgetStore } from '@/lib/store'
import { useAudio } from '@/hooks/useAudio'
import { TitleBar } from '@/components/spotget/TitleBar'
import { Sidebar } from '@/components/spotget/Sidebar'
import { MiniPlayer } from '@/components/spotget/MiniPlayer'
import { FullPlayer } from '@/components/spotget/FullPlayer'
import { AnimatedGradient } from '@/components/spotget/AnimatedGradient'
import { DownloadPanel } from '@/components/spotget/DownloadPanel'
import { PlayerPanel } from '@/components/spotget/PlayerPanel'
import { StatsPanel } from '@/components/spotget/StatsPanel'
import { HistoryPanel } from '@/components/spotget/HistoryPanel'
import { LibraryPanel } from '@/components/spotget/LibraryPanel'
import { SettingsPanel } from '@/components/spotget/SettingsPanel'
import { WhatsNewModal } from '@/components/spotget/WhatsNewModal'
import { Toaster } from '@/components/ui/toaster'

const panels = {
  download: DownloadPanel,
  player: PlayerPanel,
  stats: StatsPanel,
  history: HistoryPanel,
  library: LibraryPanel,
  settings: SettingsPanel,
} as const

export default function Page() {
  // Mount the shared <audio> engine so playback works app-wide.
  useAudio()

  const activePanel = useSpotgetStore((s) => s.activePanel)
  const isPlayerOpen = useSpotgetStore((s) => s.isPlayerOpen)
  const ActivePanel = panels[activePanel] ?? DownloadPanel

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <AnimatedGradient />
      <TitleBar />

      <div className="relative z-10 flex min-h-0 flex-1">
        <Sidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <main className="min-h-0 flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activePanel}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="h-full p-4 md:p-6"
              >
                <ActivePanel />
              </motion.div>
            </AnimatePresence>
          </main>

          <MiniPlayer />
        </div>
      </div>

      <AnimatePresence>{isPlayerOpen && <FullPlayer />}</AnimatePresence>

      <WhatsNewModal />
      <Toaster />
    </div>
  )
}
