import { motion } from 'framer-motion';

export default function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      {/* Background Dot & Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-dot-pattern opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050508]/60 to-[#050508]" />

      {/* Floating Luminous Orbs */}
      <motion.div
        animate={{
          x: [0, 50, -30, 0],
          y: [0, -40, 30, 0],
          scale: [1, 1.2, 0.9, 1],
          opacity: [0.25, 0.4, 0.25, 0.25],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-clinical-blue/20 blur-[130px]"
      />

      <motion.div
        animate={{
          x: [0, -60, 40, 0],
          y: [0, 50, -30, 0],
          scale: [1.1, 0.85, 1.15, 1.1],
          opacity: [0.2, 0.35, 0.15, 0.2],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2
        }}
        className="absolute top-1/3 -right-32 w-[30rem] h-[30rem] rounded-full bg-clinical-teal/15 blur-[150px]"
      />

      <motion.div
        animate={{
          x: [0, 40, -40, 0],
          y: [0, -30, 50, 0],
          scale: [0.9, 1.1, 0.95, 0.9],
          opacity: [0.15, 0.3, 0.2, 0.15],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 5
        }}
        className="absolute -bottom-40 left-1/4 w-[28rem] h-[28rem] rounded-full bg-clinical-purple/15 blur-[140px]"
      />
    </div>
  );
}
