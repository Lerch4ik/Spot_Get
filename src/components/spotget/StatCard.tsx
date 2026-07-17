'use client'

import { motion } from 'framer-motion'

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  trend?: { value: number; positive: boolean }
  className?: string
}

export function StatCard({ title, value, icon, trend, className = '' }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={`relative overflow-hidden rounded-xl glass-card p-4 md:p-5 group ${className}`}
    >
      {/* Glow effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-primary/5 to-transparent" />
      
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs md:text-sm text-muted-foreground mb-1 truncate">{title}</p>
          <p className="text-xl md:text-2xl font-bold truncate">{value}</p>
          {trend && (
            <p className={`text-xs mt-1 flex items-center gap-1 ${trend.positive ? 'text-primary' : 'text-destructive'}`}>
              <span>{trend.positive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
            </p>
          )}
        </div>
        <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
          {icon}
        </div>
      </div>
      
      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </motion.div>
  )
}
