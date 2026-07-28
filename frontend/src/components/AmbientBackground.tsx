import { motion } from 'framer-motion';

export default function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      {/* Dynamic Ambient Grid & Radial Mesh */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.15) 1px, transparent 0)`,
          backgroundSize: '36px 36px',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#030408]/60 via-transparent to-[#030408]/90" />

      {/* Floating Liquid Glass Glow Orbs */}
      <motion.div
        animate={{
          x: [0, 80, -40, 0],
          y: [0, -60, 40, 0],
          scale: [1, 1.3, 0.85, 1],
          opacity: [0.35, 0.55, 0.3, 0.35],
        }}
        transition={{
          duration: 16,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute -top-32 -left-32 w-[34rem] h-[34rem] rounded-full bg-gradient-to-tr from-clinical-blue/30 to-purple-500/20 blur-[140px]"
      />

      <motion.div
        animate={{
          x: [0, -90, 50, 0],
          y: [0, 70, -40, 0],
          scale: [1.15, 0.9, 1.25, 1.15],
          opacity: [0.25, 0.45, 0.2, 0.25],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2
        }}
        className="absolute top-1/3 -right-32 w-[36rem] h-[36rem] rounded-full bg-gradient-to-br from-clinical-teal/25 to-emerald-400/15 blur-[160px]"
      />

      <motion.div
        animate={{
          x: [0, 60, -60, 0],
          y: [0, -40, 60, 0],
          scale: [0.9, 1.2, 0.95, 0.9],
          opacity: [0.2, 0.4, 0.25, 0.2],
        }}
        transition={{
          duration: 24,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 4
        }}
        className="absolute -bottom-40 left-1/4 w-[32rem] h-[32rem] rounded-full bg-gradient-to-tr from-purple-600/20 to-clinical-blue/20 blur-[150px]"
      />
    </div>
  );
}
