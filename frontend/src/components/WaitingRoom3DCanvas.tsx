import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';

interface WaitingRoom3DProps {
  queuePosition: number; // 0-based position
  totalWaiting: number;
  tokenNumber: string;
  servingToken: string;
  isEmergency: boolean;
  onCameraFocusChanged?: (focus: 'lounge' | 'patient' | 'emergency') => void;
}

export const WaitingRoom3DCanvas: React.FC<WaitingRoom3DProps> = ({
  queuePosition,
  totalWaiting,
  servingToken,
  isEmergency
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const emergencyLightRef = useRef<THREE.PointLight | null>(null);
  const activeUserMeshRef = useRef<THREE.Group | null>(null);
  const erDoorMeshRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // 1. Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#05060d');
    scene.fog = new THREE.FogExp2('#05060d', 0.035);
    sceneRef.current = scene;

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 10, 18);
    camera.lookAt(0, 1, -2);
    cameraRef.current = camera;

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight('#1a2035', 1.8);
    scene.add(ambientLight);

    const mainSpot = new THREE.SpotLight('#38bdf8', 4);
    mainSpot.position.set(0, 15, 8);
    mainSpot.angle = Math.PI / 4;
    mainSpot.penumbra = 0.5;
    mainSpot.castShadow = true;
    scene.add(mainSpot);

    const fillTeal = new THREE.PointLight('#2dd4bf', 2.5, 20);
    fillTeal.position.set(-8, 6, -2);
    scene.add(fillTeal);

    // Emergency Red Alarm Light
    const erLight = new THREE.PointLight('#ff2a5f', 0, 25);
    erLight.position.set(10, 6, -8);
    scene.add(erLight);
    emergencyLightRef.current = erLight;

    // 5. Floor & Grid Tiles
    const floorGeo = new THREE.PlaneGeometry(36, 36);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x080a14,
      roughness: 0.2,
      metalness: 0.8
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(36, 36, '#1e293b', '#0f172a');
    grid.position.y = 0.01;
    scene.add(grid);

    // 6. Back Wall & Doors
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0c0f1d, roughness: 0.5 });
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(36, 12), wallMat);
    backWall.position.set(0, 6, -10.1);
    scene.add(backWall);

    // OPD Consultation Room Door (Left Side)
    const opdDoorGroup = new THREE.Group();
    opdDoorGroup.position.set(-7, 2, -10);
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4.2, 0.3), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
    const doorGlass = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.8, 0.1), new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x38bdf8, emissiveIntensity: 0.6 }));
    doorGlass.position.z = 0.1;
    opdDoorGroup.add(doorFrame, doorGlass);
    scene.add(opdDoorGroup);

    // Emergency Room Trauma Bay Door (Right Side)
    const erGroup = new THREE.Group();
    erGroup.position.set(7, 2, -10);
    const erFrame = new THREE.Mesh(new THREE.BoxGeometry(3.6, 4.2, 0.3), new THREE.MeshStandardMaterial({ color: 0x3f0f19 }));
    const erGlass = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.8, 0.1), new THREE.MeshStandardMaterial({ color: 0x991b1b, emissive: 0xef4444, emissiveIntensity: 0.8 }));
    erGlass.position.z = 0.1;
    erGroup.add(erFrame, erGlass);
    scene.add(erGroup);
    erDoorMeshRef.current = erGroup;

    // Overhead 3D LED Display Screen (Center Ceiling)
    const tvGroup = new THREE.Group();
    tvGroup.position.set(0, 6, -8);
    const tvFrame = new THREE.Mesh(new THREE.BoxGeometry(7, 2.5, 0.2), new THREE.MeshStandardMaterial({ color: 0x020617 }));
    const tvScreen = new THREE.Mesh(new THREE.BoxGeometry(6.6, 2.1, 0.05), new THREE.MeshStandardMaterial({ color: 0x082f49, emissive: 0x0284c7, emissiveIntensity: 0.5 }));
    tvScreen.position.z = 0.1;
    tvGroup.add(tvFrame, tvScreen);
    scene.add(tvGroup);

    // Hanging cables for overhead screen
    const cableMat = new THREE.MeshBasicMaterial({ color: 0x334155 });
    const cable1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 4), cableMat);
    cable1.position.set(-2.5, 8, -8);
    const cable2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 4), cableMat);
    cable2.position.set(2.5, 8, -8);
    scene.add(cable1, cable2);

    // 7. Chairs & Patient Avatars (Waiting Lounge Rows)
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 });
    const activeChairMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x38bdf8, emissiveIntensity: 0.7 });
    const waitingPatientMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8 });
    const normalPatientMat = new THREE.MeshStandardMaterial({ color: 0x475569 });

    const totalSeats = Math.max(8, totalWaiting + 2);
    const rows = 2;
    const cols = Math.ceil(totalSeats / rows);

    let activeUserGroup: THREE.Group | null = null;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const index = r * cols + c;
        const x = (c - (cols - 1) / 2) * 2.8;
        const z = r * 3.5;

        const seatGroup = new THREE.Group();
        seatGroup.position.set(x, 0, z);

        const isUserSeat = index === queuePosition;
        const isOccupied = index < totalSeats;

        // Chair mesh
        const base = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 0.8, 1.2),
          isUserSeat ? activeChairMat : chairMat
        );
        base.position.y = 0.4;
        base.castShadow = true;
        seatGroup.add(base);

        const backrest = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 1.2, 0.2),
          isUserSeat ? activeChairMat : chairMat
        );
        backrest.position.set(0, 1.2, -0.5);
        seatGroup.add(backrest);

        // 3D Avatar (if occupied)
        if (isOccupied) {
          const avatarGroup = new THREE.Group();
          avatarGroup.position.set(0, 0.8, 0);

          // Body sphere/capsule
          const body = new THREE.Mesh(
            new THREE.SphereGeometry(0.45, 16, 16),
            isUserSeat ? activeChairMat : isOccupied ? waitingPatientMat : normalPatientMat
          );
          body.position.y = 0.4;
          avatarGroup.add(body);

          // Head sphere
          const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.3, 16, 16),
            isUserSeat ? activeChairMat : isOccupied ? waitingPatientMat : normalPatientMat
          );
          head.position.y = 1.1;
          avatarGroup.add(head);

          // Glowing aura under user's chair
          if (isUserSeat) {
            const aura = new THREE.Mesh(
              new THREE.RingGeometry(0.2, 1.2, 32),
              new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
            );
            aura.rotation.x = -Math.PI / 2;
            aura.position.y = -0.38;
            seatGroup.add(aura);

            // Pulsing GSAP animation for user's aura
            gsap.to(aura.scale, {
              x: 1.3,
              y: 1.3,
              duration: 1.2,
              repeat: -1,
              yoyo: true,
              ease: 'power1.inOut'
            });

            activeUserGroup = seatGroup;
          }

          seatGroup.add(avatarGroup);
        }

        scene.add(seatGroup);
      }
    }
    activeUserMeshRef.current = activeUserGroup;

    // 8. Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Gentle floating animation for overhead TV screen
      tvGroup.position.y = 6 + Math.sin(elapsedTime * 1.5) * 0.1;

      // Emergency strobe light effect if active
      if (emergencyLightRef.current && emergencyLightRef.current.intensity > 0) {
        emergencyLightRef.current.intensity = 5 + Math.sin(elapsedTime * 10) * 4;
      }

      renderer.render(scene, camera);
    };
    animate();

    // 9. Handle Resize
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
      cancelAnimationFrame(animationFrameId);
      if (mountRef.current && rendererRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
    };
  }, []);

  // 10. GSAP Camera transitions when Emergency state or position changes
  useEffect(() => {
    if (!cameraRef.current || !emergencyLightRef.current) return;

    if (isEmergency) {
      // Emergency Mode: GSAP Camera Transition to Emergency Room Bay
      gsap.to(emergencyLightRef.current, { intensity: 6, duration: 0.5 });
      gsap.to(cameraRef.current.position, {
        x: 6,
        y: 4,
        z: -3,
        duration: 1.8,
        ease: 'power3.inOut'
      });
      gsap.to(cameraRef.current.rotation, {
        x: -0.1,
        y: 0.4,
        z: 0,
        duration: 1.8,
        ease: 'power3.inOut'
      });
    } else {
      // Normal Mode: Camera transition to Lounge / User seat overview
      gsap.to(emergencyLightRef.current, { intensity: 0, duration: 0.5 });

      if (activeUserMeshRef.current) {
        const userPos = activeUserMeshRef.current.position;
        gsap.to(cameraRef.current.position, {
          x: userPos.x * 0.4,
          y: 8,
          z: userPos.z + 10,
          duration: 2,
          ease: 'power2.out'
        });
      } else {
        gsap.to(cameraRef.current.position, {
          x: 0,
          y: 10,
          z: 18,
          duration: 2,
          ease: 'power2.out'
        });
      }
    }
  }, [isEmergency, queuePosition]);

  return (
    <div className="relative w-full h-full min-h-[380px] rounded-3xl overflow-hidden shadow-2xl border border-white/[0.06] bg-[#05060d]">
      <div ref={mountRef} className="w-full h-full" />
      
      {/* 3D Canvas HUD Overlays */}
      <div className="absolute top-4 left-4 flex items-center gap-2 bg-[#050508]/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/[0.08]">
        <span className="w-2.5 h-2.5 rounded-full bg-clinical-blue animate-ping"></span>
        <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">3D Virtual OPD Lounge</span>
      </div>

      <div className="absolute top-4 right-4 bg-[#050508]/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/[0.08] text-right">
        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">3D Display Token</span>
        <span className="text-sm font-extrabold text-clinical-teal font-display">{servingToken}</span>
      </div>
    </div>
  );
};

export default WaitingRoom3DCanvas;
