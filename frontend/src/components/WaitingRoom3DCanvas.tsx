import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
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

// ══════════════════════════════════════════════════════════════
// ██  PROCEDURAL PBR TEXTURES  ██
// ══════════════════════════════════════════════════════════════

// ── Dark polished marble floor tile texture ──
function createFloorTexture(): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const tileCount = 8;
  const tileSize = size / tileCount;

  for (let r = 0; r < tileCount; r++) {
    for (let c = 0; c < tileCount; c++) {
      const base = 14 + ((r + c) % 2) * 5 + Math.random() * 3;
      ctx.fillStyle = `rgb(${base}, ${base + 2}, ${base + 7})`;
      ctx.fillRect(c * tileSize, r * tileSize, tileSize, tileSize);

      // Marble veining
      for (let v = 0; v < 14; v++) {
        const vx = c * tileSize + Math.random() * tileSize;
        const vy = r * tileSize + Math.random() * tileSize;
        ctx.beginPath();
        ctx.moveTo(vx, vy);
        ctx.bezierCurveTo(
          vx + (Math.random() - 0.5) * 35, vy + Math.random() * 18,
          vx + (Math.random() - 0.5) * 55, vy + Math.random() * 28,
          vx + (Math.random() - 0.5) * 75, vy + Math.random() * 38
        );
        const vBright = 22 + Math.random() * 14;
        ctx.strokeStyle = `rgba(${vBright}, ${vBright + 3}, ${vBright + 8}, ${0.10 + Math.random() * 0.08})`;
        ctx.lineWidth = 0.3 + Math.random() * 0.9;
        ctx.stroke();
      }

      // Specular highlight spots
      for (let s = 0; s < 4; s++) {
        const sx = c * tileSize + Math.random() * tileSize;
        const sy = r * tileSize + Math.random() * tileSize;
        ctx.fillStyle = `rgba(40, 48, 65, ${Math.random() * 0.06})`;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.random() * 10 + 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Grout lines
  ctx.strokeStyle = '#06080f';
  ctx.lineWidth = 3.5;
  for (let i = 0; i <= tileCount; i++) {
    ctx.beginPath();
    ctx.moveTo(i * tileSize, 0);
    ctx.lineTo(i * tileSize, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * tileSize);
    ctx.lineTo(size, i * tileSize);
    ctx.stroke();
  }

  // Surface micro-texture grain
  for (let i = 0; i < 8000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const bright = 8 + Math.random() * 22;
    ctx.fillStyle = `rgba(${bright}, ${bright + 2}, ${bright + 5}, ${Math.random() * 0.05})`;
    ctx.fillRect(x, y, 1, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── Floor roughness map: smooth tiles, rough grout ──
function createFloorRoughnessMap(): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#2a2a2a'; // low roughness (smooth tile)
  ctx.fillRect(0, 0, size, size);

  const tileCount = 8;
  const tileSize = size / tileCount;

  // Grout lines (high roughness)
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 5;
  for (let i = 0; i <= tileCount; i++) {
    ctx.beginPath();
    ctx.moveTo(i * tileSize, 0);
    ctx.lineTo(i * tileSize, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * tileSize);
    ctx.lineTo(size, i * tileSize);
    ctx.stroke();
  }

  // Random roughness variation on tile surface
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = `rgba(100, 100, 100, ${Math.random() * 0.08})`;
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

// ── Enhanced plaster wall texture ──
function createWallTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f1729';
  ctx.fillRect(0, 0, size, size);

  // Layer 1: large soft variation (paint roller effect)
  for (let i = 0; i < 40; i++) {
    const y = Math.random() * size;
    const gradient = ctx.createLinearGradient(0, y - 15, 0, y + 15);
    gradient.addColorStop(0, 'rgba(18, 25, 45, 0)');
    gradient.addColorStop(0.5, `rgba(18, 25, 45, ${Math.random() * 0.15})`);
    gradient.addColorStop(1, 'rgba(18, 25, 45, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, y - 15, size, 30);
  }

  // Layer 2: medium grain noise
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const brightness = Math.random() * 20 + 10;
    ctx.fillStyle = `rgba(${brightness}, ${brightness + 4}, ${brightness + 14}, 0.20)`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  // Layer 3: fine speckle
  for (let i = 0; i < 8000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const brightness = Math.random() * 15 + 8;
    ctx.fillStyle = `rgba(${brightness}, ${brightness + 3}, ${brightness + 10}, 0.08)`;
    ctx.fillRect(x, y, 0.8, 0.8);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  return tex;
}

// ── Acoustic ceiling panel texture ──
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
      // Panel base
      ctx.fillStyle = '#0a0e1a';
      ctx.fillRect(c * panelSize, r * panelSize, panelSize, panelSize);

      // Panel border (T-bar shadow)
      ctx.strokeStyle = '#1a2236';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(c * panelSize + 1, r * panelSize + 1, panelSize - 2, panelSize - 2);

      // Inner bevel highlight
      ctx.strokeStyle = 'rgba(30, 40, 60, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(c * panelSize + 3, r * panelSize + 3, panelSize - 6, panelSize - 6);

      // Acoustic perforation dots
      const dotSpacing = panelSize / 10;
      for (let dy = 1; dy < 10; dy++) {
        for (let dx = 1; dx < 10; dx++) {
          ctx.fillStyle = `rgba(6, 8, 14, ${0.4 + Math.random() * 0.3})`;
          ctx.beginPath();
          ctx.arc(
            c * panelSize + dx * dotSpacing,
            r * panelSize + dy * dotSpacing,
            0.8 + Math.random() * 0.4,
            0, Math.PI * 2
          );
          ctx.fill();
        }
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

// ══════════════════════════════════════════════════════════════
// ██  OUTDOOR SCENERY (Window Backdrop)  ██
// ══════════════════════════════════════════════════════════════

function createOutdoorScenery(): THREE.Mesh {
  const w = 512, h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Sky gradient (dusk)
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
  skyGrad.addColorStop(0, '#06101e');
  skyGrad.addColorStop(0.30, '#0f2040');
  skyGrad.addColorStop(0.55, '#1a3558');
  skyGrad.addColorStop(0.72, '#3a5a7a');
  skyGrad.addColorStop(0.82, '#8a7060');
  skyGrad.addColorStop(0.90, '#c49060');
  skyGrad.addColorStop(1.0, '#e0a878');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  // Stars
  for (let i = 0; i < 60; i++) {
    const sx = Math.random() * w;
    const sy = Math.random() * h * 0.45;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + Math.random() * 0.55})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 0.4 + Math.random() * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Building silhouettes
  const buildings = [
    { x: 5, w: 38, h: 55 }, { x: 50, w: 28, h: 95 }, { x: 82, w: 42, h: 70 },
    { x: 130, w: 32, h: 125 }, { x: 168, w: 48, h: 50 }, { x: 222, w: 36, h: 88 },
    { x: 264, w: 52, h: 115 }, { x: 322, w: 28, h: 65 }, { x: 355, w: 42, h: 135 },
    { x: 402, w: 38, h: 80 }, { x: 445, w: 46, h: 60 }, { x: 495, w: 20, h: 100 },
  ];

  for (const b of buildings) {
    ctx.fillStyle = '#050a16';
    ctx.fillRect(b.x, h - b.h, b.w, b.h);

    // Lit windows
    for (let wy = h - b.h + 8; wy < h - 6; wy += 10) {
      for (let wx = b.x + 4; wx < b.x + b.w - 5; wx += 8) {
        if (Math.random() > 0.35) {
          ctx.fillStyle = Math.random() > 0.3 ? '#fbbf24' : '#f59e0b';
          ctx.globalAlpha = 0.5 + Math.random() * 0.5;
          ctx.fillRect(wx, wy, 3, 4);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // Distant horizon tree line
  ctx.fillStyle = '#0a1520';
  for (let tx = 0; tx < w; tx += 6) {
    const th = 8 + Math.sin(tx * 0.05) * 5 + Math.random() * 4;
    ctx.fillRect(tx, h - th - 3, 6, th);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 7),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
  );
  return mesh;
}

// ══════════════════════════════════════════════════════════════
// ██  ORGANIC HUMANOID FIGURE  ██
// ══════════════════════════════════════════════════════════════

function createHumanoid(
  skinColor: number,
  shirtColor: number,
  pantsColor: number,
  isHighlight: boolean,
  emissiveColor?: number,
  emissiveIntensity?: number,
  seatIndex?: number,
  tweens?: gsap.core.Tween[]
): THREE.Group {
  const group = new THREE.Group();
  const idx = seatIndex || 0;

  const skinMat = new THREE.MeshStandardMaterial({
    color: skinColor,
    roughness: 0.55,
    metalness: 0.03,
    ...(isHighlight && emissiveColor ? { emissive: emissiveColor, emissiveIntensity: emissiveIntensity || 0.4 } : {}),
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: shirtColor,
    roughness: 0.72,
    metalness: 0.02,
    ...(isHighlight && emissiveColor ? { emissive: emissiveColor, emissiveIntensity: (emissiveIntensity || 0.4) * 0.6 } : {}),
  });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.82 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.45, metalness: 0.05 });

  // Hair color variety
  const hairColors = [0x0a0a0a, 0x1a0a00, 0x2c1508, 0x0a0a0a, 0x3d2514, 0x100e0a, 0x1a0800, 0x0c0c0c];
  const hairMat = new THREE.MeshStandardMaterial({
    color: hairColors[idx % hairColors.length],
    roughness: 0.88,
  });

  // ── Hips / Pelvis ──
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.22, 0.55), pantsMat);
  hips.position.y = 0.12;
  hips.castShadow = true;
  group.add(hips);

  // ── Thighs (horizontal on seat) ──
  const thighL = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.55, 12), pantsMat);
  thighL.position.set(-0.16, 0.1, 0.28);
  thighL.rotation.x = Math.PI / 2;
  thighL.castShadow = true;
  group.add(thighL);

  const thighR = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.55, 12), pantsMat);
  thighR.position.set(0.16, 0.1, 0.28);
  thighR.rotation.x = Math.PI / 2;
  thighR.castShadow = true;
  group.add(thighR);

  // ── Shins ──
  const shinL = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.085, 0.52, 12), pantsMat);
  shinL.position.set(-0.16, -0.15, 0.52);
  shinL.castShadow = true;
  group.add(shinL);

  const shinR = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.085, 0.52, 12), pantsMat);
  shinR.position.set(0.16, -0.15, 0.52);
  shinR.castShadow = true;
  group.add(shinR);

  // ── Shoes (with soles) ──
  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.26), shoeMat);
  shoeL.position.set(-0.16, -0.42, 0.56);
  group.add(shoeL);
  const soleMat = new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 1 });
  const soleL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.27), soleMat);
  soleL.position.set(-0.16, -0.46, 0.56);
  group.add(soleL);

  const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.26), shoeMat);
  shoeR.position.set(0.16, -0.42, 0.56);
  group.add(shoeR);
  const soleR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.27), soleMat);
  soleR.position.set(0.16, -0.46, 0.56);
  group.add(soleR);

  // ── Torso (organic LatheGeometry) ──
  const torsoProfile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.22, 0.03),
    new THREE.Vector2(0.18, 0.20),
    new THREE.Vector2(0.24, 0.38),
    new THREE.Vector2(0.27, 0.50),
    new THREE.Vector2(0.24, 0.58),
    new THREE.Vector2(0.18, 0.63),
    new THREE.Vector2(0.10, 0.67),
    new THREE.Vector2(0, 0.70),
  ];
  const torsoGeo = new THREE.LatheGeometry(torsoProfile, 16);
  const torso = new THREE.Mesh(torsoGeo, shirtMat);
  torso.position.y = 0.23;
  torso.castShadow = true;
  group.add(torso);

  // Breathing animation
  if (tweens) {
    tweens.push(gsap.to(torso.scale, {
      y: 1.025,
      x: 1.012,
      z: 1.012,
      duration: 2.2 + Math.random() * 1.2,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      delay: Math.random() * 2.5,
    }));
  }

  // ── Collar line ──
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.11, 0.015, 6, 16),
    shirtMat
  );
  collar.position.y = 0.92;
  collar.rotation.x = Math.PI / 2;
  group.add(collar);

  // ── Neck ──
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 0.14, 12), skinMat);
  neck.position.y = 1.02;
  group.add(neck);

  // ── Head (organic LatheGeometry) ──
  const headProfile = [
    new THREE.Vector2(0, -0.23),
    new THREE.Vector2(0.08, -0.20),
    new THREE.Vector2(0.15, -0.12),
    new THREE.Vector2(0.18, -0.02),
    new THREE.Vector2(0.19, 0.06),
    new THREE.Vector2(0.17, 0.14),
    new THREE.Vector2(0.13, 0.20),
    new THREE.Vector2(0.06, 0.225),
    new THREE.Vector2(0, 0.23),
  ];
  const headGeo = new THREE.LatheGeometry(headProfile, 20);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.y = 1.28;
  head.castShadow = true;
  group.add(head);

  // Head micro-movement animation
  if (tweens) {
    tweens.push(gsap.to(head.rotation, {
      y: (Math.random() - 0.5) * 0.12,
      x: (Math.random() - 0.5) * 0.04,
      duration: 4 + Math.random() * 3,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      delay: Math.random() * 4,
    }));
  }

  // ── Facial Features ──
  // Eyes
  const eyeSocketMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4 });
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.5 });
  const eyeGeo = new THREE.SphereGeometry(0.028, 8, 8);
  const eyeWhiteGeo = new THREE.SphereGeometry(0.022, 8, 8);

  const lEye = new THREE.Mesh(eyeGeo, eyeSocketMat);
  lEye.position.set(-0.065, 1.29, 0.155);
  group.add(lEye);
  const lWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
  lWhite.position.set(-0.065, 1.29, 0.165);
  group.add(lWhite);

  const rEye = new THREE.Mesh(eyeGeo, eyeSocketMat);
  rEye.position.set(0.065, 1.29, 0.155);
  group.add(rEye);
  const rWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
  rWhite.position.set(0.065, 1.29, 0.165);
  group.add(rWhite);

  // Eyebrows
  const browMat = new THREE.MeshStandardMaterial({ color: hairColors[idx % hairColors.length], roughness: 0.9 });
  const browGeo = new THREE.BoxGeometry(0.055, 0.01, 0.015);
  const lBrow = new THREE.Mesh(browGeo, browMat);
  lBrow.position.set(-0.065, 1.33, 0.16);
  group.add(lBrow);
  const rBrow = new THREE.Mesh(browGeo, browMat);
  rBrow.position.set(0.065, 1.33, 0.16);
  group.add(rBrow);

  // Nose
  const noseGeo = new THREE.ConeGeometry(0.02, 0.055, 6);
  const nose = new THREE.Mesh(noseGeo, skinMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 1.24, 0.19);
  group.add(nose);

  // Mouth line
  const mouthGeo = new THREE.BoxGeometry(0.05, 0.005, 0.008);
  const mouth = new THREE.Mesh(mouthGeo, new THREE.MeshStandardMaterial({
    color: new THREE.Color(skinColor).multiplyScalar(0.65),
    roughness: 0.7,
  }));
  mouth.position.set(0, 1.18, 0.165);
  group.add(mouth);

  // Ears
  const earGeo = new THREE.SphereGeometry(0.045, 8, 8);
  const earL = new THREE.Mesh(earGeo, skinMat);
  earL.position.set(-0.19, 1.28, 0);
  earL.scale.set(0.5, 1, 0.7);
  group.add(earL);
  const earR = new THREE.Mesh(earGeo, skinMat);
  earR.position.set(0.19, 1.28, 0);
  earR.scale.set(0.5, 1, 0.7);
  group.add(earR);

  // ── Hair Variety (4 styles) ──
  const hairStyle = idx % 4;
  switch (hairStyle) {
    case 0: { // Short buzz
      const buzz = new THREE.Mesh(
        new THREE.SphereGeometry(0.195, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.42),
        hairMat
      );
      buzz.position.y = 1.30;
      group.add(buzz);
      break;
    }
    case 1: { // Medium swept
      const med = new THREE.Mesh(
        new THREE.SphereGeometry(0.205, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
        hairMat
      );
      med.position.y = 1.31;
      group.add(med);
      // Side volume
      const tuftL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), hairMat);
      tuftL.position.set(-0.17, 1.30, 0.06);
      group.add(tuftL);
      const tuftR = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), hairMat);
      tuftR.position.set(0.17, 1.30, 0.06);
      group.add(tuftR);
      break;
    }
    case 2: { // Long with back piece
      const longTop = new THREE.Mesh(
        new THREE.SphereGeometry(0.21, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.48),
        hairMat
      );
      longTop.position.y = 1.32;
      group.add(longTop);
      const longBack = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.07, 0.35, 10),
        hairMat
      );
      longBack.position.set(0, 1.06, -0.10);
      group.add(longBack);
      break;
    }
    case 3: { // Head covering / cap
      const capColors = [0x6366f1, 0xf472b6, 0x34d399, 0xfbbf24, 0x818cf8, 0xfb923c];
      const capMat = new THREE.MeshStandardMaterial({
        color: capColors[idx % capColors.length],
        roughness: 0.7,
      });
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
        capMat
      );
      cap.position.y = 1.31;
      group.add(cap);
      // Fabric drape at back
      const drape = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.10, 0.18, 10),
        capMat
      );
      drape.position.set(0, 1.10, -0.08);
      group.add(drape);
      break;
    }
  }

  // ── Upper Arms ──
  const upperArmL = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.38, 10), shirtMat);
  upperArmL.position.set(-0.36, 0.72, 0.05);
  upperArmL.rotation.z = 0.25;
  upperArmL.castShadow = true;
  group.add(upperArmL);

  const upperArmR = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.38, 10), shirtMat);
  upperArmR.position.set(0.36, 0.72, 0.05);
  upperArmR.rotation.z = -0.25;
  upperArmR.castShadow = true;
  group.add(upperArmR);

  // ── Forearms (resting on thighs) ──
  const forearmL = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.34, 10), skinMat);
  forearmL.position.set(-0.32, 0.42, 0.22);
  forearmL.rotation.x = Math.PI / 3;
  forearmL.rotation.z = 0.1;
  group.add(forearmL);

  const forearmR = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.34, 10), skinMat);
  forearmR.position.set(0.32, 0.42, 0.22);
  forearmR.rotation.x = Math.PI / 3;
  forearmR.rotation.z = -0.1;
  group.add(forearmR);

  // ── Hands ──
  const handGeo = new THREE.SphereGeometry(0.055, 8, 8);
  const handL = new THREE.Mesh(handGeo, skinMat);
  handL.position.set(-0.28, 0.26, 0.38);
  group.add(handL);
  const handR = new THREE.Mesh(handGeo, skinMat);
  handR.position.set(0.28, 0.26, 0.38);
  group.add(handR);

  // ── Belt line ──
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.4, metalness: 0.2 });
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.012, 6, 24), beltMat);
  belt.position.y = 0.24;
  belt.rotation.x = Math.PI / 2;
  group.add(belt);

  return group;
}

