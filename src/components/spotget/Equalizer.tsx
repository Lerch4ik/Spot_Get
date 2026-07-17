'use client'

import { motion } from 'framer-motion'
import { useSpotgetStore } from '@/lib/store'

const BAND_LABELS = ['32', '64', '125', '250', '500', '1K', '2K', '4K', '8K', '16K']

export function Equalizer() {
  const { eqBands, eqPreset, eqPresets, setEqBand, setEqPreset } = useSpotgetStore()

  return (
    <div className="space-y-5">
      {/* Presets */}
      <div>
        <label className="text-xs text-muted-foreground mb-2 block">Preset</label>
        <div className="flex flex-wrap gap-2">
          {eqPresets.map((p) => (
            <motion.button
              key={p.name}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setEqPreset(p.name)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                eqPreset === p.name
                  ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_12px_rgba(30,215,96,0.3)]'
                  : 'bg-secondary text-secondary-foreground border-border hover:border-border2'
              }`}
            >
              {p.name}
            </motion.button>
          ))}
        </div>
      </div>

      {/* EQ Bands */}
      <div className="rounded-xl border border-border bg-secondary/50 p-4">
        <div className="flex items-end justify-between gap-1" style={{ height: 180 }}>
          {eqBands.map((value, index) => (
            <div key={index} className="flex flex-col items-center gap-2 flex-1">
              {/* Value label */}
              <span className="text-[9px] text-muted-foreground font-mono">
                {value > 0 ? '+' : ''}{value}
              </span>

              {/* Vertical slider */}
              <div className="relative h-32 w-full flex items-center justify-center">
                <div className="absolute h-full w-0.5 bg-border" />
                <div
                  className="absolute w-full h-0.5 bg-primary/30"
                  style={{ bottom: '50%' }}
                />
                <input
                  type="range"
                  min={-12}
                  max={12}
                  value={value}
                  onChange={(e) => setEqBand(index, parseInt(e.target.value))}
                  className="eq-slider"
                  style={{
                    writingMode: 'vertical-lr' as any,
                    direction: 'rtl',
                    width: '100%',
                    height: '100%',
                  }}
                />
              </div>

              {/* Band label */}
              <span className="text-[8px] text-muted-foreground/60">
                {BAND_LABELS[index]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
