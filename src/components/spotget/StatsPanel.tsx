'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Download,
  CheckCircle2,
  XCircle,
  HardDrive,
  TrendingUp,
  Music,
  Disc3,
  ListMusic,
  User,
  Download as ExportIcon,
} from 'lucide-react'
import { StatCard } from './StatCard'
import { useSpotgetStore } from '@/lib/store'
import { translations } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from 'recharts'

const FORMAT_COLORS: Record<string, string> = {
  mp3: '#1ed760',
  flac: '#b39ddb',
  ogg: '#f5a623',
  wav: '#f15151',
}

export function StatsPanel() {
  const downloads = useSpotgetStore((s) => s.downloads)
  const lang = useSpotgetStore((s) => s.lang)
  const t = translations[lang]
  const { toast } = useToast()

  const stats = useMemo(() => {
    // Count individual TRACK rows only. A "parent" row is any download that
    // other rows point at via parentId (a playlist/album/artist container).
    // Those are not files, so they must be excluded from counts and storage.
    const parentIds = new Set(downloads.filter((d) => d.parentId).map((d) => d.parentId))
    const trackRows = downloads.filter((d) => !parentIds.has(d.id))

    const completed = trackRows.filter((d) => d.status === 'completed')
    const failed = trackRows.filter((d) => d.status === 'failed')
    const pending = trackRows.filter((d) => d.status === 'pending')

    // Prefer exact byte sizes; fall back to parsing "12.3 MB".
    const totalBytes = completed.reduce((acc, d) => {
      if (typeof d.fileSizeBytes === 'number' && d.fileSizeBytes > 0) return acc + d.fileSizeBytes
      const m = (d.fileSize || '').match(/([\d.]+)\s*MB/i)
      return acc + (m ? parseFloat(m[1]) * 1024 * 1024 : 0)
    }, 0)
    const fmtSize = (bytes: number) =>
      bytes >= 1024 * 1024 * 1024
        ? `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
        : `${(bytes / 1024 / 1024).toFixed(1)} MB`
    const sizeStr = fmtSize(totalBytes)

    const downloadsByType: Record<string, number> = {}
    const downloadsByFormat: Record<string, number> = {}
    const artistCounts: Record<string, number> = {}
    const dailyCounts: Record<string, number> = {}

    completed.forEach((d) => {
      downloadsByType[d.type] = (downloadsByType[d.type] || 0) + 1
      downloadsByFormat[d.format] = (downloadsByFormat[d.format] || 0) + 1
      if (d.artist && d.artist !== 'Local File') artistCounts[d.artist] = (artistCounts[d.artist] || 0) + 1
      dailyCounts[d.date] = (dailyCounts[d.date] || 0) + 1
    })

    const topArtists = Object.entries(artistCounts)
      .map(([artist, count]) => ({ artist, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const dailyStats = Object.entries(dailyCounts)
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14)

    const finished = completed.length + failed.length

    return {
      totalDownloads: trackRows.length,
      completedDownloads: completed.length,
      failedDownloads: failed.length,
      pendingDownloads: pending.length,
      successRate: finished > 0 ? Math.round((completed.length / finished) * 100) : 0,
      totalSize: sizeStr,
      storageUsed: sizeStr,
      downloadsByType,
      downloadsByFormat,
      topArtists,
      dailyStats,
    }
  }, [downloads])

  const formatChartData = Object.entries(stats.downloadsByFormat).map(
    ([name, value]) => ({ name: name.toUpperCase(), value })
  )

  const typeIcons: Record<string, React.ReactNode> = {
    song: <Music className="w-4 h-4" />,
    album: <Disc3 className="w-4 h-4" />,
    playlist: <ListMusic className="w-4 h-4" />,
    artist: <User className="w-4 h-4" />,
  }

  const handleExportStats = async () => {
    if (!window.electronAPI) {
      toast({ title: 'Export not available outside Electron', variant: 'destructive' })
      return
    }
    const byPlatform = downloads.reduce((acc, d) => {
      acc[d.platform] = (acc[d.platform] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    const report = {
      exportedAt: new Date().toISOString(),
      ...stats,
      byPlatform,
      byFormat: stats.downloadsByFormat,
      byStatus: downloads.reduce((acc, d) => {
        acc[d.status] = (acc[d.status] || 0) + 1
        return acc
      }, {} as Record<string, number>),
    }
    const result = await window.electronAPI.exportStats(report)
    if (result.success) {
      toast({ title: 'Stats report exported' })
    }
  }

  return (
    <div className="relative max-w-5xl mx-auto space-y-6 pb-12">
      {/* ── Ambient glow ────────────────────────────────── */}
      <div
        className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-[560px] h-[340px] rounded-full opacity-60"
        style={{
          background: "radial-gradient(ellipse at center, rgba(30,215,96,0.14) 0%, rgba(34,211,238,0.05) 45%, transparent 70%)",
          filter: "blur(48px)",
        }}
      />

      {/* ── Hero ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative pt-8 text-center space-y-3"
      >
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
          <span
            style={{
              background: "linear-gradient(90deg, #1ed760 0%, #4ade80 50%, #22d3ee 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {t.statistics}
          </span>
        </h1>
        <p className="text-[13px] text-white/35">{lang === 'ru' ? 'Обзор твоей активности загрузок' : 'Overview of your download activity'}</p>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleExportStats}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-medium text-white/55 hover:text-white transition-colors"
            style={{ background: "var(--wa-04)", border: "1px solid var(--wa-09)" }}
          >
            <ExportIcon className="w-3.5 h-3.5" />
            {t.exportStats}
          </button>
        </div>
      </motion.div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          title={lang === 'ru' ? 'Всего загрузок' : 'Total Downloads'}
          value={stats.totalDownloads}
          icon={<Download className="w-5 h-5" />}
          trend={{ value: 12, positive: true }}
        />
        <StatCard
          title={lang === 'ru' ? 'Успешных' : 'Success Rate'}
          value={`${stats.successRate}%`}
          icon={<CheckCircle2 className="w-5 h-5" />}
          trend={{ value: 5, positive: true }}
        />
        <StatCard
          title={lang === 'ru' ? 'Хранилище' : 'Storage Used'}
          value={stats.storageUsed || stats.totalSize}
          icon={<HardDrive className="w-5 h-5" />}
        />
        <StatCard
          title={lang === 'ru' ? 'Ошибки' : 'Failed'}
          value={stats.failedDownloads}
          icon={<XCircle className="w-5 h-5" />}
          trend={{ value: 3, positive: false }}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily Downloads Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 rounded-3xl border-[1.5px] border-white/10 bg-white/[0.03] backdrop-blur-xl p-5"
        >
          <h3 className="text-sm font-semibold mb-4">{lang === 'ru' ? 'Активность загрузок' : 'Download Activity'}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.dailyStats}>
                <defs>
                  <linearGradient id="colorDownloads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1ed760" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#1ed760" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  stroke="#555"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#555"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--popover)',
                    border: '1px solid #2a2a2a',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#fff',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#1ed760"
                  strokeWidth={2}
                  fill="url(#colorDownloads)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Format Distribution Pie */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-3xl border-[1.5px] border-white/10 bg-white/[0.03] backdrop-blur-xl p-5"
        >
          <h3 className="text-sm font-semibold mb-4">{lang === 'ru' ? 'Распределение по формату' : 'Format Distribution'}</h3>
          <div className="h-48 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={formatChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {formatChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={FORMAT_COLORS[entry.name.toLowerCase()] || '#555'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--popover)',
                    border: '1px solid #2a2a2a',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#fff',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {formatChartData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: FORMAT_COLORS[entry.name.toLowerCase()] || '#555' }}
                />
                <span className="text-muted-foreground">
                  {entry.name} ({entry.value})
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Artists */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-3xl border-[1.5px] border-white/10 bg-white/[0.03] backdrop-blur-xl p-5"
        >
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            {lang === 'ru' ? 'Топ исполнителей' : 'Top Artists'}
          </h3>
          <div className="space-y-3">
            {stats.topArtists.slice(0, 5).map((artist, i) => (
              <div key={artist.artist} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-5">{i + 1}</span>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-xs font-bold text-primary">
                  {artist.artist.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{artist.artist}</p>
                  <div className="mt-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(artist.count / (stats.topArtists[0]?.count || 1)) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.5 + i * 0.1 }}
                      className="h-full rounded-full bg-primary"
                    />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{artist.count} {lang === 'ru' ? 'загр' : 'dl'}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Downloads by Type */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-3xl border-[1.5px] border-white/10 bg-white/[0.03] backdrop-blur-xl p-5"
        >
          <h3 className="text-sm font-semibold mb-4">{lang === 'ru' ? 'Загрузки по типу' : 'Downloads by Type'}</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={Object.entries(stats.downloadsByType).map(([name, value]) => ({
                  name: name.charAt(0).toUpperCase() + name.slice(1),
                  value,
                }))}
                layout="vertical"
              >
                <XAxis type="number" stroke="#555" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#555"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={70}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--popover)',
                    border: '1px solid #2a2a2a',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="value" fill="#1ed760" radius={[0, 6, 6, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
