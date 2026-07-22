import React from 'react';
import { motion } from 'framer-motion';

interface GlassCard3DProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: 'cyan' | 'teal' | 'purple' | 'emerald' | 'rose' | 'amber';
  hoverEffect?: boolean;
}

const glowColorStyles = {
  cyan: 'hover:border-[#00f2fe]/40 hover:shadow-[0_20px_50px_rgba(0,242,254,0.18)]',
  teal: 'hover:border-clinical-teal/40 hover:shadow-[0_20px_50px_rgba(45,212,191,0.18)]',
  purple: 'hover:border-clinical-purple/40 hover:shadow-[0_20px_50px_rgba(139,92,246,0.18)]',
  emerald: 'hover:border-clinical-emerald/40 hover:shadow-[0_20px_50px_rgba(16,185,129,0.18)]',
  rose: 'hover:border-clinical-rose/40 hover:shadow-[0_20px_50px_rgba(244,63,94,0.18)]',
  amber: 'hover:border-amber-450/40 hover:shadow-[0_20px_50px_rgba(245,158,11,0.18)]',
};

export default function GlassCard3D({
  children,
  className = '',
  glowColor = 'cyan',
  hoverEffect = true
}: GlassCard3DProps) {
  return (
    <motion.div
      whileHover={hoverEffect ? { y: -6, scale: 1.01 } : undefined}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      className={`glass-panel rounded-[28px] border border-white/[0.08] p-6 transition-all duration-300 relative overflow-hidden ${
        glowColorStyles[glowColor]
      } ${className}`}
    >
      {/* Specular Top Rim Highlight */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none z-10" />

      {/* Ambient Inner Shadow */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
