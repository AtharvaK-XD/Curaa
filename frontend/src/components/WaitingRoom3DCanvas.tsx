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
  queuePosition: number;
  totalWaiting: number;
  userTokenNumber: string;
  servingTokenNumber: string;
  isEmergency: boolean;
  cameraView: 'orbit' | 'user' | 'doctor' | 'emergency';
}

// ── Helper: Create a procedural checkerboard texture for the floor ──
function createFloorTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const tileCount = 16;
  const tileSize = size / tileCount;
  for (let r = 0; r < tileCount; r++) {
    for (let c = 0; c < tileCount; c++) {
      const isDark = (r + c) % 2 === 0;
      ctx.fillStyle = isDark ? '#0c1220' : '#111827';
      ctx.fillRect(c * tileSize, r * tileSize, tileSize, tileSize);
      // Grout lines
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(c * tileSize, r * tileSize, tileSize, tileSize);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

// ── Helper: Create a procedural wall texture (subtle plaster/paint) ──
function createWallTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0f1729';
  ctx.fillRect(0, 0, size, size);
  // Fine noise grain
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const brightness = Math.random() * 20 + 10;
    ctx.fillStyle = `rgba(${brightness},${brightness + 5},${brightness + 15},0.25)`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  return tex;
}

// ── Helper: Create a ceiling panel texture ──
function createCeilingTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const panelCount = 8;
  const panelSize = size / panelCount;
  for (let r = 0; r < panelCount; r++) {
    for (let c = 0; c < panelCount; c++) {
      ctx.fillStyle = '#0a0e1a';
      ctx.fillRect(c * panelSize, r * panelSize, panelSize, panelSize);
      ctx.strokeStyle = '#1a2236';
      ctx.lineWidth = 2;
      ctx.strokeRect(c * panelSize + 1, r * panelSize + 1, panelSize - 2, panelSize - 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

// ── Helper: Build a detailed humanoid figure ──
function createHumanoid(
  skinColor: number,
  shirtColor: number,
  pantsColor: number,
  isHighlight: boolean,
  emissiveColor?: number,
  emissiveIntensity?: number
): THREE.Group {
  const group = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({
    color: skinColor,
    roughness: 0.65,
    metalness: 0.05,
    ...(isHighlight && emissiveColor ? { emissive: emissiveColor, emissiveIntensity: emissiveIntensity || 0.4 } : {}),
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: shirtColor,
    roughness: 0.7,
    ...(isHighlight && emissiveColor ? { emissive: emissiveColor, emissiveIntensity: (emissiveIntensity || 0.4) * 0.6 } : {}),
  });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.8 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.5 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });

  // Hips / Pelvis (seated, so legs bent)
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.22, 0.55), pantsMat);
  hips.position.y = 0.12;
  hips.castShadow = true;
  group.add(hips);

  // Upper Legs (thighs, horizontal on seat)
  const thighL = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.55, 10), pantsMat);
  thighL.position.set(-0.16, 0.1, 0.28);
  thighL.rotation.x = Math.PI / 2;
  thighL.castShadow = true;
  group.add(thighL);

  const thighR = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.55, 10), pantsMat);
  thighR.position.set(0.16, 0.1, 0.28);
  thighR.rotation.x = Math.PI / 2;
  thighR.castShadow = true;
  group.add(thighR);

  // Lower Legs (shins, hanging down from knee)
  const shinL = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.09, 0.52, 10), pantsMat);
  shinL.position.set(-0.16, -0.15, 0.52);
  shinL.castShadow = true;
  group.add(shinL);

  const shinR = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.09, 0.52, 10), pantsMat);
  shinR.position.set(0.16, -0.15, 0.52);
  shinR.castShadow = true;
  group.add(shinR);

  // Shoes
  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.25), shoeMat);
  shoeL.position.set(-0.16, -0.42, 0.56);
  group.add(shoeL);

  const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.25), shoeMat);
  shoeR.position.set(0.16, -0.42, 0.56);
  group.add(shoeR);

  // Torso / Shirt
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.7, 12), shirtMat);
  torso.position.y = 0.58;
  torso.castShadow = true;
  group.add(torso);

  // Chest / Shoulders widener
  const shoulders = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.18, 0.30), shirtMat);
  shoulders.position.y = 0.88;
  shoulders.castShadow = true;
  group.add(shoulders);

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 0.14, 10), skinMat);
  neck.position.y = 1.02;
  group.add(neck);

  // Head (slightly elongated sphere)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.20, 20, 16), skinMat);
  head.scale.set(1, 1.15, 1);
  head.position.y = 1.28;
  head.castShadow = true;
  group.add(head);

  // Hair (cap on top of head)
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.21, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    hairMat
  );
  hair.position.y = 1.30;
  group.add(hair);

  // Ears
  const earGeo = new THREE.SphereGeometry(0.05, 8, 8);
  const earL = new THREE.Mesh(earGeo, skinMat);
  earL.position.set(-0.20, 1.26, 0);
  group.add(earL);
  const earR = new THREE.Mesh(earGeo, skinMat);
  earR.position.set(0.20, 1.26, 0);
  group.add(earR);

  // Upper Arms
  const upperArmL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.38, 8), shirtMat);
  upperArmL.position.set(-0.36, 0.72, 0.05);
  upperArmL.rotation.z = 0.25;
  upperArmL.castShadow = true;
  group.add(upperArmL);

  const upperArmR = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.38, 8), shirtMat);
  upperArmR.position.set(0.36, 0.72, 0.05);
  upperArmR.rotation.z = -0.25;
  upperArmR.castShadow = true;
  group.add(upperArmR);

  // Forearms (resting on thighs)
  const forearmL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.34, 8), skinMat);
  forearmL.position.set(-0.32, 0.42, 0.22);
  forearmL.rotation.x = Math.PI / 3;
  forearmL.rotation.z = 0.1;
  group.add(forearmL);

  const forearmR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.34, 8), skinMat);
  forearmR.position.set(0.32, 0.42, 0.22);
  forearmR.rotation.x = Math.PI / 3;
  forearmR.rotation.z = -0.1;
  group.add(forearmR);

  // Hands
  const handGeo = new THREE.SphereGeometry(0.06, 8, 8);
  const handL = new THREE.Mesh(handGeo, skinMat);
  handL.position.set(-0.28, 0.26, 0.38);
  group.add(handL);
  const handR = new THREE.Mesh(handGeo, skinMat);
  handR.position.set(0.28, 0.26, 0.38);
  group.add(handR);

  return group;
}

