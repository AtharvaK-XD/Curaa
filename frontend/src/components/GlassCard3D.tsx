import React from 'react';
import { motion } from 'framer-motion';

interface GlassCard3DProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: 'cyan' | 'teal' | 'purple' | 'emerald' | 'rose' | 'amber';
  hoverEffect?: boolean;
}

const glowColorStyles = {
  cyan: 'hover:border-[#38bdf8]/60 hover:shadow-[0_20px_50px_rgba(56,189,248,0.25)]',
  teal: 'hover:border-clinical-teal/60 hover:shadow-[0_20px_50px_rgba(45,212,191,0.25)]',
  purple: 'hover:border-clinical-purple/60 hover:shadow-[0_20px_50px_rgba(167,139,250,0.25)]',
  emerald: 'hover:border-clinical-emerald/60 hover:shadow-[0_20px_50px_rgba(52,211,153,0.25)]',
  rose: 'hover:border-clinical-rose/60 hover:shadow-[0_20px_50px_rgba(251,113,133,0.25)]',
  amber: 'hover:border-amber-400/60 hover:shadow-[0_20px_50px_rgba(245,158,11,0.25)]',
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
      className={`liquid-glass-card rounded-[32px] p-6 sm:p-8 transition-all duration-300 relative overflow-hidden ${
        glowColorStyles[glowColor]
      } ${className}`}
    >
      {/* Liquid Glass Specular Top Highlight */}
      <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none z-10" />

      {/* Content Container */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
