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

    // 2. Helper to generate soft glowing star texture
    const createStarTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
      gradient.addColorStop(0.6, 'rgba(56, 189, 248, 0.3)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 32, 32);

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    };

    const starTexture = createStarTexture();

    // 3. Fullscreen Autonomous Particle Field (Spread All Over Screen)
    const particleCount = 4200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const originalY = new Float32Array(particleCount);
    const speeds = new Float32Array(particleCount);
    const colors = new Float32Array(particleCount * 3);

    const colorCyan = new THREE.Color(0x00f2fe);
    const colorSapphire = new THREE.Color(0x38bdf8);
    const colorPurple = new THREE.Color(0xa855f7);
    const colorTeal = new THREE.Color(0x2dd4bf);

    for (let i = 0; i < particleCount; i++) {
      // Fullscreen screen-space spread tuned for perspective camera z=40
      const x = (Math.random() - 0.5) * 170;
      const y = (Math.random() - 0.5) * 85;
      const z = (Math.random() - 0.5) * 60;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      originalY[i] = y;
      speeds[i] = 0.3 + Math.random() * 0.7;

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

    // Particle Material with Soft Glowing Stars
    const material = new THREE.PointsMaterial({
      size: 0.65,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      map: starTexture || undefined,
      blending: THREE.AdditiveBlending,
      depthWrite: false
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

    // Animation Loop with Autonomous Slow Waves
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Continuous Slow Autonomous Rotation
      particleSystem.rotation.y = elapsedTime * 0.012;
      particleSystem.rotation.z = Math.sin(elapsedTime * 0.008) * 0.015;

      // Gentle Floating Wave Motion for Particles
      const positionAttr = geometry.attributes.position as THREE.BufferAttribute;
      const posArray = positionAttr.array as Float32Array;

      for (let i = 0; i < particleCount; i++) {
        const speed = speeds[i];
        const yBase = originalY[i];
        
        // Sine/Cosine wave drift
        posArray[i * 3 + 1] = yBase + Math.sin(elapsedTime * speed + i) * 1.8;
        posArray[i * 3] += Math.cos(elapsedTime * 0.15 + i) * 0.006;

        // Wrap around bounds for infinite continuous flow across screen
        if (posArray[i * 3] > 85) posArray[i * 3] = -85;
        if (posArray[i * 3] < -85) posArray[i * 3] = 85;
        if (posArray[i * 3 + 1] > 42) posArray[i * 3 + 1] = -42;
        if (posArray[i * 3 + 1] < -42) posArray[i * 3 + 1] = 42;
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