// ── Helper: Create a potted plant ──
function createPottedPlant(height: number): THREE.Group {
  const plant = new THREE.Group();
  const potMat = new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.8 });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.5, 12), potMat);
  pot.position.y = 0.25;
  pot.castShadow = true;
  plant.add(pot);

  // Soil
  const soil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.06, 12),
    new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 1 })
  );
  soil.position.y = 0.52;
  plant.add(soil);

  // Trunk
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.06, height * 0.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 })
  );
  trunk.position.y = 0.55 + (height * 0.4) / 2;
  plant.add(trunk);

  // Leaf clusters
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.7 });
  const leafCount = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < leafCount; i++) {
    const leafSize = 0.15 + Math.random() * 0.2;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(leafSize, 8, 6), leafMat);
    const angle = (i / leafCount) * Math.PI * 2;
    const radius = 0.15 + Math.random() * 0.15;
    leaf.position.set(
      Math.cos(angle) * radius,
      0.55 + height * 0.4 + Math.random() * 0.3,
      Math.sin(angle) * radius
    );
    leaf.scale.y = 0.7;
    plant.add(leaf);
  }

  return plant;
}

// ── Helper: Create a magazine / coffee table ──
function createSideTable(): THREE.Group {
  const table = new THREE.Group();
  const legMat = new THREE.MeshStandardMaterial({ color: 0x78716c, metalness: 0.8, roughness: 0.2 });

  // Tabletop
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.6, 0.06, 20),
    new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.3, metalness: 0.1 })
  );
  top.position.y = 0.65;
  top.castShadow = true;
  top.receiveShadow = true;
  table.add(top);

  // Single central leg
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.63, 8), legMat);
  leg.position.y = 0.32;
  table.add(leg);

  // Base disc
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.03, 16), legMat);
  base.position.y = 0.015;
  table.add(base);

  // Magazines on top
  const magColors = [0x1e40af, 0xb91c1c, 0x15803d];
  for (let i = 0; i < 3; i++) {
    const mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.015, 0.36),
      new THREE.MeshStandardMaterial({ color: magColors[i], roughness: 0.6 })
    );
    mag.position.set((i - 1) * 0.12, 0.69 + i * 0.016, (i - 1) * 0.05);
    mag.rotation.y = (i - 1) * 0.3;
    table.add(mag);
  }

  return table;
}

// ── Helper: Create a water cooler / dispenser ──
function createWaterCooler(): THREE.Group {
  const cooler = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.1 });

  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.3, 0.45), bodyMat);
  body.position.y = 0.65;
  body.castShadow = true;
  cooler.add(body);

  // Water bottle on top (inverted)
  const bottle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.18, 0.6, 12),
    new THREE.MeshStandardMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.5, roughness: 0.1 })
  );
  bottle.position.y = 1.6;
  cooler.add(bottle);

  // Bottle cap
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.15, 0.04, 12),
    new THREE.MeshStandardMaterial({ color: 0x1e293b })
  );
  cap.position.y = 1.31;
  cooler.add(cap);

  // Spigot area
  const spigot = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.06, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.5 })
  );
  spigot.position.set(0, 0.85, 0.28);
  cooler.add(spigot);

  // Drip tray
  const tray = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.03, 0.15),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6 })
  );
  tray.position.set(0, 0.55, 0.28);
  cooler.add(tray);

  return cooler;
}

// ── Helper: Create a wall clock ──
function createWallClock(): THREE.Group {
  const clock = new THREE.Group();

  // Body
  const face = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 0.08, 32),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
  );
  face.rotation.x = Math.PI / 2;
  clock.add(face);

  // Rim
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.035, 8, 32),
    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.2 })
  );
  clock.add(rim);

  // Hour marks
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const mark = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.08, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x0f172a })
    );
    mark.position.set(Math.sin(angle) * 0.4, Math.cos(angle) * 0.4, 0.05);
    clock.add(mark);
  }

  // Hour hand
  const hourHand = new THREE.Mesh(
    new THREE.BoxGeometry(0.025, 0.22, 0.015),
    new THREE.MeshStandardMaterial({ color: 0x0f172a })
  );
  hourHand.position.set(0, 0.08, 0.06);
  hourHand.rotation.z = -0.8;
  clock.add(hourHand);

  // Minute hand
  const minHand = new THREE.Mesh(
    new THREE.BoxGeometry(0.018, 0.32, 0.012),
    new THREE.MeshStandardMaterial({ color: 0x334155 })
  );
  minHand.position.set(0, 0.12, 0.065);
  minHand.rotation.z = 0.6;
  clock.add(minHand);

  // Center pin
  const pin = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.5 })
  );
  pin.position.z = 0.06;
  clock.add(pin);

  return clock;
}

