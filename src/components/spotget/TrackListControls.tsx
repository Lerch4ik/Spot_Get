'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, ArrowUpDown, ChevronDown, Check } from 'lucide-react'

export type TrackSortMode = 'default' | 'title' | 'artist' | 'duration' | 'durationDesc'

type SortableTrack = { title?: string; artist?: string; duration?: number }

export function filterTracks<T extends SortableTrack>(tracks: T[], search: string): T[] {
  const q = search.trim().toLowerCase()
  if (!q) return tracks
  return tracks.filter(
    (t) => (t.title || '').toLowerCase().includes(q) || (t.artist || '').toLowerCase().includes(q),
  )
}

export function sortTracks<T extends SortableTrack>(tracks: T[], sort: TrackSortMode): T[] {
  if (sort === 'default') return tracks
  const byText = (a?: string, b?: string) =>
    (a || '').localeCompare(b || '', undefined, { sensitivity: 'base' })
  const arr = [...tracks]
  switch (sort) {
    case 'title':
      return arr.sort((a, b) => byText(a.title, b.title))
    case 'artist':
      return arr.sort((a, b) => byText(a.artist, b.artist) || byText(a.title, b.title))
    case 'duration':
      return arr.sort((a, b) => (a.duration || 0) - (b.duration || 0))
    case 'durationDesc':
      return arr.sort((a, b) => (b.duration || 0) - (a.duration || 0))
    default:
      return arr
  }
}

/**
 * Custom dropdown styled like the app's pills. We deliberately avoid the
 * native <select>: in Electron its popup is rendered by the OS and its
 * options are unreadable in the dark theme.
 */
export function PillSelect({
  value,
  options,
  onChange,
}: {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close when clicking anywhere outside the dropdown.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const current = options.find((o) => o.value === value)

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs text-foreground cursor-pointer transition-colors hover:border-primary/40"
        style={{ background: 'var(--wa-04)', border: '1px solid var(--wa-09)' }}
      >
        <ArrowUpDown className="w-3 h-3 text-muted-foreground/60" />
        <span className="whitespace-nowrap">{current?.label ?? ''}</span>
        <ChevronDown
          className={`w-3 h-3 text-muted-foreground/60 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[190px] py-1.5 rounded-xl bg-popover text-popover-foreground border border-border shadow-2xl">
          {options.map((opt) => {
            const active = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-secondary ${
                  active ? 'text-primary font-medium' : 'text-foreground'
                }`}
              >
                <span className="whitespace-nowrap">{opt.label}</span>
                {active && <Check className="w-3 h-3 flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function TrackListControls({
  search,
  onSearch,
  sort,
  onSort,
  lang,
}: {
  search: string
  onSearch: (value: string) => void
  sort: TrackSortMode
  onSort: (value: TrackSortMode) => void
  lang: string
}) {
  const ru = lang === 'ru'

  const sortOptions: Array<{ value: TrackSortMode; label: string }> = [
    { value: 'default', label: ru ? 'По порядку' : 'Default order' },
    { value: 'title', label: ru ? 'По названию (А-Я)' : 'By title (A-Z)' },
    { value: 'artist', label: ru ? 'По исполнителю (А-Я)' : 'By artist (A-Z)' },
    { value: 'duration', label: ru ? 'Короткие сначала' : 'Shortest first' },
    { value: 'durationDesc', label: ru ? 'Длинные сначала' : 'Longest first' },
  ]

  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={ru ? 'Поиск трека или исполнителя…' : 'Search track or artist…'}
          className="w-full pl-8 pr-3 py-2 rounded-full text-xs text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-primary/40"
          style={{ background: 'var(--wa-04)', border: '1px solid var(--wa-09)' }}
        />
      </div>
      <PillSelect
        value={sort}
        options={sortOptions}
        onChange={(v) => onSort(v as TrackSortMode)}
      />
    </div>
  )
}
