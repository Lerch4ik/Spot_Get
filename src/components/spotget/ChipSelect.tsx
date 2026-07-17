'use client'

import { motion } from 'framer-motion'

const formats = ['mp3', 'flac', 'ogg', 'wav'] as const
const bitrates = ['128k', '192k', '256k', '320k'] as const

type Format = (typeof formats)[number]
type Bitrate = (typeof bitrates)[number]

interface ChipSelectProps<T extends string> {
  options?: readonly T[]
  value: T
  onChange: (value: T) => void
  label?: string
}

export function FormatChipSelect({ value, onChange, label }: ChipSelectProps<Format>) {
  return (
    <div>
      {label && <label className="text-xs text-muted-foreground mb-2 block">{label}</label>}
      <div className="flex gap-2 flex-wrap">
        {formats.map((fmt) => (
          <motion.button
            key={fmt}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onChange(fmt)}
            className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 border ${
              value === fmt
                ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_12px_rgba(30,215,96,0.3)]'
                : 'bg-secondary text-secondary-foreground border-border hover:border-border2 hover:bg-surface3'
            }`}
          >
            {fmt.toUpperCase()}
          </motion.button>
        ))}
      </div>
    </div>
  )
}

export function BitrateChipSelect({ value, onChange, label }: ChipSelectProps<Bitrate>) {
  return (
    <div>
      {label && <label className="text-xs text-muted-foreground mb-2 block">{label}</label>}
      <div className="flex gap-2 flex-wrap">
        {bitrates.map((br) => (
          <motion.button
            key={br}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onChange(br)}
            className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 border ${
              value === br
                ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_12px_rgba(30,215,96,0.3)]'
                : 'bg-secondary text-secondary-foreground border-border hover:border-border2 hover:bg-surface3'
            }`}
          >
            {br}
          </motion.button>
        ))}
      </div>
    </div>
  )
}

interface TypeChipSelectProps {
  value: string
  onChange: (value: string) => void
  options: string[]
}

export function TypeChipSelect({ value, onChange, options }: TypeChipSelectProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map((opt) => (
        <motion.button
          key={opt}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all duration-200 border ${
            value === opt
              ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_12px_rgba(30,215,96,0.3)]'
              : 'bg-secondary text-secondary-foreground border-border hover:border-border2 hover:bg-white/10'
          }`}
        >
          {opt}
        </motion.button>
      ))}
    </div>
  )
}

const platforms = ['spotify', 'yandex', 'soundcloud', 'youtube', 'apple'] as const
type Platform = (typeof platforms)[number]

const platformNames: Record<Platform, string> = {
  spotify: 'Spotify',
  yandex: 'Yandex',
  soundcloud: 'SoundCloud',
  youtube: 'YouTube',
  apple: 'Apple',
}

const platformColors: Record<Platform, string> = {
  spotify: '#1ed760',
  yandex: '#ffcc00',
  soundcloud: '#ff5500',
  youtube: '#ff0000',
  apple: '#fa2d48',
}

export function PlatformChipSelect({ value, onChange, showAll = false }: { value: string; onChange: (value: string) => void; showAll?: boolean }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {showAll && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onChange('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border ${
            value === 'all'
              ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_12px_rgba(30,215,96,0.3)]'
              : 'bg-secondary text-secondary-foreground border-border hover:border-border2 hover:bg-white/10'
          }`}
        >
          All
        </motion.button>
      )}
      {platforms.map((p) => (
        <motion.button
          key={p}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onChange(p)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border ${
            value === p
              ? 'text-white border-transparent shadow-lg'
              : 'bg-secondary text-secondary-foreground border-border hover:border-border2 hover:bg-white/10'
          }`}
          style={value === p ? {
            backgroundColor: platformColors[p] + '30',
            borderColor: platformColors[p] + '60',
            color: platformColors[p],
            boxShadow: `0 0 12px ${platformColors[p]}33`,
          } : undefined}
        >
          {platformNames[p]}
        </motion.button>
      ))}
    </div>
  )
}
