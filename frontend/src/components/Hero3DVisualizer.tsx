import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function Hero3DVisualizer() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene, Camera, Renderer Setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020306, 0.008);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.z = 40;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 2. Fullscreen Autonomous Particle Field (Spread All Over Screen)
    const particleCount = 3600;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const originalY = new Float32Array(particleCount);
    const speeds = new Float32Array(particleCount);
    const colors = new Float32Array(particleCount * 3);

    const colorCyan = new THREE.Color(0x00f2fe);
    const colorSapphire = new THREE.Color(0x38bdf8);
    const colorPurple = new THREE.Color(0x8b5cf6);
    const colorTeal = new THREE.Color(0x2dd4bf);

    for (let i = 0; i < particleCount; i++) {
      // Fullscreen screen-space spread
      const x = (Math.random() - 0.5) * 160;
      const y = (Math.random() - 0.5) * 110;
      const z = (Math.random() - 0.5) * 70;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      originalY[i] = y;
      speeds[i] = 0.4 + Math.random() * 0.8;

      // Color variation across palette
      const rand = Math.random();
      const mixedColor = rand < 0.35 
        ? colorCyan 
        : rand < 0.7 
        ? colorSapphire 
        : rand < 0.88 
        ? colorPurple 
        : colorTeal;

      colors[i * 3] = mixedColor.r;
      colors[i * 3 + 1] = mixedColor.g;
      colors[i * 3 + 2] = mixedColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Particle Material with Soft Glowing Dots
    const material = new THREE.PointsMaterial({
      size: 0.38,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });

    const particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);

    // Window Resize Handler
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth || window.innerWidth;
      const h = containerRef.current.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop with Autonomous Slow Waves (No Cursor Dependency)
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Continuous Slow Autonomous Rotation
      particleSystem.rotation.y = elapsedTime * 0.015;
      particleSystem.rotation.z = Math.sin(elapsedTime * 0.01) * 0.02;

      // Gentle Floating Wave Motion for Particles
      const positionAttr = geometry.attributes.position as THREE.BufferAttribute;
      const posArray = positionAttr.array as Float32Array;

      for (let i = 0; i < particleCount; i++) {
        const speed = speeds[i];
        const yBase = originalY[i];
        
        // Sine/Cosine wave drift
        posArray[i * 3 + 1] = yBase + Math.sin(elapsedTime * speed + i) * 1.5;
        posArray[i * 3] += Math.cos(elapsedTime * 0.2 + i) * 0.005;

        // Wrap around bounds for infinite continuous flow
        if (posArray[i * 3] > 80) posArray[i * 3] = -80;
        if (posArray[i * 3] < -80) posArray[i * 3] = 80;
      }
      positionAttr.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none opacity-80 transition-opacity duration-1000"
    />
  );
}