// ── Helper: Create volumetric dust particles ──
function createDustParticles(count: number): THREE.Points {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 35;
    positions[i * 3 + 1] = Math.random() * 12 + 0.5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 28;
    sizes[i] = Math.random() * 0.04 + 0.01;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.PointsMaterial({
    color: 0x94a3b8,
    size: 0.04,
    transparent: true,
    opacity: 0.35,
    sizeAttenuation: true,
    depthWrite: false,
  });
  return new THREE.Points(geo, mat);
}

// ── Helper: Create a realistic chair with armrests ──
function createChair(
  isUserSeat: boolean,
  isServingSeat: boolean
): THREE.Group {
  const chairGroup = new THREE.Group();

  const cushionColor = isUserSeat ? 0x0284c7 : isServingSeat ? 0x0d9488 : 0x1e293b;
  const cushionEmissive = isUserSeat ? 0x38bdf8 : isServingSeat ? 0x2dd4bf : 0x000000;
  const cushionEmissiveI = isUserSeat ? 0.5 : isServingSeat ? 0.4 : 0;

  const cushionMat = new THREE.MeshStandardMaterial({
    color: cushionColor,
    roughness: 0.55,
    metalness: 0.05,
    emissive: cushionEmissive,
    emissiveIntensity: cushionEmissiveI,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    metalness: 0.92,
    roughness: 0.08,
  });

  // Seat cushion (slightly rounded)
  const cushion = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 1.1), cushionMat);
  cushion.position.y = 0.85;
  cushion.castShadow = true;
  cushion.receiveShadow = true;
  chairGroup.add(cushion);

  // Back cushion
  const backCushion = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 0.18), cushionMat);
  backCushion.position.set(0, 1.44, -0.48);
  backCushion.castShadow = true;
  chairGroup.add(backCushion);

  // Metal frame — back uprights
  const backL = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.35, 8), frameMat);
  backL.position.set(-0.52, 1.1, -0.52);
  chairGroup.add(backL);
  const backR = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.35, 8), frameMat);
  backR.position.set(0.52, 1.1, -0.52);
  chairGroup.add(backR);

  // Metal frame — 4 legs
  const positions = [[-0.52, 0.38, 0.45], [0.52, 0.38, 0.45], [-0.52, 0.38, -0.45], [0.52, 0.38, -0.45]];
  for (const p of positions) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.74, 8), frameMat);
    leg.position.set(p[0], p[1], p[2]);
    leg.castShadow = true;
    chairGroup.add(leg);
    // Rubber foot
    const foot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.03, 8),
      new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 1 })
    );
    foot.position.set(p[0], 0.015, p[2]);
    chairGroup.add(foot);
  }

  // Armrests
  const armrestMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.3 });
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.7), armrestMat);
  armL.position.set(-0.6, 1.12, 0);
  chairGroup.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.7), armrestMat);
  armR.position.set(0.6, 1.12, 0);
  chairGroup.add(armR);

  // Armrest supports
  const armSuppL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.38, 8), frameMat);
  armSuppL.position.set(-0.6, 0.93, 0.2);
  chairGroup.add(armSuppL);
  const armSuppR = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.38, 8), frameMat);
  armSuppR.position.set(0.6, 0.93, 0.2);
  chairGroup.add(armSuppR);

  // Seat frame crossbar
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.03, 0.04), frameMat);
  crossbar.position.set(0, 0.74, 0);
  chairGroup.add(crossbar);

  return chairGroup;
}

// ── Helper: Window with blinds ──
function createWindow(): THREE.Group {
  const win = new THREE.Group();

  // Frame
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.3 });
  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 0.15), frameMat);
  frameTop.position.y = 2;
  win.add(frameTop);
  const frameBot = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 0.15), frameMat);
  frameBot.position.y = -2;
  win.add(frameBot);
  const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.12, 0.15), frameMat);
  frameL.position.x = -1.7;
  win.add(frameL);
  const frameR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.12, 0.15), frameMat);
  frameR.position.x = 1.7;
  win.add(frameR);

  // Center divider
  const divider = new THREE.Mesh(new THREE.BoxGeometry(0.06, 4, 0.12), frameMat);
  win.add(divider);

  // Glass pane (slight blue tint, see-through)
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(3.3, 3.9),
    new THREE.MeshStandardMaterial({
      color: 0x1e3a5f,
      transparent: true,
      opacity: 0.25,
      roughness: 0.05,
      metalness: 0.3,
      side: THREE.DoubleSide,
    })
  );
  glass.position.z = -0.03;
  win.add(glass);

  // Horizontal blinds
  const blindMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.5 });
  for (let i = 0; i < 12; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.03, 0.12), blindMat);
    slat.position.set(0, 1.7 - i * 0.32, 0.06);
    slat.rotation.x = 0.15;
    win.add(slat);
  }

  return win;
}

