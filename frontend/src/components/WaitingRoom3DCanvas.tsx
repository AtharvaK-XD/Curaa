import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';

interface PatientSeatData {
  index: number;
  tokenNumber: string;
  isUser: boolean;
  isServing: boolean;
  position: THREE.Vector3;
  statusLabel: string;
}

interface WaitingRoom3DProps {
  queuePosition: number; // 0-based position ahead
  totalWaiting: number;
  userTokenNumber: string;
  servingTokenNumber: string;
  isEmergency: boolean;
  cameraView: 'orbit' | 'user' | 'doctor' | 'emergency';
}

export const WaitingRoom3DCanvas: React.FC<WaitingRoom3DProps> = ({
  queuePosition,
  totalWaiting,
  userTokenNumber,
  servingTokenNumber,
  isEmergency,
  cameraView
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const emergencyLightRef = useRef<THREE.PointLight | null>(null);

  // Screen coordinates for floating 3D labels
  const [badges, setBadges] = useState<Array<{ id: string; label: string; x: number; y: number; isUser: boolean; isServing: boolean; visible: boolean }>>([]);

  const seatPositionsRef = useRef<PatientSeatData[]>([]);

  useEffect(() => {
    if (!mountRef.current) return;
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // 1. Scene & Atmosphere
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#03050b');
    scene.fog = new THREE.FogExp2('#03050b', 0.025);
    sceneRef.current = scene;

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 12, 22);
    camera.lookAt(0, 2, -2);
    cameraRef.current = camera;

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. OrbitControls for Free Drag, Pan, Rotate & Zoom
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't go under floor
    controls.minDistance = 3;
    controls.maxDistance = 40;
    controls.target.set(0, 2, -2);
    controlsRef.current = controls;

    // 5. Lighting Setup (Realistic Hospital Ambient & Spotlights)
    const ambientLight = new THREE.AmbientLight('#1e293b', 2.2);
    scene.add(ambientLight);

    // Main Overhead Ceiling Panel Lights
    const mainLight1 = new THREE.DirectionalLight('#e2e8f0', 2.0);
    mainLight1.position.set(5, 18, 10);
    mainLight1.castShadow = true;
    mainLight1.shadow.mapSize.width = 2048;
    mainLight1.shadow.mapSize.height = 2048;
    scene.add(mainLight1);

    // Cyan Glow over Consultation Desk
    const doctorDeskSpot = new THREE.SpotLight('#38bdf8', 5, 20, Math.PI / 3, 0.5);
    doctorDeskSpot.position.set(-10, 12, -8);
    doctorDeskSpot.target.position.set(-10, 0, -8);
    scene.add(doctorDeskSpot);
    scene.add(doctorDeskSpot.target);

    // Red Emergency Light
    const erLight = new THREE.PointLight('#ff2a5f', 0, 30);
    erLight.position.set(10, 8, -8);
    scene.add(erLight);
    emergencyLightRef.current = erLight;

    // 6. Architectural Environment: Floor, Walls, Windows
    // Polished Hospital Tile Floor
    const floorGeo = new THREE.PlaneGeometry(40, 40);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.15,
      metalness: 0.85
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Floor Tile Grid Accents
    const grid = new THREE.GridHelper(40, 40, '#334155', '#1e293b');
    grid.position.y = 0.01;
    scene.add(grid);

    // Back Wall
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0b0f19, roughness: 0.6 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(40, 14, 0.5), wallMat);
    backWall.position.set(0, 7, -15);
    backWall.receiveShadow = true;
    scene.add(backWall);

    // Side Walls
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 14, 40), wallMat);
    leftWall.position.set(-20, 7, 0);
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 14, 40), wallMat);
    rightWall.position.set(20, 7, 0);
    scene.add(rightWall);

    // 7. Doctor Consultation Room Desk & Glass Door (Left Wall)
    const doctorGroup = new THREE.Group();
    doctorGroup.position.set(-10, 0, -12);

    // Reception Counter Desk
    const desk = new THREE.Mesh(new THREE.BoxGeometry(5, 2.2, 2), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 }));
    desk.position.set(0, 1.1, 0);
    desk.castShadow = true;
    desk.receiveShadow = true;
    doctorGroup.add(desk);

    // Computer Monitor on desk
    const monitor = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.1), new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x38bdf8, emissiveIntensity: 0.8 }));
    monitor.position.set(0, 2.6, 0);
    doctorGroup.add(monitor);

    // Glass Door Frame & Glowing Sign
    const opdDoorFrame = new THREE.Mesh(new THREE.BoxGeometry(4, 6.5, 0.4), new THREE.MeshStandardMaterial({ color: 0x334155 }));
    opdDoorFrame.position.set(0, 3.25, -2.5);
    const opdGlass = new THREE.Mesh(new THREE.BoxGeometry(3.6, 6.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x0284c7, emissiveIntensity: 0.5, transparent: true, opacity: 0.7 }));
    opdGlass.position.set(0, 3.25, -2.4);
    doctorGroup.add(opdDoorFrame, opdGlass);

    // OPD Room Sign Board
    const opdSign = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.8, 0.2), new THREE.MeshStandardMaterial({ color: 0x0369a1, emissive: 0x38bdf8, emissiveIntensity: 0.9 }));
    opdSign.position.set(0, 6.8, -2.3);
    doctorGroup.add(opdSign);

    scene.add(doctorGroup);

    // 8. Emergency Room Trauma Bay Door (Right Wall)
    const erGroup = new THREE.Group();
    erGroup.position.set(10, 0, -12);

    const erDoorFrame = new THREE.Mesh(new THREE.BoxGeometry(4.5, 6.5, 0.4), new THREE.MeshStandardMaterial({ color: 0x450a0a }));
    erDoorFrame.position.set(0, 3.25, -2.5);
    const erGlass = new THREE.Mesh(new THREE.BoxGeometry(4.1, 6.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x991b1b, emissive: 0xef4444, emissiveIntensity: 0.9, transparent: true, opacity: 0.8 }));
    erGlass.position.set(0, 3.25, -2.4);
    erGroup.add(erDoorFrame, erGlass);

    const erSign = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.9, 0.2), new THREE.MeshStandardMaterial({ color: 0x7f1d1d, emissive: 0xf43f5e, emissiveIntensity: 1 }));
    erSign.position.set(0, 6.9, -2.3);
    erGroup.add(erSign);

    scene.add(erGroup);

    // 9. Central Digital Queue TV Billboard Display (Hanging from Ceiling)
    const tvGroup = new THREE.Group();
    tvGroup.position.set(0, 8.5, -10);
    const tvBody = new THREE.Mesh(new THREE.BoxGeometry(9, 3.8, 0.3), new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.2 }));
    const tvScreen = new THREE.Mesh(new THREE.BoxGeometry(8.6, 3.4, 0.05), new THREE.MeshStandardMaterial({ color: 0x0369a1, emissive: 0x0284c7, emissiveIntensity: 0.7 }));
    tvScreen.position.z = 0.16;
    tvGroup.add(tvBody, tvScreen);

    // Support Pillars
    const pillar1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5), new THREE.MeshStandardMaterial({ color: 0x475569 }));
    pillar1.position.set(-3.5, 3, 0);
    const pillar2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5), new THREE.MeshStandardMaterial({ color: 0x475569 }));
    pillar2.position.set(3.5, 3, 0);
    tvGroup.add(pillar1, pillar2);

    scene.add(tvGroup);

    // 10. Generate Chairs & Detailed Humanoid Patient Models
    const seatList: PatientSeatData[] = [];
    const rows = 3;
    const cols = 5;
    const seatSpacingX = 3.2;
    const seatSpacingZ = 3.6;

    const userIndex = queuePosition; // User's position in line

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const x = (c - (cols - 1) / 2) * seatSpacingX;
        const z = (r - 0.5) * seatSpacingZ + 2;

        const isUserSeat = idx === userIndex;
        const isServingSeat = idx === 0 && servingTokenNumber !== 'None';
        const isOccupied = idx <= totalWaiting;

        // Chair Assembly
        const chairGroup = new THREE.Group();
        chairGroup.position.set(x, 0, z);

        const chairMat = isUserSeat
          ? new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x38bdf8, emissiveIntensity: 0.8 })
          : isServingSeat
          ? new THREE.MeshStandardMaterial({ color: 0x0d9488, emissive: 0x2dd4bf, emissiveIntensity: 0.8 })
          : new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 });

        // Cushion
        const cushion = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 1.5), chairMat);
        cushion.position.y = 0.9;
        cushion.castShadow = true;
        chairGroup.add(cushion);

        // Backrest
        const backrest = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 0.25), chairMat);
        backrest.position.set(0, 1.6, -0.65);
        backrest.castShadow = true;
        chairGroup.add(backrest);

        // Metal Legs
        const legMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.9, roughness: 0.1 });
        const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9), legMat);
        leg1.position.set(-0.7, 0.45, 0.6);
        const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9), legMat);
        leg2.position.set(0.7, 0.45, 0.6);
        const leg3 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9), legMat);
        leg3.position.set(-0.7, 0.45, -0.6);
        const leg4 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9), legMat);
        leg4.position.set(0.7, 0.45, -0.6);
        chairGroup.add(leg1, leg2, leg3, leg4);

        // 3D Humanoid Patient Avatar (if occupied)
        if (isOccupied) {
          const avatarGroup = new THREE.Group();
          avatarGroup.position.set(0, 0.9, 0);

          const skinMat = isUserSeat
            ? new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.6 })
            : isServingSeat
            ? new THREE.MeshStandardMaterial({ color: 0x2dd4bf, emissive: 0x0d9488, emissiveIntensity: 0.5 })
            : new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5 });

          // Torso / Jacket
          const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 1.3, 16), skinMat);
          torso.position.y = 0.8;
          torso.castShadow = true;
          avatarGroup.add(torso);

          // Head
          const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 20, 20), skinMat);
          head.position.y = 1.75;
          head.castShadow = true;
          avatarGroup.add(head);

          // Shoulders / Arms
          const armLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9), skinMat);
          armLeft.position.set(-0.55, 0.8, 0.2);
          armLeft.rotation.z = 0.2;
          const armRight = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9), skinMat);
          armRight.position.set(0.55, 0.8, 0.2);
          armRight.rotation.z = -0.2;
          avatarGroup.add(armLeft, armRight);

          chairGroup.add(avatarGroup);
        }

        // Highlight Aura Pedestal under user's seat
        if (isUserSeat) {
          const ringGeo = new THREE.RingGeometry(0.2, 1.8, 32);
          const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = 0.02;
          chairGroup.add(ring);

          // GSAP Pulsing animation
          gsap.to(ring.scale, {
            x: 1.25,
            y: 1.25,
            duration: 1.2,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut'
          });
        }

        scene.add(chairGroup);

        // Store 3D position for floating badges
        const worldPos = new THREE.Vector3(x, 3.2, z);
        let statusLabel = '';
        if (isUserSeat) {
          statusLabel = `YOU (${userTokenNumber})`;
        } else if (isServingSeat) {
          statusLabel = `Serving: ${servingTokenNumber}`;
        } else if (idx < userIndex) {
          statusLabel = `${userIndex - idx} Ahead (${userTokenNumber.split('-')[0]}-${100 + idx})`;
        } else {
          statusLabel = `Waiting (${userTokenNumber.split('-')[0]}-${100 + idx})`;
        }

        seatList.push({
          index: idx,
          tokenNumber: userTokenNumber.split('-')[0] + '-' + (100 + idx),
          isUser: isUserSeat,
          isServing: isServingSeat,
          position: worldPos,
          statusLabel
        });
      }
    }
    seatPositionsRef.current = seatList;

    // Add Doctor Desk & Emergency Door positions to 3D Labels
    seatList.push({
      index: 998,
      tokenNumber: 'DOCTOR',
      isUser: false,
      isServing: false,
      position: new THREE.Vector3(-10, 7.6, -14.2),
      statusLabel: '🚪 OPD Doctor Room 12'
    });

    seatList.push({
      index: 999,
      tokenNumber: 'ER',
      isUser: false,
      isServing: false,
      position: new THREE.Vector3(10, 7.6, -14.2),
      statusLabel: '🚨 Emergency Trauma Bay'
    });

    // 11. Render Loop & Project 3D Positions to 2D Screen Badges
    let animationId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Update Controls
      controls.update();

      // Gentle floating animation for ceiling TV
      tvGroup.position.y = 8.5 + Math.sin(elapsedTime * 1.5) * 0.12;

      // Strobe Emergency Light if emergency mode is active
      if (emergencyLightRef.current && emergencyLightRef.current.intensity > 0) {
        emergencyLightRef.current.intensity = 6 + Math.sin(elapsedTime * 12) * 5;
      }

      // Calculate 3D to 2D screen positions for floating HTML badges
      if (cameraRef.current && mountRef.current) {
        const w = mountRef.current.clientWidth;
        const h = mountRef.current.clientHeight;
        const updatedBadges = seatPositionsRef.current.map((seat, i) => {
          const vec = seat.position.clone();
          vec.project(cameraRef.current!);
          const x = (vec.x * 0.5 + 0.5) * w;
          const y = (-vec.y * 0.5 + 0.5) * h;
          const isVisible = vec.z < 1;

          return {
            id: `seat-${i}-${seat.tokenNumber}`,
            label: seat.statusLabel,
            x,
            y,
            isUser: seat.isUser,
            isServing: seat.isServing,
            visible: isVisible
          };
        });
        setBadges(updatedBadges);
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      controls.dispose();
      if (mountRef.current && rendererRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
    };
  }, [queuePosition, totalWaiting, userTokenNumber, servingTokenNumber]);

  // 12. Handle Camera Preset Views via GSAP
  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current || !emergencyLightRef.current) return;

    const camera = cameraRef.current;
    const controls = controlsRef.current;

    if (isEmergency || cameraView === 'emergency') {
      // Emergency Camera Zoom to ER Trauma Door
      gsap.to(emergencyLightRef.current, { intensity: 7, duration: 0.5 });
      gsap.to(camera.position, { x: 10, y: 5, z: -4, duration: 1.6, ease: 'power3.inOut' });
      gsap.to(controls.target, { x: 10, y: 3.5, z: -14, duration: 1.6, ease: 'power3.inOut' });
    } else if (cameraView === 'user') {
      // Focus Camera on User's Seat
      const userSeat = seatPositionsRef.current.find(s => s.isUser);
      if (userSeat) {
        gsap.to(camera.position, {
          x: userSeat.position.x,
          y: userSeat.position.y + 5,
          z: userSeat.position.z + 7,
          duration: 1.6,
          ease: 'power2.out'
        });
        gsap.to(controls.target, {
          x: userSeat.position.x,
          y: userSeat.position.y - 1,
          z: userSeat.position.z,
          duration: 1.6,
          ease: 'power2.out'
        });
      }
    } else if (cameraView === 'doctor') {
      // Focus Camera on Doctor Consultation Door
      gsap.to(camera.position, { x: -10, y: 5, z: -4, duration: 1.6, ease: 'power3.inOut' });
      gsap.to(controls.target, { x: -10, y: 3.5, z: -14, duration: 1.6, ease: 'power3.inOut' });
    } else {
      // Default Overview Orbit Camera
      gsap.to(emergencyLightRef.current, { intensity: 0, duration: 0.5 });
      gsap.to(camera.position, { x: 0, y: 12, z: 22, duration: 1.8, ease: 'power2.out' });
      gsap.to(controls.target, { x: 0, y: 2, z: -2, duration: 1.8, ease: 'power2.out' });
    }
  }, [cameraView, isEmergency]);

  return (
    <div className="relative w-full h-full min-h-[500px] rounded-3xl overflow-hidden shadow-2xl border border-white/[0.08] bg-[#03050b] select-none">
      
      {/* 3D Canvas Mount */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating 3D Projection Labels for Each Patient & Door in the 3D Room */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {badges.map((badge) => {
          if (!badge.visible) return null;
          return (
            <div
              key={badge.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-75"
              style={{ left: `${badge.x}px`, top: `${badge.y}px` }}
            >
              <div className={`px-2.5 py-1 rounded-xl text-[10px] font-bold shadow-lg backdrop-blur-md whitespace-nowrap border ${
                badge.isUser
                  ? 'bg-clinical-blue text-zinc-950 border-white shadow-[0_0_15px_rgba(56,189,248,0.6)] animate-bounce font-display text-xs'
                  : badge.isServing
                  ? 'bg-clinical-teal text-zinc-950 border-teal-300 shadow-[0_0_12px_rgba(45,212,191,0.5)] font-display'
                  : badge.label.includes('Emergency')
                  ? 'bg-rose-500/90 text-white border-rose-300 font-display tracking-wider'
                  : badge.label.includes('Doctor')
                  ? 'bg-sky-500/90 text-white border-sky-300 font-display tracking-wider'
                  : 'bg-[#090912]/85 text-zinc-300 border-white/[0.08]'
              }`}>
                {badge.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Drag & Orbit Helper Overlay */}
      <div className="absolute top-4 left-4 flex items-center gap-2 bg-[#050508]/85 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/[0.08] text-xs font-bold text-zinc-300 shadow-lg">
        <span className="w-2.5 h-2.5 rounded-full bg-clinical-teal animate-pulse"></span>
        <span>🖱️ Drag to Rotate &bull; Scroll to Zoom &bull; Right-click to Pan</span>
      </div>
    </div>
  );
};

export default WaitingRoom3DCanvas;