// ══════════════════════════════════════════════════════════════
// ██  ENVIRONMENT PROPS  ██
// ══════════════════════════════════════════════════════════════

function createPottedPlant(height: number): THREE.Group {
  const plant = new THREE.Group();
  const potMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3c, roughness: 0.75, metalness: 0.05 });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.5, 14), potMat);
  pot.position.y = 0.25;
  pot.castShadow = true;
  plant.add(pot);

  // Pot rim
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.025, 6, 14),
    potMat
  );
  rim.position.y = 0.5;
  rim.rotation.x = Math.PI / 2;
  plant.add(rim);

  // Soil
  const soil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.06, 14),
    new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 1 })
  );
  soil.position.y = 0.52;
  plant.add(soil);

  // Trunk
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.055, height * 0.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 })
  );
  trunk.position.y = 0.55 + (height * 0.4) / 2;
  plant.add(trunk);

  // Rich leaf clusters
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.65 });
  const darkLeafMat = new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.7 });
  const leafCount = 7 + Math.floor(Math.random() * 5);
  for (let i = 0; i < leafCount; i++) {
    const mat = Math.random() > 0.5 ? leafMat : darkLeafMat;
    const leafSize = 0.12 + Math.random() * 0.22;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(leafSize, 8, 6), mat);
    const angle = (i / leafCount) * Math.PI * 2;
    const radius = 0.12 + Math.random() * 0.18;
    leaf.position.set(
      Math.cos(angle) * radius,
      0.55 + height * 0.4 + Math.random() * 0.35,
      Math.sin(angle) * radius
    );
    leaf.scale.y = 0.65;
    plant.add(leaf);
  }

  return plant;
}

