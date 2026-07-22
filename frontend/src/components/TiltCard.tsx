import React, { useRef, useState } from 'react';
import { motion, useSpring } from 'framer-motion';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  glare?: boolean;
  scaleOnHover?: number;
}

export default function TiltCard({
  children,
  className = '',
  maxTilt = 12,
  glare = true,
  scaleOnHover = 1.02
}: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [glarePosition, setGlarePosition] = useState({ x: 50, y: 50, opacity: 0 });

  const springConfig = { stiffness: 350, damping: 25 };
  const rotateX = useSpring(0, springConfig);
  const rotateY = useSpring(0, springConfig);
  const scale = useSpring(1, springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const rX = ((mouseY - height / 2) / (height / 2)) * -maxTilt;
    const rY = ((mouseX - width / 2) / (width / 2)) * maxTilt;

    rotateX.set(rX);
    rotateY.set(rY);

    const posX = (mouseX / width) * 100;
    const posY = (mouseY / height) * 100;
    setGlarePosition({ x: posX, y: posY, opacity: 0.35 });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    scale.set(scaleOnHover);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    rotateX.set(0);
    rotateY.set(0);
    scale.set(1);
    setGlarePosition(prev => ({ ...prev, opacity: 0 }));
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        scale,
        transformStyle: 'preserve-3d',
        perspective: 1000
      }}
      className={`relative transition-shadow duration-300 ${
        isHovered ? 'shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85),0_0_30px_rgba(56,189,248,0.15)] border-white/15' : ''
      } ${className}`}
    >
      {/* Specular Glare Reflection Overlay */}
      {glare && (
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300 z-30 overflow-hidden"
          style={{
            opacity: glarePosition.opacity,
            background: `radial-gradient(circle at ${glarePosition.x}% ${glarePosition.y}%, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.05) 40%, transparent 80%)`
          }}
        />
      )}

      {children}
    </motion.div>
  );
}
