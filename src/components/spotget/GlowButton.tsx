'use client'

import { motion } from 'framer-motion'

interface GlowButtonProps {
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  children: React.ReactNode
  className?: string
  size?: 'default' | 'lg' | 'sm'
}

export function GlowButton({
  onClick,
  disabled,
  loading,
  children,
  className = '',
  size = 'default',
}: GlowButtonProps) {
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    default: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  }

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        relative overflow-hidden rounded-xl font-bold transition-all duration-300
        bg-primary text-primary-foreground
        shadow-[0_0_20px_rgba(30,215,96,0.3),0_0_60px_rgba(30,215,96,0.1)]
        hover:shadow-[0_0_25px_rgba(30,215,96,0.4),0_0_80px_rgba(30,215,96,0.15)]
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[0_0_20px_rgba(30,215,96,0.3)]
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {/* Shimmer overlay */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        initial={{ x: '-100%' }}
        animate={loading ? { x: '100%' } : {}}
        transition={{ duration: 1.5, repeat: loading ? Infinity : 0, ease: 'linear' }}
      />
      <span className="relative flex items-center justify-center gap-2">
        {children}
      </span>
    </motion.button>
  )
}