function createSideTable(): THREE.Group {
  const table = new THREE.Group();
  const legMat = new THREE.MeshStandardMaterial({ color: 0x78716c, metalness: 0.85, roughness: 0.15 });

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.6, 0.06, 24),
    new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.2, metalness: 0.15 })
  );
  top.position.y = 0.65;
  top.castShadow = true;
  top.receiveShadow = true;
  table.add(top);

  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.63, 8), legMat);
  leg.position.y = 0.32;
  table.add(leg);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.03, 16), legMat);
  base.position.y = 0.015;
  table.add(base);

  // Magazines
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

  // Small tablet device on table
  const tablet = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.01, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.3 })
  );
  tablet.position.set(0.2, 0.70, 0.15);
  tablet.rotation.y = 0.4;
  table.add(tablet);
  const tabletScreen = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.002, 0.09),
    new THREE.MeshStandardMaterial({ color: 0x0c4a6e, emissive: 0x0ea5e9, emissiveIntensity: 0.3 })
  );
  tabletScreen.position.set(0.2, 0.706, 0.15);
  tabletScreen.rotation.y = 0.4;
  table.add(tabletScreen);

  return table;
}

function createWaterCooler(): THREE.Group {
  const cooler = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.25, metalness: 0.15 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.3, 0.45), bodyMat);
  body.position.y = 0.65;
  body.castShadow = true;
  cooler.add(body);

  // Water bottle (translucent)
  const bottleMat = new THREE.MeshPhysicalMaterial({
    color: 0x0ea5e9,
    transparent: true,
    opacity: 0.35,
    roughness: 0.05,
    metalness: 0.05,
    transmission: 0.4,
    thickness: 0.5,
  });
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.6, 14), bottleMat);
  bottle.position.y = 1.6;
  cooler.add(bottle);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.15, 0.04, 14),
    new THREE.MeshStandardMaterial({ color: 0x1e293b })
  );
  cap.position.y = 1.31;
  cooler.add(cap);

  // Spigots (hot/cold)
  const spigotHot = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.05, 0.10),
    new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.5, roughness: 0.3 })
  );
  spigotHot.position.set(-0.08, 0.85, 0.28);
  cooler.add(spigotHot);

  const spigotCold = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.05, 0.10),
    new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.5, roughness: 0.3 })
  );
  spigotCold.position.set(0.08, 0.85, 0.28);
  cooler.add(spigotCold);

  // Drip tray
  const tray = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.03, 0.15),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6 })
  );
  tray.position.set(0, 0.55, 0.28);
  cooler.add(tray);

  // Power indicator LED
  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.012, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 1.5 })
  );
  led.position.set(0, 0.95, 0.235);
  cooler.add(led);

  return cooler;
}

