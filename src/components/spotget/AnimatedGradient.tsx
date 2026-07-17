'use client'

import { motion } from 'framer-motion'

export function AnimatedGradient() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Aurora gradient */}
      <div className="aurora-bg absolute inset-0 opacity-60" />
      
      {/* Floating orbs */}
      <motion.div
        className="absolute w-64 h-64 rounded-full opacity-10"
        style={{
          background: 'radial-gradient(circle, #1ed760 0%, transparent 70%)',
          top: '10%',
          right: '10%',
        }}
        animate={{
          x: [0, 30, -20, 0],
          y: [0, -20, 15, 0],
          scale: [1, 1.1, 0.9, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute w-48 h-48 rounded-full opacity-8"
        style={{
          background: 'radial-gradient(circle, #17a84a 0%, transparent 70%)',
          bottom: '20%',
          left: '5%',
        }}
        animate={{
          x: [0, -25, 15, 0],
          y: [0, 25, -10, 0],
          scale: [1, 0.9, 1.15, 1],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute w-32 h-32 rounded-full opacity-5"
        style={{
          background: 'radial-gradient(circle, #b39ddb 0%, transparent 70%)',
          top: '40%',
          right: '30%',
        }}
        animate={{
          x: [0, 20, -30, 0],
          y: [0, -15, 20, 0],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(30, 215, 96, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(30, 215, 96, 0.3) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
    </div>
  )
}
