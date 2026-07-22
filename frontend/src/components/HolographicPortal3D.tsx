import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface HolographicPortal3DProps {
  className?: string;
  color?: string;
}

export default function HolographicPortal3D({ className = 'w-48 h-48', color = '#00f2fe' }: HolographicPortal3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || 200;
    const height = container.clientHeight || 200;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.z = 12;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const themeColor = new THREE.Color(color);

    // 1. Holographic Torus Ring
    const torusGeo = new THREE.TorusGeometry(3.5, 0.15, 16, 64);
    const torusMat = new THREE.MeshBasicMaterial({
      color: themeColor,
      wireframe: true,
      transparent: true,
      opacity: 0.7
    });
    const torusMesh = new THREE.Mesh(torusGeo, torusMat);
    scene.add(torusMesh);

    // 2. Inner Floating Octahedron Core
    const octaGeo = new THREE.OctahedronGeometry(2, 0);
    const octaMat = new THREE.MeshBasicMaterial({
      color: themeColor,
      wireframe: true,
      transparent: true,
      opacity: 0.4
    });
    const octaMesh = new THREE.Mesh(octaGeo, octaMat);
    scene.add(octaMesh);

    // 3. Orbital Particles
    const pCount = 120;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);

    for (let i = 0; i < pCount; i++) {
      const angle = (i / pCount) * Math.PI * 2;
      const r = 4.2 + (Math.random() - 0.5) * 0.8;
      pPos[i * 3] = Math.cos(angle) * r;
      pPos[i * 3 + 1] = Math.sin(angle) * r;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
    }

    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      size: 0.2,
      color: themeColor,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    let frameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      torusMesh.rotation.x = elapsed * 0.6;
      torusMesh.rotation.y = elapsed * 0.4;

      octaMesh.rotation.x = -elapsed * 0.8;
      octaMesh.rotation.z = elapsed * 0.5;

      particles.rotation.z = elapsed * 0.3;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      torusGeo.dispose();
      torusMat.dispose();
      octaGeo.dispose();
      octaMat.dispose();
      pGeo.dispose();
      pMat.dispose();
      renderer.dispose();
    };
  }, [color]);

  return <div ref={mountRef} className={`relative select-none pointer-events-none ${className}`} />;
}