function createWallClock(): THREE.Group {
  const clock = new THREE.Group();

  // Body
  const face = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 0.08, 32),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 })
  );
  face.rotation.x = Math.PI / 2;
  clock.add(face);

  // Rim
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.04, 10, 32),
    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.15 })
  );
  clock.add(rim);

  // Hour marks
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const isMainMark = i % 3 === 0;
    const mark = new THREE.Mesh(
      new THREE.BoxGeometry(isMainMark ? 0.03 : 0.015, isMainMark ? 0.10 : 0.06, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x0f172a })
    );
    mark.position.set(Math.sin(angle) * 0.40, Math.cos(angle) * 0.40, 0.05);
    mark.rotation.z = -angle;
    clock.add(mark);
  }

  // Minute marks
  for (let i = 0; i < 60; i++) {
    if (i % 5 === 0) continue;
    const angle = (i / 60) * Math.PI * 2;
    const mark = new THREE.Mesh(
      new THREE.BoxGeometry(0.008, 0.03, 0.01),
      new THREE.MeshStandardMaterial({ color: 0x64748b })
    );
    mark.position.set(Math.sin(angle) * 0.42, Math.cos(angle) * 0.42, 0.05);
    mark.rotation.z = -angle;
    clock.add(mark);
  }

  // Hour hand (on pivot)
  const hourPivot = new THREE.Group();
  hourPivot.position.z = 0.055;
  const hourHand = new THREE.Mesh(
    new THREE.BoxGeometry(0.028, 0.24, 0.012),
    new THREE.MeshStandardMaterial({ color: 0x0f172a })
  );
  hourHand.position.y = 0.10;
  hourPivot.add(hourHand);
  clock.add(hourPivot);

  // Minute hand (on pivot)
  const minPivot = new THREE.Group();
  minPivot.position.z = 0.06;
  const minHand = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.34, 0.01),
    new THREE.MeshStandardMaterial({ color: 0x334155 })
  );
  minHand.position.y = 0.15;
  minPivot.add(minHand);
  clock.add(minPivot);

  // Second hand (on pivot, red)
  const secPivot = new THREE.Group();
  secPivot.position.z = 0.065;
  const secHand = new THREE.Mesh(
    new THREE.BoxGeometry(0.008, 0.38, 0.006),
    new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.3 })
  );
  secHand.position.y = 0.14;
  secPivot.add(secHand);
  // Counterweight
  const counterweight = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.08, 0.006),
    new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.3 })
  );
  counterweight.position.y = -0.04;
  secPivot.add(counterweight);
  clock.add(secPivot);

  // Center pin
  const pin = new THREE.Mesh(
    new THREE.SphereGeometry(0.022, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.6 })
  );
  pin.position.z = 0.07;
  clock.add(pin);

  // Store pivots for animation
  clock.userData.hourPivot = hourPivot;
  clock.userData.minPivot = minPivot;
  clock.userData.secPivot = secPivot;

  return clock;
}

// ── Enhanced dust particles ──
function createDustParticles(count: number): THREE.Points {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const opacities = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 35;
    positions[i * 3 + 1] = Math.random() * 12 + 0.5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 28;
    sizes[i] = Math.random() * 0.05 + 0.01;
    opacities[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.PointsMaterial({
    color: 0xa0aab8,
    size: 0.04,
    transparent: true,
    opacity: 0.30,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geo, mat);
}

// ── Realistic chair with fabric materials ──
function createChair(isUserSeat: boolean, isServingSeat: boolean): THREE.Group {
  const chairGroup = new THREE.Group();

  const cushionColor = isUserSeat ? 0x0284c7 : isServingSeat ? 0x0d9488 : 0x1e293b;
  const cushionEmissive = isUserSeat ? 0x38bdf8 : isServingSeat ? 0x2dd4bf : 0x000000;
  const cushionEmissiveI = isUserSeat ? 0.5 : isServingSeat ? 0.4 : 0;

  const cushionMat = new THREE.MeshStandardMaterial({
    color: cushionColor,
    roughness: 0.65,
    metalness: 0.02,
    emissive: cushionEmissive,
    emissiveIntensity: cushionEmissiveI,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    metalness: 0.92,
    roughness: 0.08,
  });

  // Seat cushion
  const cushion = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 1.1), cushionMat);
  cushion.position.y = 0.85;
  cushion.castShadow = true;
  cushion.receiveShadow = true;
  chairGroup.add(cushion);

  // Cushion piping (edge detail)
  const pipingMat = new THREE.MeshStandardMaterial({ color: cushionColor, roughness: 0.5, metalness: 0.05 });
  const pipingFront = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.18, 6), pipingMat);
  pipingFront.rotation.z = Math.PI / 2;
  pipingFront.position.set(0, 0.96, 0.54);
  chairGroup.add(pipingFront);

  // Back cushion
  const backCushion = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 0.18), cushionMat);
  backCushion.position.set(0, 1.44, -0.48);
  backCushion.castShadow = true;
  chairGroup.add(backCushion);

  // Back frame uprights
  const backL = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.35, 8), frameMat);
  backL.position.set(-0.52, 1.1, -0.52);
  chairGroup.add(backL);
  const backR = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.35, 8), frameMat);
  backR.position.set(0.52, 1.1, -0.52);
  chairGroup.add(backR);

  // 4 legs
  const legPositions = [[-0.52, 0.38, 0.45], [0.52, 0.38, 0.45], [-0.52, 0.38, -0.45], [0.52, 0.38, -0.45]];
  for (const p of legPositions) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.74, 8), frameMat);
    leg.position.set(p[0], p[1], p[2]);
    leg.castShadow = true;
    chairGroup.add(leg);
    // Rubber foot
    const foot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 0.025, 8),
      new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 1 })
    );
    foot.position.set(p[0], 0.013, p[2]);
    chairGroup.add(foot);
  }

  // Armrests
  const armrestMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.25 });
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.035, 0.7), armrestMat);
  armL.position.set(-0.6, 1.12, 0);
  chairGroup.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.035, 0.7), armrestMat);
  armR.position.set(0.6, 1.12, 0);
  chairGroup.add(armR);

  // Armrest pads (soft top)
  const padMat = new THREE.MeshStandardMaterial({ color: 0x3d4654, roughness: 0.7 });
  const padL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.015, 0.5), padMat);
  padL.position.set(-0.6, 1.14, 0.05);
  chairGroup.add(padL);
  const padR = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.015, 0.5), padMat);
  padR.position.set(0.6, 1.14, 0.05);
  chairGroup.add(padR);

  // Armrest supports
  const armSuppL = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.38, 8), frameMat);
  armSuppL.position.set(-0.6, 0.93, 0.2);
  chairGroup.add(armSuppL);
  const armSuppR = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.38, 8), frameMat);
  armSuppR.position.set(0.6, 0.93, 0.2);
  chairGroup.add(armSuppR);

  // Seat frame crossbar
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.025, 0.035), frameMat);
  crossbar.position.set(0, 0.74, 0);
  chairGroup.add(crossbar);

  // Side crossbar
  const sidebar = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.8), frameMat);
  sidebar.position.set(0, 0.35, 0);
  chairGroup.add(sidebar);

  return chairGroup;
}

