import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function Hero3DVisualizer() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene, Camera, Renderer Setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030408, 0.006);

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    camera.position.set(0, 0, 35);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // 2. Central 3D Holographic Liquid Ring / Mesh (Curaa Core Symbol)
    const torusGeometry = new THREE.TorusKnotGeometry(8, 2.2, 180, 32, 2, 3);
    const torusMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x034b75,
      roughness: 0.15,
      metalness: 0.8,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      transmission: 0.6,
      ior: 1.4,
      transparent: true,
      opacity: 0.75,
      wireframe: false,
    });

    const torusMesh = new THREE.Mesh(torusGeometry, torusMaterial);
    torusMesh.position.set(22, 2, -5);
    scene.add(torusMesh);

    // Inner Glowing Core Sphere
    const coreGeo = new THREE.IcosahedronGeometry(4.5, 4);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x14b8a6,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    torusMesh.add(coreMesh);

    // 3. Lighting System (Dynamic Floating Lights)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const cyanLight = new THREE.PointLight(0x38bdf8, 800, 100);
    cyanLight.position.set(20, 20, 20);
    scene.add(cyanLight);

    const tealLight = new THREE.PointLight(0x14b8a6, 600, 100);
    tealLight.position.set(-20, -20, 15);
    scene.add(tealLight);

    const purpleLight = new THREE.PointLight(0xa855f7, 500, 100);
    purpleLight.position.set(0, 30, -10);
    scene.add(purpleLight);

    // 4. Soft Glowing Particle Texture
    const createStarTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.25, 'rgba(56, 189, 248, 0.9)');
      gradient.addColorStop(0.6, 'rgba(20, 184, 166, 0.3)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    };

    const particleCount = 2800;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const colorCyan = new THREE.Color(0x38bdf8);
    const colorTeal = new THREE.Color(0x14b8a6);
    const colorPurple = new THREE.Color(0xa855f7);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 160;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 120;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80;

      const rand = Math.random();
      const mixedColor = rand < 0.45 ? colorCyan : rand < 0.8 ? colorTeal : colorPurple;

      colors[i * 3] = mixedColor.r;
      colors[i * 3 + 1] = mixedColor.g;
      colors[i * 3 + 2] = mixedColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.75,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      map: createStarTexture() || undefined,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, particleMaterial);
    scene.add(particles);

    // 5. Interactive Mouse Parallax
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // 6. GSAP ScrollTrigger Integration for 3D Camera & Mesh Transforms
    const st = ScrollTrigger.create({
      trigger: document.body,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1.2,
      onUpdate: (self) => {
        const progress = self.progress;
        
        // Rotate and move the 3D torus knot dynamically as user scrolls
        gsap.to(torusMesh.rotation, {
          x: progress * Math.PI * 4,
          y: progress * Math.PI * 6,
          duration: 0.5,
          ease: 'power1.out',
        });

        gsap.to(torusMesh.position, {
          x: 22 - progress * 40,
          y: 2 - progress * 10,
          z: -5 + Math.sin(progress * Math.PI * 2) * 15,
          duration: 0.5,
          ease: 'power1.out',
        });

        gsap.to(camera.position, {
          z: 35 - progress * 10,
          duration: 0.5,
          ease: 'power1.out',
        });
      },
    });

    // 7. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth mouse follow
      targetX += (mouseX - targetX) * 0.05;
      targetY += (mouseY - targetY) * 0.05;

      torusMesh.rotation.x += 0.005;
      torusMesh.rotation.y += 0.008;
      coreMesh.rotation.y -= 0.012;

      // Pulse core
      const pulse = 1 + Math.sin(elapsedTime * 2.5) * 0.08;
      coreMesh.scale.set(pulse, pulse, pulse);

      // Particle slow drift
      particles.rotation.y = elapsedTime * 0.03 + targetX * 0.2;
      particles.rotation.x = elapsedTime * 0.015 + targetY * 0.2;

      camera.position.x += (targetX * 3 - camera.position.x) * 0.04;
      camera.position.y += (-targetY * 3 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    animate();

    // 8. Resize Handler
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth || window.innerWidth;
      const h = containerRef.current.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      st.kill();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-90 transition-opacity duration-1000"
      style={{ background: 'radial-gradient(circle at 50% 30%, rgba(15, 23, 42, 0.8) 0%, rgba(3, 4, 8, 1) 100%)' }}
    />
  );
}
