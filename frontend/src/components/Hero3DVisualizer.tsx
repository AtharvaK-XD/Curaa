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

    // 1. Three.js Scene, Camera & Renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x02040b, 0.0035);

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 1000);
    camera.position.set(0, 0, 38);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 2. Dynamic HDR Environment Reflection Map Generator
    const createEnvMap = () => {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      pmremGenerator.compileEquirectangularShader();

      const envScene = new THREE.Scene();
      const light1 = new THREE.PointLight(0x38bdf8, 25, 100); light1.position.set(10, 10, 10); envScene.add(light1);
      const light2 = new THREE.PointLight(0x14b8a6, 25, 100); light2.position.set(-10, -10, 10); envScene.add(light2);
      const light3 = new THREE.PointLight(0xa855f7, 20, 100); light3.position.set(0, 20, -10); envScene.add(light3);

      const renderTarget = pmremGenerator.fromScene(envScene);
      return renderTarget.texture;
    };

    const envTexture = createEnvMap();

    // 3. Liquid Glass Card Canvas Texture (Translucent Refractive Overlay)
    const createLiquidGlassTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 2048;
      canvas.height = 1280;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.clearRect(0, 0, 2048, 1280);

      // Translucent Liquid Frosted Glass Gradient
      const glassGrad = ctx.createLinearGradient(0, 0, 2048, 1280);
      glassGrad.addColorStop(0, 'rgba(14, 30, 60, 0.45)');
      glassGrad.addColorStop(0.5, 'rgba(20, 45, 90, 0.3)');
      glassGrad.addColorStop(1, 'rgba(8, 15, 35, 0.5)');
      ctx.fillStyle = glassGrad;
      ctx.fillRect(0, 0, 2048, 1280);

      // Micro Holographic Grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.lineWidth = 3;
      for (let i = -1280; i < 2048; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + 1280, 1280);
        ctx.stroke();
      }

      // Glowing Glass Top Pill
      ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.beginPath();
      ctx.roundRect(100, 100, 520, 96, 48);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 42px sans-serif';
      ctx.fillText('CURAA OPD LOGIX ENGINE', 160, 162);

      // Glowing Liquid Glass Token ID (REG-104)
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 35;
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 200px sans-serif';
      ctx.fillText('REG-104', 100, 500);
      ctx.shadowBlur = 0;

      // Department & Medical Telemetry Details
      ctx.fillStyle = '#14b8a6';
      ctx.font = 'bold 60px sans-serif';
      ctx.fillText('OPD Room 12 • Cardiology Desk', 100, 630);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '500 48px sans-serif';
      ctx.fillText('Patient: Suresh Kumar • Est. Wait: 8 mins', 100, 730);

      // Iridescent Glass Security Chip
      ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
      ctx.beginPath();
      ctx.roundRect(1620, 120, 320, 230, 32);
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 6;
      ctx.stroke();

      // Chip Contacts
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(1720, 120); ctx.lineTo(1720, 350);
      ctx.moveTo(1820, 120); ctx.lineTo(1820, 350);
      ctx.moveTo(1620, 235); ctx.lineTo(1940, 235);
      ctx.stroke();

      // Live Green Sync LED
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 40;
      ctx.beginPath();
      ctx.arc(1860, 630, 36, 0, Math.PI * 2);
      ctx.fillStyle = '#10b981';
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
      ctx.lineWidth = 14;
      ctx.stroke();

      // Holographic Security Ribbon
      const holoGrad = ctx.createLinearGradient(0, 1020, 2048, 1200);
      holoGrad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
      holoGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.45)');
      holoGrad.addColorStop(1, 'rgba(20, 184, 166, 0.35)');
      ctx.fillStyle = holoGrad;
      ctx.fillRect(0, 1020, 2048, 180);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px monospace';
      ctx.fillText('LIQUID GLASS TOKEN • HL7 FHIR ENCRYPTED • VERIFIED SESSION', 100, 1130);

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    };

    const liquidTexture = createLiquidGlassTexture();

    // 4. Main 3D Composition Group (ScrollTrigger Tracked)
    const mainGroup = new THREE.Group();
    mainGroup.position.set(16, 2, 0);
    scene.add(mainGroup);

    // Thick Glass Smart Card Geometry
    const cardW = 15, cardH = 9.4, cardD = 0.6;
    const cardGeo = new THREE.BoxGeometry(cardW, cardH, cardD, 6, 6, 6);

    // Liquid Refractive Physical Glass Material Setup
    const liquidGlassMat = new THREE.MeshPhysicalMaterial({
      map: liquidTexture || undefined,
      emissiveMap: liquidTexture || undefined,
      emissive: 0x02172e,
      emissiveIntensity: 0.4,
      roughness: 0.05,
      metalness: 0.1,
      transmission: 0.92,
      thickness: 1.5,
      ior: 1.52,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      reflectivity: 1.0,
      transparent: true,
      opacity: 0.88,
      envMap: envTexture,
      envMapIntensity: 2.5,
    });

    const sideGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0ea5e9,
      roughness: 0.04,
      metalness: 0.2,
      transmission: 0.95,
      thickness: 1.2,
      ior: 1.52,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.9,
      envMap: envTexture,
    });

    // BoxGeometry materials order: [0: Right, 1: Left, 2: Top, 3: Bottom, 4: Front, 5: Back]
    // Apply liquidGlassMat to BOTH Front (4) AND Back (5) so REG-104 is visible on both sides!
    const materials = [sideGlassMat, sideGlassMat, sideGlassMat, sideGlassMat, liquidGlassMat, liquidGlassMat];
    const cardMesh = new THREE.Mesh(cardGeo, materials);
    cardMesh.castShadow = true;
    cardMesh.receiveShadow = true;
    mainGroup.add(cardMesh);

    // Glowing Neon Edge Wireframe
    const frameGeo = new THREE.BoxGeometry(cardW + 0.12, cardH + 0.12, cardD + 0.06);
    const frameWire = new THREE.WireframeGeometry(frameGeo);
    const frameMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65 });
    const frameLine = new THREE.LineSegments(frameWire, frameMat);
    cardMesh.add(frameLine);

    // Dual Orbiting Refractive Liquid Rings
    const ring1 = new THREE.Mesh(
      new THREE.TorusGeometry(11, 0.12, 24, 120),
      new THREE.MeshPhysicalMaterial({ color: 0x14b8a6, emissive: 0x14b8a6, emissiveIntensity: 0.9, roughness: 0.05, transmission: 0.9, thickness: 0.8, envMap: envTexture })
    );
    ring1.rotation.x = Math.PI / 3;
    mainGroup.add(ring1);

    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(14.5, 0.09, 24, 120),
      new THREE.MeshPhysicalMaterial({ color: 0xa855f7, emissive: 0xa855f7, emissiveIntensity: 0.7, roughness: 0.05, transmission: 0.9, thickness: 0.8, envMap: envTexture })
    );
    ring2.rotation.y = Math.PI / 4;
    mainGroup.add(ring2);

    // 5. PHOTOREALISTIC BOKEH DEPTH PARTICLE FIELD
    const particleCount = 5000;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const cCyan = new THREE.Color(0x38bdf8);
    const cTeal = new THREE.Color(0x14b8a6);
    const cPurple = new THREE.Color(0xa855f7);

    for (let i = 0; i < particleCount; i++) {
      const radius = 6 + Math.random() * 50;
      const angle = Math.random() * Math.PI * 2;
      const z = (Math.random() - 0.5) * 90 - 10;

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius;
      positions[i * 3 + 2] = z;

      const r = Math.random();
      const col = r < 0.45 ? cCyan : r < 0.8 ? cTeal : cPurple;
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const createBokehTex = () => {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      const ctx = c.getContext('2d');
      if (!ctx) return null;
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255, 255, 255, 1)');
      g.addColorStop(0.25, 'rgba(56, 189, 248, 0.85)');
      g.addColorStop(0.65, 'rgba(20, 184, 166, 0.25)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      const t = new THREE.CanvasTexture(c);
      t.needsUpdate = true;
      return t;
    };

    const particleMat = new THREE.PointsMaterial({
      size: 0.85,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      map: createBokehTex() || undefined,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particleVortex = new THREE.Points(particleGeo, particleMat);
    scene.add(particleVortex);

    // 6. Photorealistic Studio Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const keySpot = new THREE.SpotLight(0xffffff, 1400, 120, Math.PI / 4, 0.5);
    keySpot.position.set(30, 40, 30);
    keySpot.castShadow = true;
    scene.add(keySpot);

    const cyanPoint = new THREE.PointLight(0x38bdf8, 1000, 100);
    cyanPoint.position.set(18, 18, 22);
    scene.add(cyanPoint);

    const tealPoint = new THREE.PointLight(0x14b8a6, 800, 100);
    tealPoint.position.set(-18, -18, 18);
    scene.add(tealPoint);

    // 7. Mouse Parallax
    let mouseX = 0, mouseY = 0;
    let targetX = 0, targetY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // 8. GSAP SCROLLTRIGGER MOVIE CAM & OBJECT PATHING
    const st = ScrollTrigger.create({
      trigger: document.body,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1.2,
      onUpdate: (self) => {
        const p = self.progress;

        // Liquid Glass Card Smooth Multi-Axis Rotation
        gsap.to(mainGroup.rotation, {
          y: p * Math.PI * 4,
          x: p * Math.PI * 1.3,
          z: Math.sin(p * Math.PI * 2) * 0.45,
          duration: 0.5,
          ease: 'power1.out',
        });

        // Position Glide across sections
        gsap.to(mainGroup.position, {
          x: 16 - p * 32,
          y: 2 - Math.sin(p * Math.PI * 2) * 10,
          z: -p * 14,
          scale: 1 + Math.sin(p * Math.PI) * 0.35,
          duration: 0.5,
          ease: 'power1.out',
        });

        // Particle Vortex Acceleration
        gsap.to(particleVortex.rotation, {
          z: p * Math.PI * 3.5,
          duration: 0.5,
          ease: 'power1.out',
        });

        gsap.to(particleVortex.scale, {
          z: 1 + p * 1.8,
          duration: 0.5,
          ease: 'power1.out',
        });

        // Camera Path Zoom
        gsap.to(camera.position, {
          z: 38 - p * 10,
          y: -p * 5,
          duration: 0.5,
          ease: 'power1.out',
        });
      },
    });

    // 9. Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      targetX += (mouseX - targetX) * 0.04;
      targetY += (mouseY - targetY) * 0.04;

      // Floating Idle Motion
      cardMesh.rotation.y = Math.sin(elapsedTime * 1.3) * 0.12;
      cardMesh.rotation.x = Math.cos(elapsedTime * 0.9) * 0.08;

      ring1.rotation.z += 0.009;
      ring2.rotation.x += 0.007;

      // Particle Drift
      particleVortex.rotation.y = elapsedTime * 0.03 + targetX * 0.2;
      particleVortex.rotation.x = elapsedTime * 0.015 + targetY * 0.2;

      camera.position.x += (targetX * 2.5 - camera.position.x) * 0.03;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    animate();

    // 10. Resize Handler
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
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-95 transition-opacity duration-1000 select-none"
      style={{ background: 'radial-gradient(ellipse at 50% 25%, rgba(12, 22, 48, 0.95) 0%, rgba(2, 4, 11, 1) 100%)' }}
    />
  );
}