// ── Window with blinds ──
function createWindow(): THREE.Group {
  const win = new THREE.Group();

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

  // Glass pane (MeshPhysicalMaterial for realistic glass)
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(3.3, 3.9),
    new THREE.MeshPhysicalMaterial({
      color: 0x88aacc,
      transparent: true,
      opacity: 0.18,
      roughness: 0.02,
      metalness: 0.1,
      transmission: 0.6,
      thickness: 0.2,
      side: THREE.DoubleSide,
    })
  );
  glass.position.z = -0.03;
  win.add(glass);

  // Horizontal blinds
  const blindMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.5 });
  for (let i = 0; i < 12; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.025, 0.12), blindMat);
    slat.position.set(0, 1.7 - i * 0.32, 0.06);
    slat.rotation.x = 0.15;
    win.add(slat);
  }

  // Window sill
  const sill = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.06, 0.25),
    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.3, roughness: 0.4 })
  );
  sill.position.set(0, -2.06, 0.1);
  win.add(sill);

  return win;
}

// ── Enhanced ceiling light fixture ──
function createCeilingLight(): THREE.Group {
  const fixture = new THREE.Group();
  const housingMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.35, roughness: 0.35 });

  const housing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.5), housingMat);
  fixture.add(housing);

  // Light diffuser panel (emissive glow)
  const diffuser = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.025, 0.42),
    new THREE.MeshStandardMaterial({
      color: 0xe8edf5,
      emissive: 0xe8edf5,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.92,
    })
  );
  diffuser.position.y = -0.04;
  fixture.add(diffuser);

  // Edge trim
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.5, roughness: 0.3 });
  const trimL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.44), trimMat);
  trimL.position.set(-0.76, -0.02, 0);
  fixture.add(trimL);
  const trimR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.44), trimMat);
  trimR.position.set(0.76, -0.02, 0);
  fixture.add(trimR);

  return fixture;
}

// ══════════════════════════════════════════════════════════════
// ██  NEW PROPS  ██
// ══════════════════════════════════════════════════════════════

function createVendingMachine(): THREE.Group {
  const vm = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.25, metalness: 0.75 });

  // Main body
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.4, 0.9), bodyMat);
  body.position.y = 1.2;
  body.castShadow = true;
  vm.add(body);

  // Glass front panel
  const glassFront = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 1.5, 0.05),
    new THREE.MeshPhysicalMaterial({
      color: 0x0c1a2e,
      transparent: true,
      opacity: 0.5,
      roughness: 0.05,
      metalness: 0.2,
      transmission: 0.3,
      thickness: 0.2,
    })
  );
  glassFront.position.set(0, 1.55, 0.43);
  vm.add(glassFront);

  // Product rows (colored cans/bottles)
  const productColors = [0xef4444, 0x3b82f6, 0x22c55e, 0xf59e0b];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      const product = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 0.14, 8),
        new THREE.MeshStandardMaterial({
          color: productColors[row],
          roughness: 0.35,
          metalness: 0.4,
        })
      );
      product.position.set(-0.22 + col * 0.22, 2.05 - row * 0.32, 0.18);
      vm.add(product);
    }
  }

  // Selection panel
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.35, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.2 })
  );
  panel.position.set(0, 0.50, 0.43);
  vm.add(panel);

  // Selection buttons
  for (let i = 0; i < 4; i++) {
    const btn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.02, 8),
      new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6, roughness: 0.3 })
    );
    btn.rotation.x = Math.PI / 2;
    btn.position.set(-0.25 + i * 0.17, 0.50, 0.46);
    vm.add(btn);
  }

  // Dispensing slot
  const slot = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.28, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x0a0e18, roughness: 0.9 })
  );
  slot.position.set(0, 0.18, 0.40);
  vm.add(slot);

  // Brand light strip at top (glowing)
  const brandStrip = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.12, 0.05),
    new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.9,
    })
  );
  brandStrip.position.set(0, 2.36, 0.43);
  vm.add(brandStrip);

  // Side ventilation grilles
  const grilleMat = new THREE.MeshStandardMaterial({ color: 0x1a2535, roughness: 0.6, metalness: 0.4 });
  for (let g = 0; g < 5; g++) {
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.6), grilleMat);
    grille.position.set(0.61, 0.3 + g * 0.08, 0);
    vm.add(grille);
  }

  return vm;
}

function createSanitizerStation(): THREE.Group {
  const station = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.8, roughness: 0.2 });

  // Base
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 18), poleMat);
  base.position.y = 0.02;
  station.add(base);

  // Anti-slip ring
  const antiSlip = new THREE.Mesh(
    new THREE.TorusGeometry(0.25, 0.008, 4, 18),
    new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 })
  );
  antiSlip.position.y = 0.04;
  antiSlip.rotation.x = Math.PI / 2;
  station.add(antiSlip);

  // Pole
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.25, 10), poleMat);
  pole.position.y = 0.65;
  station.add(pole);

  // Dispenser unit
  const dispenserMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.1 });
  const dispenser = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.10), dispenserMat);
  dispenser.position.y = 1.32;
  station.add(dispenser);

  // Nozzle
  const nozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.016, 0.05, 8),
    poleMat
  );
  nozzle.position.set(0, 1.18, 0.05);
  station.add(nozzle);

  // Drip tray
  const dripTray = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.01, 0.10),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.5 })
  );
  dripTray.position.set(0, 1.14, 0.05);
  station.add(dripTray);

  // Green indicator LED
  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.01, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 2.0 })
  );
  led.position.set(0, 1.42, 0.06);
  station.add(led);

  // Small label
  const label = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.05, 0.005),
    new THREE.MeshStandardMaterial({ color: 0x0ea5e9, emissive: 0x0ea5e9, emissiveIntensity: 0.25 })
  );
  label.position.set(0, 1.36, 0.055);
  station.add(label);

  return station;
}

function createVolumetricShaft(): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(0.4, 3.5, 13, 14, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xfff5e0,
    transparent: true,
    opacity: 0.012,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Mesh(geo, mat);
}