// ── Helper: Ceiling fluorescent light fixture ──
function createCeilingLight(): THREE.Group {
  const fixture = new THREE.Group();
  const housingMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.3, roughness: 0.4 });

  // Housing
  const housing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.5), housingMat);
  fixture.add(housing);

  // Light diffuser panel (glowing)
  const diffuser = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.03, 0.42),
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      emissive: 0xe2e8f0,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.9,
    })
  );
  diffuser.position.y = -0.04;
  fixture.add(diffuser);

  return fixture;
}

// ══════════════════════════════════════════════════════════════
// ██  MAIN COMPONENT  ██
// ══════════════════════════════════════════════════════════════

export const WaitingRoom3DCanvas: React.FC<WaitingRoom3DProps> = ({
  queuePosition,
  totalWaiting,
  userTokenNumber,
  servingTokenNumber,
  isEmergency,
  cameraView,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const emergencyLightRef = useRef<THREE.PointLight | null>(null);
  const dustRef = useRef<THREE.Points | null>(null);

  const [badges, setBadges] = useState<
    Array<{ id: string; label: string; x: number; y: number; isUser: boolean; isServing: boolean; visible: boolean }>
  >([]);
  const seatPositionsRef = useRef<PatientSeatData[]>([]);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // ━━━━━ SCENE ━━━━━
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#03050b');
    scene.fog = new THREE.FogExp2('#050810', 0.018);

    // ━━━━━ CAMERA ━━━━━
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 120);
    camera.position.set(0, 11, 24);
    camera.lookAt(0, 2, -2);
    cameraRef.current = camera;

    // ━━━━━ RENDERER ━━━━━
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ━━━━━ ORBIT CONTROLS ━━━━━
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.minDistance = 2;
    controls.maxDistance = 45;
    controls.target.set(0, 2, -2);
    controls.enablePan = true;
    controls.panSpeed = 0.6;
    controlsRef.current = controls;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // LIGHTING (Multi-source Realistic Hospital)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // Very soft ambient fill (like reflected ceiling light)
    const hemiLight = new THREE.HemisphereLight('#2d3748', '#0f172a', 1.8);
    scene.add(hemiLight);

    // Main overhead directional (sun through windows)
    const sunLight = new THREE.DirectionalLight('#e8edf5', 2.5);
    sunLight.position.set(8, 20, 12);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 60;
    sunLight.shadow.camera.left = -25;
    sunLight.shadow.camera.right = 25;
    sunLight.shadow.camera.top = 25;
    sunLight.shadow.camera.bottom = -25;
    sunLight.shadow.bias = -0.001;
    scene.add(sunLight);

    // Secondary fill light from opposite side
    const fillLight = new THREE.DirectionalLight('#94a3b8', 0.8);
    fillLight.position.set(-10, 14, -5);
    scene.add(fillLight);

    // Ceiling light point sources (simulate fluorescent tubes)
    const ceilingLightPositions = [
      [-6, 13.5, -4], [0, 13.5, -4], [6, 13.5, -4],
      [-6, 13.5, 3], [0, 13.5, 3], [6, 13.5, 3],
    ];
    for (const pos of ceilingLightPositions) {
      const cl = new THREE.PointLight('#e2e8f0', 1.2, 18, 1.5);
      cl.position.set(pos[0], pos[1], pos[2]);
      scene.add(cl);
    }

    // Doctor room accent light (cool blue)
    const docSpot = new THREE.SpotLight('#38bdf8', 4, 22, Math.PI / 4, 0.6, 1.2);
    docSpot.position.set(-10, 12, -8);
    docSpot.target.position.set(-10, 0, -12);
    docSpot.castShadow = true;
    scene.add(docSpot);
    scene.add(docSpot.target);

    // Emergency room red light (off by default)
    const erLight = new THREE.PointLight('#ff2a5f', 0, 30, 1.5);
    erLight.position.set(10, 8, -10);
    scene.add(erLight);
    emergencyLightRef.current = erLight;

    // Warm sconce accent light on back wall (center)
    const sconceLight = new THREE.PointLight('#fbbf24', 0.6, 12, 2);
    sconceLight.position.set(0, 10, -14);
    scene.add(sconceLight);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ARCHITECTURE: Floor, Walls, Ceiling, Baseboards
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const roomWidth = 36;
    const roomDepth = 32;
    const roomHeight = 14;

    // ── FLOOR ──
    const floorTex = createFloorTexture();
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.2,
      metalness: 0.6,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomDepth), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Floor reflection plane (subtle mirror)
    const reflFloorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.05,
      metalness: 1,
      transparent: true,
      opacity: 0.12,
    });
    const reflFloor = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomDepth), reflFloorMat);
    reflFloor.rotation.x = -Math.PI / 2;
    reflFloor.position.y = -0.01;
    scene.add(reflFloor);

    // ── WALLS ──
    const wallTex = createWallTexture();
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.7, metalness: 0.05 });

    // Back Wall
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomHeight), wallMat);
    backWall.position.set(0, roomHeight / 2, -roomDepth / 2);
    backWall.receiveShadow = true;
    scene.add(backWall);

    // Left Wall
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(roomDepth, roomHeight), wallMat);
    leftWall.position.set(-roomWidth / 2, roomHeight / 2, 0);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    // Right Wall
    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(roomDepth, roomHeight), wallMat);
    rightWall.position.set(roomWidth / 2, roomHeight / 2, 0);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.receiveShadow = true;
    scene.add(rightWall);

    // ── CEILING ──
    const ceilTex = createCeilingTexture();
    const ceilMat = new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.8, metalness: 0.05 });
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomDepth), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = roomHeight;
    scene.add(ceiling);

    // ── BASEBOARDS ──
    const baseboardMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.2 });
    const bbH = 0.25;
    // Back
    const bbBack = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, bbH, 0.06), baseboardMat);
    bbBack.position.set(0, bbH / 2, -roomDepth / 2 + 0.03);
    scene.add(bbBack);
    // Left
    const bbLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, bbH, roomDepth), baseboardMat);
    bbLeft.position.set(-roomWidth / 2 + 0.03, bbH / 2, 0);
    scene.add(bbLeft);
    // Right
    const bbRight = new THREE.Mesh(new THREE.BoxGeometry(0.06, bbH, roomDepth), baseboardMat);
    bbRight.position.set(roomWidth / 2 - 0.03, bbH / 2, 0);
    scene.add(bbRight);

    // ── CROWN MOLDING (top edge accent) ──
    const crownMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.3, metalness: 0.3 });
    const crownH = 0.15;
    const crownBack = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, crownH, 0.08), crownMat);
    crownBack.position.set(0, roomHeight - crownH / 2, -roomDepth / 2 + 0.04);
    scene.add(crownBack);
    const crownLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, crownH, roomDepth), crownMat);
    crownLeft.position.set(-roomWidth / 2 + 0.04, roomHeight - crownH / 2, 0);
    scene.add(crownLeft);
    const crownRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, crownH, roomDepth), crownMat);
    crownRight.position.set(roomWidth / 2 - 0.04, roomHeight - crownH / 2, 0);
    scene.add(crownRight);

    // ── CEILING LIGHT FIXTURES ──
    for (const pos of ceilingLightPositions) {
      const fixture = createCeilingLight();
      fixture.position.set(pos[0], roomHeight - 0.06, pos[2]);
      scene.add(fixture);
    }

    // ── WINDOWS on Left Wall ──
    for (let i = 0; i < 2; i++) {
      const win = createWindow();
      win.position.set(-roomWidth / 2 + 0.1, 6, -4 + i * 10);
      win.rotation.y = Math.PI / 2;
      scene.add(win);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // DOCTOR CONSULTATION ROOM (LEFT BACK)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const doctorGroup = new THREE.Group();
    doctorGroup.position.set(-9, 0, -12);

    // Reception Counter / L-shaped Desk
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.25, metalness: 0.1 });
    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(5, 0.1, 2.2), deskMat);
    deskTop.position.set(0, 2.1, 0);
    deskTop.castShadow = true;
    deskTop.receiveShadow = true;
    doctorGroup.add(deskTop);

    // Desk front panel
    const deskFront = new THREE.Mesh(new THREE.BoxGeometry(5, 2.1, 0.08), deskMat);
    deskFront.position.set(0, 1.05, 1.1);
    deskFront.castShadow = true;
    doctorGroup.add(deskFront);

    // Desk side panel
    const deskSide = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.1, 2.2), deskMat);
    deskSide.position.set(2.5, 1.05, 0);
    doctorGroup.add(deskSide);

    // Monitor on desk
    const monitorStand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.2 })
    );
    monitorStand.position.set(-0.5, 2.25, -0.3);
    doctorGroup.add(monitorStand);

    const monitorScreen = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.9, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x020617, emissive: 0x0ea5e9, emissiveIntensity: 0.7 })
    );
    monitorScreen.position.set(-0.5, 2.85, -0.3);
    doctorGroup.add(monitorScreen);

    // Monitor bezel
    const bezel = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.0, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x1e293b })
    );
    bezel.position.set(-0.5, 2.85, -0.33);
    doctorGroup.add(bezel);

    // Keyboard
    const keyboard = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.03, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 })
    );
    keyboard.position.set(-0.5, 2.12, 0.3);
    doctorGroup.add(keyboard);

    // Glass Door
    const opdDoorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 7, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.3 })
    );
    opdDoorFrame.position.set(0, 3.5, -3);
    doctorGroup.add(opdDoorFrame);

    const opdGlass = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 6.6, 0.06),
      new THREE.MeshStandardMaterial({
        color: 0x164e63,
        emissive: 0x0284c7,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.45,
        roughness: 0.05,
      })
    );
    opdGlass.position.set(0, 3.5, -2.9);
    doctorGroup.add(opdGlass);

    // Door handle
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.1 });
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.08), handleMat);
    handle.position.set(1.2, 3.2, -2.82);
    doctorGroup.add(handle);

    // OPD Room Sign Board (illuminated)
    const opdSign = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 0.9, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x0c4a6e, emissive: 0x38bdf8, emissiveIntensity: 0.8, roughness: 0.3 })
    );
    opdSign.position.set(0, 7.3, -2.8);
    doctorGroup.add(opdSign);

    scene.add(doctorGroup);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // EMERGENCY ROOM TRAUMA BAY (RIGHT BACK)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const erGroup = new THREE.Group();
    erGroup.position.set(9, 0, -12);

    // Double-leaf ER door
    const erDoorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 7, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x450a0a, metalness: 0.2 })
    );
    erDoorFrame.position.set(0, 3.5, -3);
    erGroup.add(erDoorFrame);

    // Left door leaf
    const erDoorL = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 6.6, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x7f1d1d, emissive: 0xef4444, emissiveIntensity: 0.5, roughness: 0.4 })
    );
    erDoorL.position.set(-1.1, 3.5, -2.88);
    erGroup.add(erDoorL);

    // Right door leaf
    const erDoorR = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 6.6, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x7f1d1d, emissive: 0xef4444, emissiveIntensity: 0.5, roughness: 0.4 })
    );
    erDoorR.position.set(1.1, 3.5, -2.88);
    erGroup.add(erDoorR);

    // Window portals in ER doors
    const portalGlass = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      emissive: 0xef4444,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.4,
    });
    const portalL = new THREE.Mesh(new THREE.CircleGeometry(0.4, 16), portalGlass);
    portalL.position.set(-1.1, 4.5, -2.83);
    erGroup.add(portalL);
    const portalR = new THREE.Mesh(new THREE.CircleGeometry(0.4, 16), portalGlass);
    portalR.position.set(1.1, 4.5, -2.83);
    erGroup.add(portalR);

    // Door handles
    const erHandleL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 0.08), handleMat);
    erHandleL.position.set(-0.3, 3.2, -2.82);
    erGroup.add(erHandleL);
    const erHandleR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 0.08), handleMat);
    erHandleR.position.set(0.3, 3.2, -2.82);
    erGroup.add(erHandleR);

    // ER Sign Board (glowing red)
    const erSign = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 0.9, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x7f1d1d, emissive: 0xf43f5e, emissiveIntensity: 1.0, roughness: 0.3 })
    );
    erSign.position.set(0, 7.3, -2.8);
    erGroup.add(erSign);

    // Red cross symbol on ER sign
    const crossMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.4 });
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.02), crossMat);
    crossV.position.set(-2, 7.3, -2.72);
    erGroup.add(crossV);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.02), crossMat);
    crossH.position.set(-2, 7.3, -2.72);
    erGroup.add(crossH);

    scene.add(erGroup);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CENTRAL DIGITAL QUEUE TV DISPLAY
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const tvGroup = new THREE.Group();
    tvGroup.position.set(0, 9.5, -12);

    const tvBody = new THREE.Mesh(
      new THREE.BoxGeometry(8, 4, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.15, metalness: 0.3 })
    );
    tvGroup.add(tvBody);

    // Screen (glowing)
    const tvScreen = new THREE.Mesh(
      new THREE.BoxGeometry(7.6, 3.6, 0.04),
      new THREE.MeshStandardMaterial({
        color: 0x0c4a6e,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.5,
        roughness: 0.1,
      })
    );
    tvScreen.position.z = 0.13;
    tvGroup.add(tvScreen);

    // TV bezels (thin frame)
    const tvBezelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
    const tvBezelT = new THREE.Mesh(new THREE.BoxGeometry(8, 0.08, 0.28), tvBezelMat);
    tvBezelT.position.y = 2;
    tvGroup.add(tvBezelT);
    const tvBezelB = new THREE.Mesh(new THREE.BoxGeometry(8, 0.12, 0.28), tvBezelMat);
    tvBezelB.position.y = -2;
    tvGroup.add(tvBezelB);

    // Mounting bracket
    const bracket1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 4.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.15 })
    );
    bracket1.position.set(-2.5, 4.2, 0);
    tvGroup.add(bracket1);
    const bracket2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 4.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.15 })
    );
    bracket2.position.set(2.5, 4.2, 0);
    tvGroup.add(bracket2);

    scene.add(tvGroup);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ENVIRONMENTAL PROPS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // Potted Plants
    const plant1 = createPottedPlant(1.2);
    plant1.position.set(-16, 0, -12);
    scene.add(plant1);

    const plant2 = createPottedPlant(1.5);
    plant2.position.set(16, 0, -12);
    scene.add(plant2);

    const plant3 = createPottedPlant(0.9);
    plant3.position.set(-16, 0, 8);
    scene.add(plant3);

    const plant4 = createPottedPlant(1.0);
    plant4.position.set(16, 0, 8);
    scene.add(plant4);

    // Side Tables with Magazines
    const table1 = createSideTable();
    table1.position.set(-5, 0, 10);
    scene.add(table1);

    const table2 = createSideTable();
    table2.position.set(5, 0, 10);
    scene.add(table2);

    // Water Cooler
    const cooler = createWaterCooler();
    cooler.position.set(15, 0, 0);
    scene.add(cooler);

    // Wall Clock on Back Wall
    const wallClock = createWallClock();
    wallClock.position.set(0, 11, -15.7);
    scene.add(wallClock);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // RECEPTION / CHECK-IN COUNTER (Front Right)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const receptionGroup = new THREE.Group();
    receptionGroup.position.set(12, 0, 10);

    const rcDeskMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.3, metalness: 0.1 });
    const rcTop = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 1.6), rcDeskMat);
    rcTop.position.y = 2.4;
    rcTop.castShadow = true;
    receptionGroup.add(rcTop);

    const rcFront = new THREE.Mesh(new THREE.BoxGeometry(4, 2.4, 0.08), rcDeskMat);
    rcFront.position.set(0, 1.2, -0.8);
    rcFront.castShadow = true;
    receptionGroup.add(rcFront);

    // Higher privacy screen
    const rcScreen = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.8, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x334155, transparent: true, opacity: 0.6 })
    );
    rcScreen.position.set(0, 2.8, -0.5);
    receptionGroup.add(rcScreen);

    // Reception sign
    const rcSign = new THREE.Mesh(
      new THREE.BoxGeometry(3, 0.6, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x0369a1, emissive: 0x38bdf8, emissiveIntensity: 0.6 })
    );
    rcSign.position.set(0, 3.5, -0.8);
    receptionGroup.add(rcSign);

    scene.add(receptionGroup);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // VOLUMETRIC DUST PARTICLES
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const dust = createDustParticles(600);
    scene.add(dust);
    dustRef.current = dust;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SEATING AREA — Chairs & Humanoids
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const seatList: PatientSeatData[] = [];
    const rows = 3;
    const cols = 5;
    const seatSpacingX = 2.8;
    const seatSpacingZ = 3.4;
    const userIndex = queuePosition;

    // Varied skin tones
    const skinTones = [0xd4a574, 0xc68642, 0x8d5524, 0xf1c27d, 0xe0ac69, 0xa0522d, 0xdeb887, 0xcd853f];
    // Varied shirt colors
    const shirtColors = [0x1e40af, 0x166534, 0x7c3aed, 0x0f766e, 0x9a3412, 0x1e3a5f, 0x4a2082, 0x1c4d3c, 0x6b21a8, 0x0e4a6f, 0x8b5e2b, 0x374151, 0x1e293b, 0x581c87, 0x064e3b];
    // Varied pants colors
    const pantsColors = [0x1e293b, 0x292524, 0x1c1917, 0x0f172a, 0x27272a, 0x171717];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const x = (c - (cols - 1) / 2) * seatSpacingX;
        const z = (r - 0.3) * seatSpacingZ + 2;

        const isUserSeat = idx === userIndex;
        const isServingSeat = idx === 0 && servingTokenNumber !== 'None';
        const isOccupied = idx <= totalWaiting;

        // Create chair
        const chair = createChair(isUserSeat, isServingSeat);
        chair.position.set(x, 0, z);
        scene.add(chair);

        // Seated humanoid
        if (isOccupied) {
          const skinIdx = idx % skinTones.length;
          const shirtIdx = idx % shirtColors.length;
          const pantsIdx = idx % pantsColors.length;

          const emissiveCol = isUserSeat ? 0x0284c7 : isServingSeat ? 0x0d9488 : undefined;
          const emissiveInt = isUserSeat ? 0.5 : isServingSeat ? 0.4 : 0;

          const humanoid = createHumanoid(
            skinTones[skinIdx],
            isUserSeat ? 0x0284c7 : isServingSeat ? 0x0d9488 : shirtColors[shirtIdx],
            pantsColors[pantsIdx],
            isUserSeat || isServingSeat,
            emissiveCol,
            emissiveInt
          );
          humanoid.position.set(x, 0.74, z);
          scene.add(humanoid);
        }

        // Highlight ring under user's seat
        if (isUserSeat) {
          const ringGeo = new THREE.RingGeometry(0.15, 1.5, 48);
          const ringMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.6,
          });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(x, 0.02, z);
          scene.add(ring);

          // Outer glow ring
          const outerRing = new THREE.Mesh(
            new THREE.RingGeometry(1.5, 2.0, 48),
            new THREE.MeshBasicMaterial({ color: 0x0ea5e9, side: THREE.DoubleSide, transparent: true, opacity: 0.2 })
          );
          outerRing.rotation.x = -Math.PI / 2;
          outerRing.position.set(x, 0.015, z);
          scene.add(outerRing);

          // Vertical beam of light above user
          const beamGeo = new THREE.CylinderGeometry(0.02, 1.2, 10, 16, 1, true);
          const beamMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.08,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
          const beam = new THREE.Mesh(beamGeo, beamMat);
          beam.position.set(x, 5, z);
          scene.add(beam);

          gsap.to(ring.scale, { x: 1.2, y: 1.2, duration: 1.5, repeat: -1, yoyo: true, ease: 'sine.inOut' });
          gsap.to(outerRing.scale, { x: 1.15, y: 1.15, duration: 2, repeat: -1, yoyo: true, ease: 'sine.inOut' });
        }

        // Store 3D badge position
        const worldPos = new THREE.Vector3(x, 3.0, z);
        let statusLabel = '';
        if (isUserSeat) {
          statusLabel = `📍 YOU — ${userTokenNumber}`;
        } else if (isServingSeat) {
          statusLabel = `✅ Serving: ${servingTokenNumber}`;
        } else if (idx < userIndex) {
          statusLabel = `#${userIndex - idx} Ahead`;
        } else if (isOccupied) {
          statusLabel = `Waiting`;
        }

        if (isOccupied || isUserSeat) {
          seatList.push({
            index: idx,
            tokenNumber: userTokenNumber.split('-')[0] + '-' + (100 + idx),
            isUser: isUserSeat,
            isServing: isServingSeat,
            position: worldPos,
            statusLabel,
          });
        }
      }
    }

    // Door labels
    seatList.push({
      index: 998,
      tokenNumber: 'DOCTOR',
      isUser: false,
      isServing: false,
      position: new THREE.Vector3(-9, 8, -14.5),
      statusLabel: '🚪 OPD Consultation Room 12',
    });

    seatList.push({
      index: 999,
      tokenNumber: 'ER',
      isUser: false,
      isServing: false,
      position: new THREE.Vector3(9, 8, -14.5),
      statusLabel: '🚨 Emergency Trauma Bay',
    });

    seatPositionsRef.current = seatList;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // RENDER LOOP
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let animationId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      controls.update();

      // Gentle TV sway
      tvGroup.position.y = 9.5 + Math.sin(elapsed * 0.8) * 0.06;

      // Dust particle drift
      if (dustRef.current) {
        const positions = dustRef.current.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < positions.length; i += 3) {
          positions[i] += Math.sin(elapsed * 0.3 + i) * 0.001;
          positions[i + 1] += Math.sin(elapsed * 0.5 + i * 0.7) * 0.0005;
          positions[i + 2] += Math.cos(elapsed * 0.4 + i * 0.5) * 0.0008;
        }
        dustRef.current.geometry.attributes.position.needsUpdate = true;
      }

      // Emergency strobe
      if (emergencyLightRef.current && emergencyLightRef.current.intensity > 0) {
        emergencyLightRef.current.intensity = 5 + Math.sin(elapsed * 10) * 4;
      }

      // Project 3D labels to 2D
      if (cameraRef.current && container) {
        const w = container.clientWidth;
        const h = container.clientHeight;
        const updated = seatPositionsRef.current.map((seat, i) => {
          const vec = seat.position.clone();
          vec.project(cameraRef.current!);
          return {
            id: `badge-${i}-${seat.tokenNumber}`,
            label: seat.statusLabel,
            x: (vec.x * 0.5 + 0.5) * w,
            y: (-vec.y * 0.5 + 0.5) * h,
            isUser: seat.isUser,
            isServing: seat.isServing,
            visible: vec.z < 1 && vec.z > -1,
          };
        });
        setBadges(updated);
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      controls.dispose();
      renderer.dispose();
      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [queuePosition, totalWaiting, userTokenNumber, servingTokenNumber]);

  // ━━━━━ Camera Preset Views ━━━━━
  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current || !emergencyLightRef.current) return;

    const camera = cameraRef.current;
    const controls = controlsRef.current;

    if (isEmergency || cameraView === 'emergency') {
      gsap.to(emergencyLightRef.current, { intensity: 7, duration: 0.5 });
      gsap.to(camera.position, { x: 9, y: 5, z: -3, duration: 1.8, ease: 'power3.inOut' });
      gsap.to(controls.target, { x: 9, y: 3.5, z: -14, duration: 1.8, ease: 'power3.inOut' });
    } else if (cameraView === 'user') {
      const userSeat = seatPositionsRef.current.find((s) => s.isUser);
      if (userSeat) {
        gsap.to(camera.position, {
          x: userSeat.position.x + 2,
          y: userSeat.position.y + 3,
          z: userSeat.position.z + 5,
          duration: 1.8,
          ease: 'power2.out',
        });
        gsap.to(controls.target, {
          x: userSeat.position.x,
          y: userSeat.position.y - 1,
          z: userSeat.position.z,
          duration: 1.8,
          ease: 'power2.out',
        });
      }
    } else if (cameraView === 'doctor') {
      gsap.to(camera.position, { x: -9, y: 5, z: -3, duration: 1.8, ease: 'power3.inOut' });
      gsap.to(controls.target, { x: -9, y: 3.5, z: -14, duration: 1.8, ease: 'power3.inOut' });
    } else {
      gsap.to(emergencyLightRef.current, { intensity: 0, duration: 0.5 });
      gsap.to(camera.position, { x: 0, y: 11, z: 24, duration: 2, ease: 'power2.out' });
      gsap.to(controls.target, { x: 0, y: 2, z: -2, duration: 2, ease: 'power2.out' });
    }
  }, [cameraView, isEmergency]);

  return (
    <div className="relative w-full h-full min-h-[500px] rounded-3xl overflow-hidden shadow-2xl border border-white/[0.06] bg-[#03050b] select-none">
      {/* 3D Canvas */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating 3D Projection Badges */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {badges.map((badge) => {
          if (!badge.visible || !badge.label) return null;
          return (
            <div
              key={badge.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-100"
              style={{ left: `${badge.x}px`, top: `${badge.y}px` }}
            >
              <div
                className={`px-2.5 py-1 rounded-xl text-[10px] font-bold shadow-lg backdrop-blur-lg whitespace-nowrap border ${
                  badge.isUser
                    ? 'bg-sky-400 text-zinc-950 border-white shadow-[0_0_20px_rgba(56,189,248,0.7)] animate-pulse font-display text-xs'
                    : badge.isServing
                    ? 'bg-teal-400 text-zinc-950 border-teal-200 shadow-[0_0_14px_rgba(45,212,191,0.5)] font-display'
                    : badge.label.includes('Emergency')
                    ? 'bg-rose-500/90 text-white border-rose-300 font-display tracking-wider'
                    : badge.label.includes('OPD')
                    ? 'bg-sky-500/90 text-white border-sky-300 font-display tracking-wider'
                    : 'bg-[#0a0c14]/80 text-zinc-400 border-white/[0.06]'
                }`}
              >
                {badge.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Controls HUD */}
      <div className="absolute top-4 left-4 flex items-center gap-2 bg-[#050508]/90 backdrop-blur-xl px-4 py-2.5 rounded-2xl border border-white/[0.06] text-xs font-bold text-zinc-400 shadow-xl">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>🖱️ Drag to Rotate • Scroll to Zoom • Right-click to Pan</span>
      </div>
    </div>
  );
};

export default WaitingRoom3DCanvas;
