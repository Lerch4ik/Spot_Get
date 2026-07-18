'use client'

import { useState, type ReactNode, type UIEvent } from 'react'

/**
 * Windowed (virtualized) list: renders ONLY the rows currently visible in the
 * scroll viewport (plus a small overscan buffer), no matter how many items
 * the list holds. A 1000-track list renders ~20 DOM rows instead of 1000,
 * so scrolling stays perfectly smooth and there is no "Show more" button —
 * every track is reachable by just scrolling.
 *
 * Rows must have a (roughly) fixed height: each row is wrapped in a container
 * of exactly `itemHeight` px (content + gap), so pass the real row height.
 */
export function VirtualList<T>({
  items,
  itemHeight,
  maxHeight,
  renderItem,
  className = '',
  overscan = 8,
}: {
  items: T[]
  itemHeight: number
  maxHeight: number | string
  renderItem: (item: T, index: number) => ReactNode
  className?: string
  overscan?: number
}) {
  const [scrollTop, setScrollTop] = useState(0)
  const [viewport, setViewport] = useState(640)

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
    if (e.currentTarget.clientHeight !== viewport) setViewport(e.currentTarget.clientHeight)
  }

  const totalHeight = items.length * itemHeight
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const end = Math.min(items.length, Math.ceil((scrollTop + viewport) / itemHeight) + overscan)

  return (
    <div
      onScroll={onScroll}
      className={`overflow-y-auto pr-1 ${className}`}
      style={{ maxHeight }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ position: 'absolute', top: start * itemHeight, left: 0, right: 0 }}>
          {items.slice(start, end).map((item, i) => (
            <div key={start + i} style={{ height: itemHeight, boxSizing: 'border-box' }}>
              {renderItem(item, start + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