function createFloorSign(): THREE.Group {
  const sign = new THREE.Group();
  const signMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.5, metalness: 0.1 });

  // Panel A
  const panelA = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.02), signMat);
  panelA.position.set(0, 0.48, 0.09);
  panelA.rotation.x = -0.12;
  sign.add(panelA);

  // Panel B
  const panelB = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.02), signMat);
  panelB.position.set(0, 0.48, -0.09);
  panelB.rotation.x = 0.12;
  sign.add(panelB);

  // Top connector
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.035, 0.22), signMat);
  top.position.y = 0.85;
  sign.add(top);

  // Caution stripe (dark stripes on yellow)
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
  for (let s = 0; s < 3; s++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.53, 0.04, 0.005), stripeMat);
    stripe.position.set(0, 0.25 + s * 0.22, 0.10);
    stripe.rotation.x = -0.12;
    sign.add(stripe);
  }

  return sign;
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
  const composerRef = useRef<EffectComposer | null>(null);
  const emergencyLightRef = useRef<THREE.PointLight | null>(null);
  const dustRef = useRef<THREE.Points | null>(null);
  const clockRef = useRef<THREE.Group | null>(null);
  const tvScanRef = useRef<THREE.Mesh | null>(null);

  const [badges, setBadges] = useState<
    Array<{ id: string; label: string; x: number; y: number; isUser: boolean; isServing: boolean; visible: boolean }>
  >([]);
  const seatPositionsRef = useRef<PatientSeatData[]>([]);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Track all GSAP tweens for cleanup
    const tweens: gsap.core.Tween[] = [];

    // ━━━━━ SCENE ━━━━━
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#03050b');
    scene.fog = new THREE.FogExp2('#050810', 0.016);

    // ━━━━━ CAMERA ━━━━━
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 120);
    camera.position.set(0, 11, 24);
    camera.lookAt(0, 2, -2);
    cameraRef.current = camera;

    // ━━━━━ RENDERER ━━━━━
    const renderer = new THREE.WebGLRenderer({
      antialias: false, // SMAA handles anti-aliasing
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ━━━━━ POST-PROCESSING PIPELINE ━━━━━
    const composer = new EffectComposer(renderer);

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Bloom — makes emissive signs, screens, and lights glow
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.5,   // strength
      0.4,   // radius
      0.75   // threshold — only bright elements bloom
    );
    composer.addPass(bloomPass);

    // SMAA — high quality anti-aliasing
    const pixelRatio = renderer.getPixelRatio();
    const smaaPass = new SMAAPass(width * pixelRatio, height * pixelRatio);
    composer.addPass(smaaPass);

    // Output — handles tone mapping and color space
    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    composerRef.current = composer;

    // ━━━━━ ENVIRONMENT MAP (for realistic reflections) ━━━━━
    const pmremGen = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color('#0a1020');
    const envSphere = new THREE.Mesh(
      new THREE.SphereGeometry(50, 32, 16),
      new THREE.MeshBasicMaterial({ color: '#0c1628', side: THREE.BackSide })
    );
    envScene.add(envSphere);
    const eL1 = new THREE.PointLight('#38bdf8', 8);
    eL1.position.set(15, 15, 15);
    envScene.add(eL1);
    const eL2 = new THREE.PointLight('#fbbf24', 4);
    eL2.position.set(-15, 10, -10);
    envScene.add(eL2);
    const eL3 = new THREE.PointLight('#e2e8f0', 6);
    eL3.position.set(0, 20, 0);
    envScene.add(eL3);
    const envTexture = pmremGen.fromScene(envScene, 0.04).texture;
    scene.environment = envTexture;
    pmremGen.dispose();

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

    // Secondary fill
    const fillLight = new THREE.DirectionalLight('#94a3b8', 0.8);
    fillLight.position.set(-10, 14, -5);
    scene.add(fillLight);

    // Ceiling light point sources
    const ceilingLightPositions = [
      [-6, 13.5, -4], [0, 13.5, -4], [6, 13.5, -4],
      [-6, 13.5, 3], [0, 13.5, 3], [6, 13.5, 3],
    ];
    for (const pos of ceilingLightPositions) {
      const cl = new THREE.PointLight('#e2e8f0', 1.2, 18, 1.5);
      cl.position.set(pos[0], pos[1], pos[2]);
      scene.add(cl);
    }

    // Doctor room accent (cool blue)
    const docSpot = new THREE.SpotLight('#38bdf8', 4, 22, Math.PI / 4, 0.6, 1.2);
    docSpot.position.set(-10, 12, -8);
    docSpot.target.position.set(-10, 0, -12);
    docSpot.castShadow = true;
    scene.add(docSpot);
    scene.add(docSpot.target);

    // Emergency light
    const erLight = new THREE.PointLight('#ff2a5f', 0, 30, 1.5);
    erLight.position.set(10, 8, -10);
    scene.add(erLight);
    emergencyLightRef.current = erLight;

    // Warm sconce accent
    const sconceLight = new THREE.PointLight('#fbbf24', 0.6, 12, 2);
    sconceLight.position.set(0, 10, -14);
    scene.add(sconceLight);

    // Vending machine accent glow
    const vmLight = new THREE.PointLight('#0ea5e9', 0.4, 6, 2);
    vmLight.position.set(-15, 3, 2);
    scene.add(vmLight);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ARCHITECTURE
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const roomWidth = 36;
    const roomDepth = 32;
    const roomHeight = 14;

    // ── FLOOR (PBR with clearcoat) ──
    const floorTex = createFloorTexture();
    const floorRoughMap = createFloorRoughnessMap();
    const floorMat = new THREE.MeshPhysicalMaterial({
      map: floorTex,
      roughnessMap: floorRoughMap,
      roughness: 0.15,
      metalness: 0.0,
      clearcoat: 0.8,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.5,
      reflectivity: 0.9,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomDepth), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // ── WALLS ──
    const wallTex = createWallTexture();
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.7, metalness: 0.05 });

    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomHeight), wallMat);
    backWall.position.set(0, roomHeight / 2, -roomDepth / 2);
    backWall.receiveShadow = true;
    scene.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(roomDepth, roomHeight), wallMat);
    leftWall.position.set(-roomWidth / 2, roomHeight / 2, 0);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(roomDepth, roomHeight), wallMat);
    rightWall.position.set(roomWidth / 2, roomHeight / 2, 0);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.receiveShadow = true;
    scene.add(rightWall);

    // ── WAINSCOTING / DADO RAIL ──
    const wainscotMat = new THREE.MeshStandardMaterial({ color: 0x0c1220, roughness: 0.4, metalness: 0.15 });
    const dadoRailMat = new THREE.MeshStandardMaterial({ color: 0x1e3050, metalness: 0.3, roughness: 0.3 });

    // Back wall wainscoting
    const wBack = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, 3), wainscotMat);
    wBack.position.set(0, 1.5, -roomDepth / 2 + 0.01);
    scene.add(wBack);
    const drBack = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, 0.08, 0.06), dadoRailMat);
    drBack.position.set(0, 3.04, -roomDepth / 2 + 0.03);
    scene.add(drBack);

    // Left wall wainscoting
    const wLeft = new THREE.Mesh(new THREE.PlaneGeometry(roomDepth, 3), wainscotMat);
    wLeft.position.set(-roomWidth / 2 + 0.01, 1.5, 0);
    wLeft.rotation.y = Math.PI / 2;
    scene.add(wLeft);
    const drLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, roomDepth), dadoRailMat);
    drLeft.position.set(-roomWidth / 2 + 0.03, 3.04, 0);
    scene.add(drLeft);

    // Right wall wainscoting
    const wRight = new THREE.Mesh(new THREE.PlaneGeometry(roomDepth, 3), wainscotMat);
    wRight.position.set(roomWidth / 2 - 0.01, 1.5, 0);
    wRight.rotation.y = -Math.PI / 2;
    scene.add(wRight);
    const drRight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, roomDepth), dadoRailMat);
    drRight.position.set(roomWidth / 2 - 0.03, 3.04, 0);
    scene.add(drRight);

    // ── CEILING ──
    const ceilTex = createCeilingTexture();
    const ceilMat = new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.8, metalness: 0.05 });
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomDepth), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = roomHeight;
    scene.add(ceiling);

    // ── CEILING T-BAR GRID ──
    const tbarMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.55, roughness: 0.3 });
    const tbarSpacing = 4.5;
    for (let x = -roomWidth / 2 + tbarSpacing; x < roomWidth / 2; x += tbarSpacing) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, roomDepth), tbarMat);
      bar.position.set(x, roomHeight - 0.035, 0);
      scene.add(bar);
    }
    for (let z = -roomDepth / 2 + tbarSpacing; z < roomDepth / 2; z += tbarSpacing) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, 0.07, 0.04), tbarMat);
      bar.position.set(0, roomHeight - 0.035, z);
      scene.add(bar);
    }

    // ── BASEBOARDS ──
    const baseboardMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.2 });
    const bbH = 0.25;
    const bbBack = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, bbH, 0.06), baseboardMat);
    bbBack.position.set(0, bbH / 2, -roomDepth / 2 + 0.03);
    scene.add(bbBack);
    const bbLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, bbH, roomDepth), baseboardMat);
    bbLeft.position.set(-roomWidth / 2 + 0.03, bbH / 2, 0);
    scene.add(bbLeft);
    const bbRight = new THREE.Mesh(new THREE.BoxGeometry(0.06, bbH, roomDepth), baseboardMat);
    bbRight.position.set(roomWidth / 2 - 0.03, bbH / 2, 0);
    scene.add(bbRight);

    // ── CROWN MOLDING ──
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

    // ── WINDOWS + OUTDOOR SCENERY + VOLUMETRIC LIGHT SHAFTS ──
    for (let i = 0; i < 2; i++) {
      const win = createWindow();
      win.position.set(-roomWidth / 2 + 0.1, 6, -4 + i * 10);
      win.rotation.y = Math.PI / 2;
      scene.add(win);

      // Outdoor scenery behind each window
      const scenery = createOutdoorScenery();
      scenery.position.set(-roomWidth / 2 - 1.5, 6, -4 + i * 10);
      scenery.rotation.y = Math.PI / 2;
      scene.add(scenery);

      // Volumetric light shaft from window
      const shaft = createVolumetricShaft();
      shaft.position.set(-roomWidth / 2 + 5, 6, -4 + i * 10);
      shaft.rotation.z = -0.45; // angled into room
      shaft.rotation.y = Math.PI / 4;
      scene.add(shaft);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // DOCTOR CONSULTATION ROOM
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const doctorGroup = new THREE.Group();
    doctorGroup.position.set(-9, 0, -12);

    const deskMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.25, metalness: 0.1 });
    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(5, 0.1, 2.2), deskMat);
    deskTop.position.set(0, 2.1, 0);
    deskTop.castShadow = true;
    deskTop.receiveShadow = true;
    doctorGroup.add(deskTop);

    const deskFront = new THREE.Mesh(new THREE.BoxGeometry(5, 2.1, 0.08), deskMat);
    deskFront.position.set(0, 1.05, 1.1);
    deskFront.castShadow = true;
    doctorGroup.add(deskFront);

    const deskSide = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.1, 2.2), deskMat);
    deskSide.position.set(2.5, 1.05, 0);
    doctorGroup.add(deskSide);

    // Monitor
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

    const bezel = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.0, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x1e293b })
    );
    bezel.position.set(-0.5, 2.85, -0.33);
    doctorGroup.add(bezel);

    // Keyboard & Mouse
    const keyboard = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.03, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 })
    );
    keyboard.position.set(-0.5, 2.12, 0.3);
    doctorGroup.add(keyboard);

    const mouse = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.02, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 })
    );
    mouse.position.set(0.15, 2.12, 0.3);
    doctorGroup.add(mouse);

    // Pen holder
    const penHolder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.05, 0.12, 8),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.4 })
    );
    penHolder.position.set(0.8, 2.16, -0.2);
    doctorGroup.add(penHolder);

    // Pens in holder
    for (let p = 0; p < 3; p++) {
      const pen = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005, 0.005, 0.14, 4),
        new THREE.MeshStandardMaterial({ color: [0x1e40af, 0x0f172a, 0xef4444][p] })
      );
      pen.position.set(0.78 + p * 0.015, 2.26, -0.2 + (p - 1) * 0.01);
      pen.rotation.z = (p - 1) * 0.08;
      doctorGroup.add(pen);
    }

    // Glass Door
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.1 });

    const opdDoorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 7, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.3 })
    );
    opdDoorFrame.position.set(0, 3.5, -3);
    doctorGroup.add(opdDoorFrame);

    const opdGlass = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 6.6, 0.06),
      new THREE.MeshPhysicalMaterial({
        color: 0x164e63,
        emissive: 0x0284c7,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.35,
        roughness: 0.03,
        transmission: 0.4,
        thickness: 0.3,
      })
    );
    opdGlass.position.set(0, 3.5, -2.9);
    doctorGroup.add(opdGlass);

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.08), handleMat);
    handle.position.set(1.2, 3.2, -2.82);
    doctorGroup.add(handle);

    // OPD Sign
    const opdSign = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 0.9, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x0c4a6e, emissive: 0x38bdf8, emissiveIntensity: 0.8, roughness: 0.3 })
    );
    opdSign.position.set(0, 7.3, -2.8);
    doctorGroup.add(opdSign);

    scene.add(doctorGroup);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // EMERGENCY ROOM
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const erGroup = new THREE.Group();
    erGroup.position.set(9, 0, -12);

    const erDoorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 7, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x450a0a, metalness: 0.2 })
    );
    erDoorFrame.position.set(0, 3.5, -3);
    erGroup.add(erDoorFrame);

    const erDoorMatOpts = { color: 0x7f1d1d, emissive: 0xef4444, emissiveIntensity: 0.5, roughness: 0.4 };
    const erDoorL = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 6.6, 0.08),
      new THREE.MeshStandardMaterial(erDoorMatOpts)
    );
    erDoorL.position.set(-1.1, 3.5, -2.88);
    erGroup.add(erDoorL);

    const erDoorR = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 6.6, 0.08),
      new THREE.MeshStandardMaterial(erDoorMatOpts)
    );
    erDoorR.position.set(1.1, 3.5, -2.88);
    erGroup.add(erDoorR);

    // Window portals
    const portalGlass = new THREE.MeshPhysicalMaterial({
      color: 0x991b1b,
      emissive: 0xef4444,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.35,
      transmission: 0.2,
    });
    const portalL = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), portalGlass);
    portalL.position.set(-1.1, 4.5, -2.83);
    erGroup.add(portalL);
    const portalR = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), portalGlass);
    portalR.position.set(1.1, 4.5, -2.83);
    erGroup.add(portalR);

    // Handles
    const erHandleL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 0.08), handleMat);
    erHandleL.position.set(-0.3, 3.2, -2.82);
    erGroup.add(erHandleL);
    const erHandleR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 0.08), handleMat);
    erHandleR.position.set(0.3, 3.2, -2.82);
    erGroup.add(erHandleR);

    // ER Sign
    const erSign = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 0.9, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x7f1d1d, emissive: 0xf43f5e, emissiveIntensity: 1.0, roughness: 0.3 })
    );
    erSign.position.set(0, 7.3, -2.8);
    erGroup.add(erSign);

    // Red cross
    const crossMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.4 });
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.02), crossMat);
    crossV.position.set(-2, 7.3, -2.72);
    erGroup.add(crossV);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.02), crossMat);
    crossH.position.set(-2, 7.3, -2.72);
    erGroup.add(crossH);

    scene.add(erGroup);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TV DISPLAY WITH SCAN LINE
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const tvGroup = new THREE.Group();
    tvGroup.position.set(0, 9.5, -12);

    const tvBody = new THREE.Mesh(
      new THREE.BoxGeometry(8, 4, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.15, metalness: 0.3 })
    );
    tvGroup.add(tvBody);

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

    // TV scan line effect
    const tvScanLine = new THREE.Mesh(
      new THREE.PlaneGeometry(7.6, 0.04),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.025,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    tvScanLine.position.z = 0.16;
    tvGroup.add(tvScanLine);
    tvScanRef.current = tvScanLine;

    // TV bezels
    const tvBezelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
    const tvBezelT = new THREE.Mesh(new THREE.BoxGeometry(8, 0.08, 0.28), tvBezelMat);
    tvBezelT.position.y = 2;
    tvGroup.add(tvBezelT);
    const tvBezelB = new THREE.Mesh(new THREE.BoxGeometry(8, 0.12, 0.28), tvBezelMat);
    tvBezelB.position.y = -2;
    tvGroup.add(tvBezelB);

    // Mounting brackets
    const bracketMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.15 });
    const bracket1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.5, 8), bracketMat);
    bracket1.position.set(-2.5, 4.2, 0);
    tvGroup.add(bracket1);
    const bracket2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.5, 8), bracketMat);
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

    // Extra plant near reception
    const plant5 = createPottedPlant(1.1);
    plant5.position.set(9, 0, 10);
    scene.add(plant5);

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

    // Wall Clock
    const wallClock = createWallClock();
    wallClock.position.set(0, 11, -15.7);
    scene.add(wallClock);
    clockRef.current = wallClock;

    // ── NEW: Vending Machine ──
    const vendingMachine = createVendingMachine();
    vendingMachine.position.set(-15, 0, 2);
    vendingMachine.rotation.y = Math.PI / 2;
    scene.add(vendingMachine);

    // ── NEW: Sanitizer Stations ──
    const sanitizer1 = createSanitizerStation();
    sanitizer1.position.set(-7, 0, -8);
    scene.add(sanitizer1);

    const sanitizer2 = createSanitizerStation();
    sanitizer2.position.set(7, 0, -8);
    scene.add(sanitizer2);

    // ── NEW: Floor Signs ──
    const floorSign1 = createFloorSign();
    floorSign1.position.set(-3, 0, -3);
    floorSign1.rotation.y = 0.3;
    scene.add(floorSign1);

    const floorSign2 = createFloorSign();
    floorSign2.position.set(3, 0, -3);
    floorSign2.rotation.y = -0.3;
    scene.add(floorSign2);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // RECEPTION / CHECK-IN COUNTER
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

    const rcScreen = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.8, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x334155, transparent: true, opacity: 0.6 })
    );
    rcScreen.position.set(0, 2.8, -0.5);
    receptionGroup.add(rcScreen);

    const rcSign = new THREE.Mesh(
      new THREE.BoxGeometry(3, 0.6, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x0369a1, emissive: 0x38bdf8, emissiveIntensity: 0.6 })
    );
    rcSign.position.set(0, 3.5, -0.8);
    receptionGroup.add(rcSign);

    // Desk phone
    const phone = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.06, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 })
    );
    phone.position.set(-1.2, 2.43, 0.2);
    receptionGroup.add(phone);
    const handset = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.03, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 })
    );
    handset.position.set(-1.15, 2.49, 0.2);
    handset.rotation.y = 0.1;
    receptionGroup.add(handset);

    scene.add(receptionGroup);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // DUST PARTICLES
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const dust = createDustParticles(800);
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

    const skinTones = [0xd4a574, 0xc68642, 0x8d5524, 0xf1c27d, 0xe0ac69, 0xa0522d, 0xdeb887, 0xcd853f];
    const shirtColors = [0x1e40af, 0x166534, 0x7c3aed, 0x0f766e, 0x9a3412, 0x1e3a5f, 0x4a2082, 0x1c4d3c, 0x6b21a8, 0x0e4a6f, 0x8b5e2b, 0x374151, 0x1e293b, 0x581c87, 0x064e3b];
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
            emissiveInt,
            idx,
            tweens
          );
          humanoid.position.set(x, 0.74, z);
          scene.add(humanoid);
        }

        // User seat highlight effects
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

          const outerRing = new THREE.Mesh(
            new THREE.RingGeometry(1.5, 2.0, 48),
            new THREE.MeshBasicMaterial({ color: 0x0ea5e9, side: THREE.DoubleSide, transparent: true, opacity: 0.2 })
          );
          outerRing.rotation.x = -Math.PI / 2;
          outerRing.position.set(x, 0.015, z);
          scene.add(outerRing);

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

          tweens.push(gsap.to(ring.scale, { x: 1.2, y: 1.2, duration: 1.5, repeat: -1, yoyo: true, ease: 'sine.inOut' }));
          tweens.push(gsap.to(outerRing.scale, { x: 1.15, y: 1.15, duration: 2, repeat: -1, yoyo: true, ease: 'sine.inOut' }));
        }

        // Badge position
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

      // TV sway
      tvGroup.position.y = 9.5 + Math.sin(elapsed * 0.8) * 0.06;

      // TV scan line
      if (tvScanRef.current) {
        tvScanRef.current.position.y = -1.8 + ((elapsed * 0.4) % 1) * 3.6;
      }

      // Animated wall clock
      if (clockRef.current) {
        const now = new Date();
        const h = now.getHours() % 12;
        const m = now.getMinutes();
        const s = now.getSeconds() + now.getMilliseconds() / 1000;
        const hourAngle = -(h / 12) * Math.PI * 2 - (m / 720) * Math.PI * 2;
        const minAngle = -(m / 60) * Math.PI * 2 - (s / 3600) * Math.PI * 2;
        const secAngle = -(s / 60) * Math.PI * 2;

        if (clockRef.current.userData.hourPivot) {
          clockRef.current.userData.hourPivot.rotation.z = hourAngle;
        }
        if (clockRef.current.userData.minPivot) {
          clockRef.current.userData.minPivot.rotation.z = minAngle;
        }
        if (clockRef.current.userData.secPivot) {
          clockRef.current.userData.secPivot.rotation.z = secAngle;
        }
      }

      // Dust particle drift
      if (dustRef.current) {
        const positions = dustRef.current.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < positions.length; i += 3) {
          positions[i] += Math.sin(elapsed * 0.3 + i) * 0.001;
          positions[i + 1] += Math.sin(elapsed * 0.5 + i * 0.7) * 0.0004;
          positions[i + 2] += Math.cos(elapsed * 0.4 + i * 0.5) * 0.0007;
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

      // Render through post-processing composer
      composer.render();
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
      if (composerRef.current) {
        composerRef.current.setSize(w, h);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      tweens.forEach(t => t.kill());
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
