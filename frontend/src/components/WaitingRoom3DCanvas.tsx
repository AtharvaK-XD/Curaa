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
// ██  ADVANCED PROCEDURAL PBR TEXTURES & NORMAL MAPS  ██
// ══════════════════════════════════════════════════════════════

// ── Dark polished marble floor tile texture with multi-layer veins ──
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
      const base = 13 + ((r + c) % 2) * 6 + Math.random() * 3;
      ctx.fillStyle = `rgb(${base}, ${base + 3}, ${base + 8})`;
      ctx.fillRect(c * tileSize, r * tileSize, tileSize, tileSize);

      // Fine primary veins
      for (let v = 0; v < 18; v++) {
        const vx = c * tileSize + Math.random() * tileSize;
        const vy = r * tileSize + Math.random() * tileSize;
        ctx.beginPath();
        ctx.moveTo(vx, vy);
        ctx.bezierCurveTo(
          vx + (Math.random() - 0.5) * 45, vy + Math.random() * 22,
          vx + (Math.random() - 0.5) * 65, vy + Math.random() * 32,
          vx + (Math.random() - 0.5) * 85, vy + Math.random() * 45
        );
        const vBright = 24 + Math.random() * 18;
        ctx.strokeStyle = `rgba(${vBright}, ${vBright + 4}, ${vBright + 10}, ${0.12 + Math.random() * 0.10})`;
        ctx.lineWidth = 0.4 + Math.random() * 1.1;
        ctx.stroke();
      }

      // Warm bronze/gold micro-veins
      for (let v = 0; v < 5; v++) {
        const vx = c * tileSize + Math.random() * tileSize;
        const vy = r * tileSize + Math.random() * tileSize;
        ctx.beginPath();
        ctx.moveTo(vx, vy);
        ctx.lineTo(vx + (Math.random() - 0.5) * 35, vy + Math.random() * 25);
        ctx.strokeStyle = `rgba(160, 130, 90, ${0.08 + Math.random() * 0.08})`;
        ctx.lineWidth = 0.5 + Math.random() * 0.5;
        ctx.stroke();
      }

      // Specular depth spots
      for (let s = 0; s < 5; s++) {
        const sx = c * tileSize + Math.random() * tileSize;
        const sy = r * tileSize + Math.random() * tileSize;
        ctx.fillStyle = `rgba(35, 45, 65, ${Math.random() * 0.08})`;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.random() * 12 + 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Deep grout channels
  ctx.strokeStyle = '#04060b';
  ctx.lineWidth = 4;
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

  // Micro-surface noise
  for (let i = 0; i < 10000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const bright = 10 + Math.random() * 25;
    ctx.fillStyle = `rgba(${bright}, ${bright + 3}, ${bright + 6}, ${Math.random() * 0.05})`;
    ctx.fillRect(x, y, 1, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── Floor normal map for realistic tile bevels & surface relief ──
function createFloorNormalMap(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgb(128, 128, 255)';
  ctx.fillRect(0, 0, size, size);

  const tileCount = 8;
  const tileSize = size / tileCount;

  // Grout indentations (beveled normal)
  ctx.lineWidth = 4;
  for (let i = 0; i <= tileCount; i++) {
    const pos = i * tileSize;
    ctx.strokeStyle = 'rgb(180, 128, 255)';
    ctx.beginPath();
    ctx.moveTo(0, pos - 1);
    ctx.lineTo(size, pos - 1);
    ctx.stroke();
    ctx.strokeStyle = 'rgb(70, 128, 255)';
    ctx.beginPath();
    ctx.moveTo(0, pos + 1);
    ctx.lineTo(size, pos + 1);
    ctx.stroke();

    ctx.strokeStyle = 'rgb(128, 180, 255)';
    ctx.beginPath();
    ctx.moveTo(pos - 1, 0);
    ctx.lineTo(pos - 1, size);
    ctx.stroke();
    ctx.strokeStyle = 'rgb(128, 70, 255)';
    ctx.beginPath();
    ctx.moveTo(pos + 1, 0);
    ctx.lineTo(pos + 1, size);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

// ── Floor roughness map: smooth tiles, rough grout ──
function createFloorRoughnessMap(): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#222222';
  ctx.fillRect(0, 0, size, size);

  const tileCount = 8;
  const tileSize = size / tileCount;

  ctx.strokeStyle = '#dddddd';
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

  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = `rgba(110, 110, 110, ${Math.random() * 0.08})`;
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

// ── Procedural Wood Grain Texture (for Side Tables & Baseboards) ──
function createWoodTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#3e2723';
  ctx.fillRect(0, 0, size, size);

  // Wood rings / lines
  for (let i = 0; i < 120; i++) {
    const y = i * (size / 120);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(30, 18, 14, 0.4)' : 'rgba(75, 48, 40, 0.3)';
    ctx.fillRect(0, y + (Math.sin(i * 0.1) * 3), size, 2.5);
  }

  // Fine fiber grain
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = `rgba(20, 12, 10, ${Math.random() * 0.15})`;
    ctx.fillRect(x, y, Math.random() * 12 + 2, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── Procedural Fabric Weave Normal Map (for Cushions & Clothes) ──
function createFabricNormalMap(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgb(128, 128, 255)';
  ctx.fillRect(0, 0, size, size);

  const step = 4;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      if ((x / step + y / step) % 2 === 0) {
        ctx.fillStyle = 'rgb(160, 110, 255)';
      } else {
        ctx.fillStyle = 'rgb(110, 160, 255)';
      }
      ctx.fillRect(x, y, step, step);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(12, 12);
  return tex;
}

// ── Enhanced plaster wall texture ──
function createWallTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0d1526';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 45; i++) {
    const y = Math.random() * size;
    const gradient = ctx.createLinearGradient(0, y - 15, 0, y + 15);
    gradient.addColorStop(0, 'rgba(16, 24, 45, 0)');
    gradient.addColorStop(0.5, `rgba(16, 24, 45, ${Math.random() * 0.16})`);
    gradient.addColorStop(1, 'rgba(16, 24, 45, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, y - 15, size, 30);
  }

  for (let i = 0; i < 10000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const brightness = Math.random() * 22 + 10;
    ctx.fillStyle = `rgba(${brightness}, ${brightness + 4}, ${brightness + 14}, 0.18)`;
    ctx.fillRect(x, y, 1.2, 1.2);
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
      ctx.fillStyle = '#090d18';
      ctx.fillRect(c * panelSize, r * panelSize, panelSize, panelSize);

      ctx.strokeStyle = '#182035';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(c * panelSize + 1, r * panelSize + 1, panelSize - 2, panelSize - 2);

      const dotSpacing = panelSize / 10;
      for (let dy = 1; dy < 10; dy++) {
        for (let dx = 1; dx < 10; dx++) {
          ctx.fillStyle = `rgba(5, 7, 13, ${0.45 + Math.random() * 0.35})`;
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

// ── Dynamic Live Queue TV Display Texture ──
function createDynamicTVTexture(
  servingToken: string,
  userToken: string,
  queuePos: number,
  tickerOffset: number
): THREE.CanvasTexture {
  const w = 1024, h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, '#041527');
  bgGrad.addColorStop(1, '#020b14');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#0284c7';
  ctx.fillRect(0, 0, w, 70);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('CURAA HEALTHCARE • OPD QUEUE MONITOR', 40, 48);

  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(w - 180, 36, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('LIVE SYSTEM', w - 155, 44);

  // Left Box: Now Serving
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(40, 100, 440, 320, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('NOW SERVING IN ROOM 12', 70, 145);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText(servingToken, 70, 245);

  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('STATUS: CONSULTATION IN PROGRESS', 70, 305);

  // Right Box: Your Queue Status
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = '#14b8a6';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(520, 100, 460, 320, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('YOUR TOKEN NUMBER', 550, 145);

  ctx.fillStyle = '#2dd4bf';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText(userToken, 550, 245);

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`PATIENTS AHEAD OF YOU: ${queuePos}`, 550, 305);

  // Bottom Ticker Bar
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 440, w, 72);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(0, 438, w, 3);

  const tickerMsg = "📢 Please keep noise levels low • Hand sanitizer stations available near all entrances • In case of emergency notify staff immediately • Wearing a mask is recommended inside OPD lounge • ";
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 22px monospace';
  const textX = 40 - (tickerOffset % 1200);
  ctx.fillText(tickerMsg + tickerMsg, textX, 482);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── Medical Hygiene Poster Textures ──
function createPosterTexture(type: 'hygiene' | 'guide' | 'emergency'): THREE.CanvasTexture {
  const w = 512, h = 768;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  if (type === 'hygiene') {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#0284c7';
    ctx.fillRect(0, 0, w, 110);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('PROTECT YOURSELF', 40, 55);
    ctx.font = '22px sans-serif';
    ctx.fillText('6-Step Hand Hygiene Guide', 40, 90);

    const steps = [
      '1. Wet hands with warm water',
      '2. Apply antibacterial soap',
      '3. Rub palms & back of hands',
      '4. Clean between fingers & thumbs',
      '5. Rinse thoroughly under tap',
      '6. Dry with clean paper towel'
    ];
    steps.forEach((step, i) => {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(30, 140 + i * 95, w - 60, 80);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(step, 50, 188 + i * 95);
    });
  } else if (type === 'guide') {
    ctx.fillStyle = '#0c1a2e';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#0d9488';
    ctx.fillRect(0, 0, w, 110);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('OPD PATIENT FLOW', 40, 55);
    ctx.font = '22px sans-serif';
    ctx.fillText('Digital Token & Queue System', 40, 90);

    const info = [
      '• Register at Check-In Counter',
      '• Track token on 3D spatial TV',
      '• Proceed when token is called',
      '• Virtual assistant alerts active',
      '• Pharmacy at Floor 1 Exit B'
    ];
    info.forEach((item, i) => {
      ctx.fillStyle = '#2dd4bf';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(item, 40, 180 + i * 100);
    });
  } else {
    ctx.fillStyle = '#2a080c';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 0, w, 110);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 38px sans-serif';
    ctx.fillText('EMERGENCY RESPONSE', 30, 60);

    ctx.fillStyle = '#fca5a5';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('TRAUMA BAY DIRECTIVE', 40, 180);

    ctx.fillStyle = '#ffffff';
    ctx.font = '22px sans-serif';
    ctx.fillText('Press Emergency Switch for Immediate', 40, 240);
    ctx.fillText('Medical Triage Dispatch.', 40, 275);

    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(40, 320, w - 80, 380);
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('CRITICAL TRIAGE 24/7', 60, 420);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ══════════════════════════════════════════════════════════════
// ██  OUTDOOR SCENERY (Window Backdrop) & LIGHT SHAFTS  ██
// ══════════════════════════════════════════════════════════════

function createOutdoorScenery(): THREE.Mesh {
  const w = 512, h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

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

  for (let i = 0; i < 60; i++) {
    const sx = Math.random() * w;
    const sy = Math.random() * h * 0.45;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + Math.random() * 0.55})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 0.4 + Math.random() * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  const buildings = [
    { x: 5, w: 38, h: 55 }, { x: 50, w: 28, h: 95 }, { x: 82, w: 42, h: 70 },
    { x: 130, w: 32, h: 125 }, { x: 168, w: 48, h: 50 }, { x: 222, w: 36, h: 88 },
    { x: 264, w: 52, h: 115 }, { x: 322, w: 28, h: 65 }, { x: 355, w: 42, h: 135 },
    { x: 402, w: 38, h: 80 }, { x: 445, w: 46, h: 60 }, { x: 495, w: 20, h: 100 },
  ];

  for (const b of buildings) {
    ctx.fillStyle = '#050a16';
    ctx.fillRect(b.x, h - b.h, b.w, b.h);

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

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(14, 7),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
  );
}

// ══════════════════════════════════════════════════════════════
// ██  ORGANIC HUMANOID FIGURE WITH FABRIC PBR MATERIALS  ██
// ══════════════════════════════════════════════════════════════

function createHumanoid(
  skinColor: number,
  shirtColor: number,
  pantsColor: number,
  isHighlight: boolean,
  fabricNormalMap: THREE.CanvasTexture,
  emissiveColor?: number,
  emissiveIntensity?: number,
  seatIndex?: number,
  tweens?: gsap.core.Tween[]
): THREE.Group {
  const group = new THREE.Group();
  const idx = seatIndex || 0;

  // Realistic Subsurface Physical Skin Material
  const skinMat = new THREE.MeshPhysicalMaterial({
    color: skinColor,
    roughness: 0.45,
    metalness: 0.01,
    clearcoat: 0.25,
    clearcoatRoughness: 0.3,
    reflectivity: 0.5,
    ...(isHighlight && emissiveColor ? { emissive: emissiveColor, emissiveIntensity: emissiveIntensity || 0.4 } : {}),
  });

  const shirtMat = new THREE.MeshStandardMaterial({
    color: shirtColor,
    normalMap: fabricNormalMap,
    normalScale: new THREE.Vector2(0.25, 0.25),
    roughness: 0.75,
    metalness: 0.02,
    ...(isHighlight && emissiveColor ? { emissive: emissiveColor, emissiveIntensity: (emissiveIntensity || 0.4) * 0.6 } : {}),
  });

  const pantsMat = new THREE.MeshStandardMaterial({
    color: pantsColor,
    normalMap: fabricNormalMap,
    normalScale: new THREE.Vector2(0.3, 0.3),
    roughness: 0.85,
  });

  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.35, metalness: 0.1 });
  const soleMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });

  const hairColors = [0x0a0a0a, 0x1a0a00, 0x2c1508, 0x0a0a0a, 0x3d2514, 0x100e0a, 0x1a0800, 0x0c0c0c];
  const hairMat = new THREE.MeshStandardMaterial({ color: hairColors[idx % hairColors.length], roughness: 0.85 });

  // Pelvis / Hips
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.22, 0.55), pantsMat);
  hips.position.y = 0.12;
  hips.castShadow = true;
  group.add(hips);

  // Thighs
  const thighL = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.55, 14), pantsMat);
  thighL.position.set(-0.16, 0.1, 0.28);
  thighL.rotation.x = Math.PI / 2;
  thighL.castShadow = true;
  group.add(thighL);

  const thighR = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.55, 14), pantsMat);
  thighR.position.set(0.16, 0.1, 0.28);
  thighR.rotation.x = Math.PI / 2;
  thighR.castShadow = true;
  group.add(thighR);

  // Knee Caps
  const kneeL = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), pantsMat);
  kneeL.position.set(-0.16, 0.08, 0.52);
  group.add(kneeL);

  const kneeR = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), pantsMat);
  kneeR.position.set(0.16, 0.08, 0.52);
  group.add(kneeR);

  // Shins
  const shinL = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.085, 0.52, 14), pantsMat);
  shinL.position.set(-0.16, -0.15, 0.52);
  shinL.castShadow = true;
  group.add(shinL);

  const shinR = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.085, 0.52, 14), pantsMat);
  shinR.position.set(0.16, -0.15, 0.52);
  shinR.castShadow = true;
  group.add(shinR);

  // Shoes Uppers & Soles
  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.26), shoeMat);
  shoeL.position.set(-0.16, -0.42, 0.56);
  shoeL.castShadow = true;
  group.add(shoeL);

  const soleL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.28), soleMat);
  soleL.position.set(-0.16, -0.46, 0.56);
  group.add(soleL);

  const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.26), shoeMat);
  shoeR.position.set(0.16, -0.42, 0.56);
  shoeR.castShadow = true;
  group.add(shoeR);

  const soleR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.28), soleMat);
  soleR.position.set(0.16, -0.46, 0.56);
  group.add(soleR);

  // Torso & Chest Contour
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
  const torso = new THREE.Mesh(new THREE.LatheGeometry(torsoProfile, 24), shirtMat);
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

  // Collar detail
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.11, 0.02, 8, 16),
    new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.6 })
  );
  collar.position.set(0, 0.92, 0);
  collar.rotation.x = Math.PI / 2;
  group.add(collar);

  // Neck & Head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 0.14, 14), skinMat);
  neck.position.y = 1.02;
  group.add(neck);

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
  const head = new THREE.Mesh(new THREE.LatheGeometry(headProfile, 24), skinMat);
  head.position.y = 1.28;
  head.castShadow = true;
  group.add(head);

  // Ears
  const earL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.06, 8), skinMat);
  earL.rotation.z = Math.PI / 2;
  earL.position.set(-0.19, 1.28, 0.02);
  group.add(earL);

  const earR = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.06, 8), skinMat);
  earR.rotation.z = -Math.PI / 2;
  earR.position.set(0.19, 1.28, 0.02);
  group.add(earR);

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

  // Facial features (eyes, eyebrows, nose, mouth, irises)
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3 });
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.3 });
  const irisMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.1 });
  const eyeGeo = new THREE.SphereGeometry(0.028, 8, 8);
  const eyeWhiteGeo = new THREE.SphereGeometry(0.022, 8, 8);

  const lEye = new THREE.Mesh(eyeGeo, eyeMat);
  lEye.position.set(-0.065, 1.29, 0.155);
  group.add(lEye);
  const lWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
  lWhite.position.set(-0.065, 1.29, 0.165);
  group.add(lWhite);
  const lPupil = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), irisMat);
  lPupil.position.set(-0.065, 1.29, 0.178);
  group.add(lPupil);

  const rEye = new THREE.Mesh(eyeGeo, eyeMat);
  rEye.position.set(0.065, 1.29, 0.155);
  group.add(rEye);
  const rWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
  rWhite.position.set(0.065, 1.29, 0.165);
  group.add(rWhite);
  const rPupil = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), irisMat);
  rPupil.position.set(0.065, 1.29, 0.178);
  group.add(rPupil);

  // 3D Eyebrows
  const browMat = hairMat;
  const browL = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.012, 0.015), browMat);
  browL.position.set(-0.065, 1.325, 0.17);
  browL.rotation.z = 0.05;
  group.add(browL);

  const browR = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.012, 0.015), browMat);
  browR.position.set(0.065, 1.325, 0.17);
  browR.rotation.z = -0.05;
  group.add(browR);

  // Nose
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.055, 6), skinMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 1.24, 0.19);
  group.add(nose);

  // Lips / Mouth Contour
  const lipMat = new THREE.MeshStandardMaterial({ color: 0xa86058, roughness: 0.6 });
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.015), lipMat);
  mouth.position.set(0, 1.18, 0.185);
  group.add(mouth);

  // Hair styles
  const hairStyle = idx % 4;
  if (hairStyle === 0) {
    const buzz = new THREE.Mesh(
      new THREE.SphereGeometry(0.195, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.42),
      hairMat
    );
    buzz.position.y = 1.30;
    group.add(buzz);
  } else if (hairStyle === 1) {
    const med = new THREE.Mesh(
      new THREE.SphereGeometry(0.205, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
      hairMat
    );
    med.position.y = 1.31;
    group.add(med);
  } else if (hairStyle === 2) {
    const longTop = new THREE.Mesh(
      new THREE.SphereGeometry(0.21, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.48),
      hairMat
    );
    longTop.position.y = 1.32;
    group.add(longTop);
    const longBack = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.07, 0.35, 10), hairMat);
    longBack.position.set(0, 1.06, -0.10);
    group.add(longBack);
  } else {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
      new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.7 })
    );
    cap.position.y = 1.31;
    group.add(cap);
  }

  // Spectacles / Glasses with side temple arms
  if (idx % 3 === 1) {
    const glassFrameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 });
    const lensMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, transmission: 0.8 });

    const lensL = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.01, 12), lensMat);
    lensL.rotation.x = Math.PI / 2;
    lensL.position.set(-0.065, 1.29, 0.18);
    group.add(lensL);

    const lensR = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.01, 12), lensMat);
    lensR.rotation.x = Math.PI / 2;
    lensR.position.set(0.065, 1.29, 0.18);
    group.add(lensR);

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.01, 0.01), glassFrameMat);
    bridge.position.set(0, 1.29, 0.18);
    group.add(bridge);

    const gArmL = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.16), glassFrameMat);
    gArmL.position.set(-0.11, 1.29, 0.09);
    group.add(gArmL);

    const gArmR = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.16), glassFrameMat);
    gArmR.position.set(0.11, 1.29, 0.09);
    group.add(gArmR);
  }

  // Smart Phone in hand
  if (idx % 2 === 0 && !isHighlight) {
    const phoneBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.18, 0.015),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.8 })
    );
    phoneBody.position.set(0.22, 0.42, 0.35);
    phoneBody.rotation.x = -0.6;
    phoneBody.rotation.y = -0.2;
    group.add(phoneBody);

    const phoneScreen = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.16, 0.005),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.8 })
    );
    phoneScreen.position.set(0.22, 0.42, 0.358);
    phoneScreen.rotation.x = -0.6;
    phoneScreen.rotation.y = -0.2;
    group.add(phoneScreen);
  }

  // Shoulders & Arms
  const shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), shirtMat);
  shoulderL.position.set(-0.30, 0.88, 0);
  group.add(shoulderL);

  const shoulderR = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), shirtMat);
  shoulderR.position.set(0.30, 0.88, 0);
  group.add(shoulderR);

  const upperArmL = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.38, 12), shirtMat);
  upperArmL.position.set(-0.36, 0.72, 0.05);
  upperArmL.rotation.z = 0.25;
  upperArmL.castShadow = true;
  group.add(upperArmL);

  const upperArmR = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.38, 12), shirtMat);
  upperArmR.position.set(0.36, 0.72, 0.05);
  upperArmR.rotation.z = -0.25;
  upperArmR.castShadow = true;
  group.add(upperArmR);

  const forearmL = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.34, 12), skinMat);
  forearmL.position.set(-0.32, 0.42, 0.22);
  forearmL.rotation.x = Math.PI / 3;
  group.add(forearmL);

  const forearmR = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.34, 12), skinMat);
  forearmR.position.set(0.32, 0.42, 0.22);
  forearmR.rotation.x = Math.PI / 3;
  group.add(forearmR);

  // Sculpted Hands
  const handL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.12), skinMat);
  handL.position.set(-0.30, 0.30, 0.32);
  handL.rotation.x = 0.4;
  group.add(handL);

  const handR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.12), skinMat);
  handR.position.set(0.30, 0.30, 0.32);
  handR.rotation.x = 0.4;
  group.add(handR);

  group.userData = {
    thighL,
    thighR,
    shinL,
    shinR,
    shoeL,
    shoeR,
    upperArmL,
    upperArmR,
    forearmL,
    forearmR,
    torso,
    head,
  };

  return group;
}

// ══════════════════════════════════════════════════════════════
// ██  DETAILED MEDICAL & ENVIRONMENT PROPS  ██
// ══════════════════════════════════════════════════════════════

function createWheelchair(): THREE.Group {
  const wc = new THREE.Group();
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.08 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65 });

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.65), seatMat);
  seat.position.y = 0.75;
  seat.castShadow = true;
  wc.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.7, 0.06), seatMat);
  back.position.set(0, 1.15, -0.3);
  back.castShadow = true;
  wc.add(back);

  for (const x of [-0.4, 0.4]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 12, 36), chromeMat);
    rim.position.set(x, 0.42, -0.1);
    rim.rotation.y = Math.PI / 2;
    rim.castShadow = true;
    wc.add(rim);

    for (let s = 0; s < 8; s++) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.82, 4), chromeMat);
      spoke.position.set(x, 0.42, -0.1);
      spoke.rotation.x = (s / 8) * Math.PI;
      wc.add(spoke);
    }
  }

  for (const x of [-0.32, 0.32]) {
    const caster = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 16), chromeMat);
    caster.rotation.z = Math.PI / 2;
    caster.position.set(x, 0.08, 0.32);
    wc.add(caster);
  }

  for (const x of [-0.3, 0.3]) {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 8), chromeMat);
    handle.position.set(x, 1.45, -0.42);
    handle.rotation.x = Math.PI / 4;
    wc.add(handle);
  }

  return wc;
}

function createIVStand(): THREE.Group {
  const iv = new THREE.Group();
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.08 });

  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 6), chromeMat);
    leg.position.set(Math.sin(angle) * 0.18, 0.06, Math.cos(angle) * 0.18);
    leg.rotation.x = Math.PI / 2;
    leg.rotation.y = -angle;
    iv.add(leg);
  }

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 2.1, 12), chromeMat);
  pole.position.y = 1.05;
  pole.castShadow = true;
  iv.add(pole);

  const hookBar = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.015, 0.015), chromeMat);
  hookBar.position.y = 2.05;
  iv.add(hookBar);

  const bagMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.65,
    transmission: 0.75,
    roughness: 0.1,
  });
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.06), bagMat);
  bag.position.set(-0.12, 1.90, 0);
  iv.add(bag);

  return iv;
}

function createRecyclingStation(): THREE.Group {
  const station = new THREE.Group();
  const binColors = [0xef4444, 0x3b82f6, 0x10b981];

  binColors.forEach((col, i) => {
    const bin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.20, 0.16, 0.65, 16),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.3, metalness: 0.1 })
    );
    bin.position.set((i - 1) * 0.48, 0.325, 0);
    bin.castShadow = true;
    station.add(bin);

    const lid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.21, 0.21, 0.08, 16),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 })
    );
    lid.position.set((i - 1) * 0.48, 0.67, 0);
    station.add(lid);
  });

  return station;
}

function createPottedPlant(height: number): THREE.Group {
  const plant = new THREE.Group();
  const potMat = new THREE.MeshStandardMaterial({ color: 0x4a3b2c, roughness: 0.7 });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.23, 0.5, 16), potMat);
  pot.position.y = 0.25;
  pot.castShadow = true;
  plant.add(pot);

  const soil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.30, 0.30, 0.06, 16),
    new THREE.MeshStandardMaterial({ color: 0x2e1c11, roughness: 1 })
  );
  soil.position.y = 0.52;
  plant.add(soil);

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.055, height * 0.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x4a3228, roughness: 0.85 })
  );
  trunk.position.y = 0.55 + (height * 0.4) / 2;
  trunk.castShadow = true;
  plant.add(trunk);

  const leafMat = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.55 });
  const darkLeafMat = new THREE.MeshStandardMaterial({ color: 0x145a14, roughness: 0.6 });
  const leafCount = 10 + Math.floor(Math.random() * 5);
  for (let i = 0; i < leafCount; i++) {
    const mat = Math.random() > 0.5 ? leafMat : darkLeafMat;
    const leafSize = 0.14 + Math.random() * 0.20;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(leafSize, 8, 6), mat);
    const angle = (i / leafCount) * Math.PI * 2;
    const radius = 0.14 + Math.random() * 0.18;
    leaf.position.set(
      Math.cos(angle) * radius,
      0.55 + height * 0.4 + Math.random() * 0.35,
      Math.sin(angle) * radius
    );
    leaf.scale.y = 0.6;
    leaf.castShadow = true;
    plant.add(leaf);
  }

  return plant;
}

function createSideTable(woodTex: THREE.CanvasTexture): THREE.Group {
  const table = new THREE.Group();
  const legMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.90, roughness: 0.1 });

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.6, 0.06, 24),
    new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.25, metalness: 0.1 })
  );
  top.position.y = 0.65;
  top.castShadow = true;
  table.add(top);

  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.63, 8), legMat);
  leg.position.y = 0.32;
  leg.castShadow = true;
  table.add(leg);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.03, 16), legMat);
  base.position.y = 0.015;
  table.add(base);

  // Table Coffee Mug
  const mugMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 });
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.12, 12), mugMat);
  mug.position.set(0.18, 0.74, 0.10);
  mug.castShadow = true;
  table.add(mug);

  // Magazine / Brochure on table
  const magMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.01, 0.30), magMat);
  mag.position.set(-0.15, 0.685, -0.05);
  mag.rotation.y = 0.35;
  table.add(mag);

  return table;
}

function createWaterCooler(): THREE.Group {
  const cooler = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.2, metalness: 0.1 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.3, 0.45), bodyMat);
  body.position.y = 0.65;
  body.castShadow = true;
  cooler.add(body);

  const bottleMat = new THREE.MeshPhysicalMaterial({
    color: 0x0ea5e9,
    transparent: true,
    opacity: 0.38,
    transmission: 0.6,
    thickness: 0.4,
  });
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.6, 16), bottleMat);
  bottle.position.y = 1.6;
  cooler.add(bottle);

  return cooler;
}

function createWallClock(): THREE.Group {
  const clock = new THREE.Group();

  const face = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 0.08, 32),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
  );
  face.rotation.x = Math.PI / 2;
  clock.add(face);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.04, 10, 32),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.1 })
  );
  clock.add(rim);

  const hourPivot = new THREE.Group();
  hourPivot.position.z = 0.055;
  const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.24, 0.012), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
  hourHand.position.y = 0.10;
  hourPivot.add(hourHand);
  clock.add(hourPivot);

  const minPivot = new THREE.Group();
  minPivot.position.z = 0.06;
  const minHand = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.34, 0.01), new THREE.MeshStandardMaterial({ color: 0x334155 }));
  minHand.position.y = 0.15;
  minPivot.add(minHand);
  clock.add(minPivot);

  const secPivot = new THREE.Group();
  secPivot.position.z = 0.065;
  const secHand = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.38, 0.006), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
  secHand.position.y = 0.14;
  secPivot.add(secHand);
  clock.add(secPivot);

  clock.userData = { hourPivot, minPivot, secPivot };
  return clock;
}

function createChair(isUserSeat: boolean, isServingSeat: boolean, fabricNormalMap: THREE.CanvasTexture): THREE.Group {
  const chairGroup = new THREE.Group();

  const cushionColor = isUserSeat ? 0x0284c7 : isServingSeat ? 0x0d9488 : 0x1e293b;
  const cushionEmissive = isUserSeat ? 0x38bdf8 : isServingSeat ? 0x2dd4bf : 0x000000;
  const cushionEmissiveI = isUserSeat ? 0.5 : isServingSeat ? 0.4 : 0;

  const cushionMat = new THREE.MeshStandardMaterial({
    color: cushionColor,
    normalMap: fabricNormalMap,
    normalScale: new THREE.Vector2(0.2, 0.2),
    roughness: 0.70,
    metalness: 0.02,
    emissive: cushionEmissive,
    emissiveIntensity: cushionEmissiveI,
  });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.95, roughness: 0.06 });

  const cushion = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 1.1), cushionMat);
  cushion.position.y = 0.85;
  cushion.castShadow = true;
  cushion.receiveShadow = true;
  chairGroup.add(cushion);

  const backCushion = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 0.18), cushionMat);
  backCushion.position.set(0, 1.44, -0.48);
  backCushion.castShadow = true;
  chairGroup.add(backCushion);

  const legPositions = [[-0.52, 0.38, 0.45], [0.52, 0.38, 0.45], [-0.52, 0.38, -0.45], [0.52, 0.38, -0.45]];
  for (const p of legPositions) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.74, 8), frameMat);
    leg.position.set(p[0], p[1], p[2]);
    leg.castShadow = true;
    chairGroup.add(leg);
  }

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.035, 0.7), frameMat);
  armL.position.set(-0.6, 1.12, 0);
  chairGroup.add(armL);

  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.035, 0.7), frameMat);
  armR.position.set(0.6, 1.12, 0);
  chairGroup.add(armR);

  return chairGroup;
}

function createWindow(): THREE.Group {
  const win = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.25 });

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

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(3.3, 3.9),
    new THREE.MeshPhysicalMaterial({
      color: 0x88aacc,
      transparent: true,
      opacity: 0.18,
      transmission: 0.65,
      thickness: 0.2,
      side: THREE.DoubleSide,
    })
  );
  glass.position.z = -0.03;
  win.add(glass);

  return win;
}

// ══════════════════════════════════════════════════════════════
// ██  ARCHITECTURAL DOORS & ILLUMINATED EXIT SIGNS  ██
// ══════════════════════════════════════════════════════════════

function createDoorway(isEmergency: boolean): THREE.Group {
  const doorGroup = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 });

  // Frame outer
  const fL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 6, 0.2), frameMat);
  fL.position.x = -1.8;
  doorGroup.add(fL);

  const fR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 6, 0.2), frameMat);
  fR.position.x = 1.8;
  doorGroup.add(fR);

  const fTop = new THREE.Mesh(new THREE.BoxGeometry(3.75, 0.15, 0.2), frameMat);
  fTop.position.y = 3;
  doorGroup.add(fTop);

  // Translucent Glass Door Panels
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: isEmergency ? 0xfecdd3 : 0xe0f2fe,
    transparent: true,
    opacity: 0.45,
    transmission: 0.5,
    roughness: 0.1,
  });

  const doorL = new THREE.Mesh(new THREE.BoxGeometry(1.65, 5.8, 0.06), glassMat);
  doorL.position.set(-0.85, 0, 0);
  doorGroup.add(doorL);

  const doorR = new THREE.Mesh(new THREE.BoxGeometry(1.65, 5.8, 0.06), glassMat);
  doorR.position.set(0.85, 0, 0);
  doorGroup.add(doorR);

  // Door handles (attached to sliding door panels)
  const handleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.95, roughness: 0.05 });
  const hL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 8), handleMat);
  hL.position.set(0.70, 0, 0.04);
  doorL.add(hL);
  const hR = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 8), handleMat);
  hR.position.set(-0.70, 0, 0.04);
  doorR.add(hR);

  doorGroup.userData = { doorL, doorR };

  // Illuminated Header Sign Box
  const signColor = isEmergency ? 0xdc2626 : 0x0284c7;
  const signBox = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.6, 0.15),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 })
  );
  signBox.position.y = 3.45;
  doorGroup.add(signBox);

  const signFace = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 0.5),
    new THREE.MeshStandardMaterial({
      color: signColor,
      emissive: signColor,
      emissiveIntensity: 0.6,
    })
  );
  signFace.position.set(0, 3.45, 0.081);
  doorGroup.add(signFace);

  return doorGroup;
}

function createIndoorPlant(potColor: number = 0xf8fafc): THREE.Group {
  const group = new THREE.Group();

  // Ceramic Pot
  const potMat = new THREE.MeshPhysicalMaterial({
    color: potColor,
    roughness: 0.15,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1,
  });
  const potGeo = new THREE.CylinderGeometry(0.9, 0.6, 1.6, 24);
  const pot = new THREE.Mesh(potGeo, potMat);
  pot.position.y = 0.8;
  pot.castShadow = true;
  group.add(pot);

  // Soil
  const soilMat = new THREE.MeshStandardMaterial({ color: 0x1c120c, roughness: 1.0 });
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.1, 24), soilMat);
  soil.position.y = 1.55;
  group.add(soil);

  // Leaves
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x126933,
    roughness: 0.35,
    side: THREE.DoubleSide,
  });

  const leafCount = 20;
  for (let i = 0; i < leafCount; i++) {
    // Flattened diamond-like leaf
    const leafGeo = new THREE.CylinderGeometry(0.45, 0.05, 1.8, 7);
    leafGeo.scale(1, 1, 0.05);
    
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    
    const angle = (i / leafCount) * Math.PI * 2 + (Math.random() * 0.5);
    const radius = 0.3 + Math.random() * 0.6;
    const height = 1.8 + Math.random() * 2.8;
    
    leaf.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
    
    // Arching outward
    leaf.rotation.z = Math.PI / 6 + Math.random() * 0.6;
    leaf.rotation.y = angle;
    
    leaf.castShadow = true;
    group.add(leaf);
    
    // Stem
    const stemGeo = new THREE.CylinderGeometry(0.05, 0.02, height - 1.4, 5);
    const stem = new THREE.Mesh(stemGeo, leafMat);
    stem.position.set(leaf.position.x * 0.5, 1.55 + (height - 1.55) / 2, leaf.position.z * 0.5);
    
    // Simple aim towards leaf center
    stem.lookAt(leaf.position);
    stem.rotation.x -= Math.PI / 2; // correct lookAt for cylinder
    
    stem.castShadow = true;
    group.add(stem);
  }

  return group;
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
  const tvScreenMeshRef = useRef<THREE.Mesh | null>(null);
  const clockRef = useRef<THREE.Group | null>(null);
  const erDoorRef = useRef<THREE.Group | null>(null);
  const userHumanoidRef = useRef<{ group: THREE.Group; seatPos: THREE.Vector3 } | null>(null);
  const isWalkingRef = useRef<boolean>(false);
  const walkPhaseRef = useRef<number>(0);

  const [badges, setBadges] = useState<
    Array<{ id: string; label: string; x: number; y: number; isUser: boolean; isServing: boolean; visible: boolean }>
  >([]);
  const seatPositionsRef = useRef<PatientSeatData[]>([]);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const tweens: gsap.core.Tween[] = [];

    // SCENE & FOG
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#03050b');
    scene.fog = new THREE.FogExp2('#050810', 0.014);

    // CAMERA
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 120);
    camera.position.set(0, 11, 24);
    camera.lookAt(0, 2, -2);
    cameraRef.current = camera;

    // RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // POST PROCESSING
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.35,  // strength
      0.30,  // radius
      0.75   // threshold
    );
    composer.addPass(bloomPass);
    composer.addPass(new SMAAPass());
    composer.addPass(new OutputPass());
    composerRef.current = composer;

    // ENVIRONMENT MAP GENERATION
    const pmremGen = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color('#0b1326');
    const envSphere = new THREE.Mesh(
      new THREE.SphereGeometry(50, 32, 16),
      new THREE.MeshBasicMaterial({ color: '#0d1830', side: THREE.BackSide })
    );
    envScene.add(envSphere);
    const eL1 = new THREE.PointLight('#38bdf8', 10);
    eL1.position.set(15, 15, 15);
    envScene.add(eL1);
    const eL2 = new THREE.PointLight('#f59e0b', 4);
    eL2.position.set(-15, 12, -10);
    envScene.add(eL2);

    const envTexture = pmremGen.fromScene(envScene, 0.04).texture;
    scene.environment = envTexture;
    pmremGen.dispose();

    // CONTROLS
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.minDistance = 2;
    controls.maxDistance = 45;
    controls.target.set(0, 2, -2);
    controlsRef.current = controls;

    // LIGHTING
    const hemiLight = new THREE.HemisphereLight('#38bdf8', '#0f172a', 1.6);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight('#f8fafc', 2.8);
    sunLight.position.set(10, 22, 14);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // Ceiling Recessed Light Grid
    const ceilingLightPositions = [
      [-6, 13.5, -4], [0, 13.5, -4], [6, 13.5, -4],
      [-6, 13.5, 3], [0, 13.5, 3], [6, 13.5, 3],
    ];
    for (const pos of ceilingLightPositions) {
      const cl = new THREE.PointLight('#e2e8f0', 1.3, 19, 1.5);
      cl.position.set(pos[0], pos[1], pos[2]);
      scene.add(cl);

      // Light Panel Mesh on Ceiling
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 1.6),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0xf8fafc,
          emissiveIntensity: 0.8,
        })
      );
      panel.rotation.x = Math.PI / 2;
      panel.position.set(pos[0], 13.98, pos[2]);
      scene.add(panel);
    }

    // Doctor & Emergency room lights
    const docSpot = new THREE.SpotLight('#38bdf8', 4.5, 24, Math.PI / 4, 0.6, 1.2);
    docSpot.position.set(-10, 12, -8);
    docSpot.target.position.set(-10, 0, -12);
    scene.add(docSpot);
    scene.add(docSpot.target);

    const erLight = new THREE.PointLight('#ff2a5f', 0, 32, 1.5);
    erLight.position.set(10, 8, -10);
    scene.add(erLight);
    emergencyLightRef.current = erLight;

    // PROCEDURAL TEXTURE GENERATION
    const floorTex = createFloorTexture();
    const floorNormalMap = createFloorNormalMap();
    const floorRoughMap = createFloorRoughnessMap();
    const woodTex = createWoodTexture();
    const fabricNormalMap = createFabricNormalMap();

    // ARCHITECTURE
    const roomWidth = 36;
    const roomDepth = 32;
    const roomHeight = 14;

    // PBR FLOOR WITH CLEARCOAT & NORMAL MAP
    const floorMat = new THREE.MeshPhysicalMaterial({
      map: floorTex,
      normalMap: floorNormalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughnessMap: floorRoughMap,
      roughness: 0.15,
      clearcoat: 0.85,
      clearcoatRoughness: 0.10,
      envMapIntensity: 1.6,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomDepth), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // WALLS
    const wallTex = createWallTexture();
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.7 });

    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomHeight), wallMat);
    backWall.position.set(0, roomHeight / 2, -roomDepth / 2);
    backWall.receiveShadow = true;
    scene.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(roomDepth, roomHeight), wallMat);
    leftWall.position.set(-roomWidth / 2, roomHeight / 2, 0);
    leftWall.rotation.y = Math.PI / 2;
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(roomDepth, roomHeight), wallMat);
    rightWall.position.set(roomWidth / 2, roomHeight / 2, 0);
    rightWall.rotation.y = -Math.PI / 2;
    scene.add(rightWall);

    // BASEBOARDS / SKIRTING BOARDS
    const baseboardMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.4 });
    const bBack = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, 0.3, 0.08), baseboardMat);
    bBack.position.set(0, 0.15, -roomDepth / 2 + 0.04);
    scene.add(bBack);

    const bLeft = new THREE.Mesh(new THREE.BoxGeometry(roomDepth, 0.3, 0.08), baseboardMat);
    bLeft.position.set(-roomWidth / 2 + 0.04, 0.15, 0);
    bLeft.rotation.y = Math.PI / 2;
    scene.add(bLeft);

    const bRight = new THREE.Mesh(new THREE.BoxGeometry(roomDepth, 0.3, 0.08), baseboardMat);
    bRight.position.set(roomWidth / 2 - 0.04, 0.15, 0);
    bRight.rotation.y = -Math.PI / 2;
    scene.add(bRight);

    // CEILING
    const ceilTex = createCeilingTexture();
    const ceilMat = new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.8 });
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomDepth), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = roomHeight;
    scene.add(ceiling);

    // WINDOWS & OUTDOOR SCENERY
    for (let i = 0; i < 2; i++) {
      const win = createWindow();
      win.position.set(-roomWidth / 2 + 0.1, 6, -4 + i * 10);
      win.rotation.y = Math.PI / 2;
      scene.add(win);

      const scenery = createOutdoorScenery();
      scenery.position.set(-roomWidth / 2 - 1.5, 6, -4 + i * 10);
      scenery.rotation.y = Math.PI / 2;
      scene.add(scenery);

      // Light Rays Shaft
      const rayGeo = new THREE.CylinderGeometry(0.5, 3.5, 12, 16, 1, true);
      const rayMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.06,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const ray = new THREE.Mesh(rayGeo, rayMat);
      ray.position.set(-roomWidth / 2 + 5, 5, -4 + i * 10);
      ray.rotation.z = -Math.PI / 4;
      scene.add(ray);
    }

    // ARCHITECTURAL GLASS DOORS
    const docDoor = createDoorway(false);
    docDoor.position.set(-9, 3, -roomDepth / 2 + 0.1);
    scene.add(docDoor);

    const erDoor = createDoorway(true);
    erDoor.position.set(9, 3, -roomDepth / 2 + 0.1);
    scene.add(erDoor);
    erDoorRef.current = erDoor;

    // MEDICAL WALL POSTERS
    const poster1Mat = new THREE.MeshStandardMaterial({ map: createPosterTexture('hygiene'), roughness: 0.3 });
    const poster1 = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.3), poster1Mat);
    poster1.position.set(-3.5, 6.5, -roomDepth / 2 + 0.05);
    scene.add(poster1);

    const poster2Mat = new THREE.MeshStandardMaterial({ map: createPosterTexture('guide'), roughness: 0.3 });
    const poster2 = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.3), poster2Mat);
    poster2.position.set(3.5, 6.5, -roomDepth / 2 + 0.05);
    scene.add(poster2);

    const poster3Mat = new THREE.MeshStandardMaterial({ map: createPosterTexture('emergency'), roughness: 0.3 });
    const poster3 = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.3), poster3Mat);
    poster3.position.set(roomWidth / 2 - 0.05, 6.5, 4);
    poster3.rotation.y = -Math.PI / 2;
    scene.add(poster3);

    // INDOOR POTTED PLANTS
    const newPlant1 = createIndoorPlant(0xf8fafc);
    newPlant1.position.set(-16, 0.15, -14);
    scene.add(newPlant1);

    const newPlant2 = createIndoorPlant(0x0f172a);
    newPlant2.position.set(16, 0.15, 14);
    scene.add(newPlant2);

    // AMBIENT DUST MOTES (VOLUMETRIC PARTICLES)
    const particleCount = 500;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * roomWidth;
      dustPos[i * 3 + 1] = Math.random() * roomHeight;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * roomDepth;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.06,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const dustSystem = new THREE.Points(dustGeo, dustMat);
    scene.add(dustSystem);

    // DYNAMIC LIVE QUEUE TV DISPLAY
    const tvGroup = new THREE.Group();
    tvGroup.position.set(0, 9.5, -12);

    const tvBody = new THREE.Mesh(
      new THREE.BoxGeometry(8, 4, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.15, metalness: 0.3 })
    );
    tvGroup.add(tvBody);

    const initialTVTex = createDynamicTVTexture(servingTokenNumber, userTokenNumber, queuePosition, 0);
    const tvScreenMat = new THREE.MeshStandardMaterial({
      map: initialTVTex,
      emissive: 0xffffff,
      emissiveMap: initialTVTex,
      emissiveIntensity: 0.45,
      roughness: 0.1,
    });
    const tvScreen = new THREE.Mesh(new THREE.BoxGeometry(7.6, 3.6, 0.04), tvScreenMat);
    tvScreen.position.z = 0.13;
    tvGroup.add(tvScreen);
    tvScreenMeshRef.current = tvScreen;

    scene.add(tvGroup);

    // PROPS
    const wheelchair = createWheelchair();
    wheelchair.position.set(13.5, 0, -8);
    wheelchair.rotation.y = -0.6;
    scene.add(wheelchair);

    const ivStand = createIVStand();
    ivStand.position.set(12, 0, -9.5);
    scene.add(ivStand);

    const recycling = createRecyclingStation();
    recycling.position.set(-14.5, 0, -6);
    scene.add(recycling);

    const plant1 = createPottedPlant(1.2);
    plant1.position.set(-16, 0, -12);
    scene.add(plant1);

    const plant2 = createPottedPlant(1.5);
    plant2.position.set(16, 0, -12);
    scene.add(plant2);

    const table1 = createSideTable(woodTex);
    table1.position.set(-5, 0, 10);
    scene.add(table1);

    const table2 = createSideTable(woodTex);
    table2.position.set(5, 0, 10);
    scene.add(table2);

    const cooler = createWaterCooler();
    cooler.position.set(15, 0, 0);
    scene.add(cooler);

    const wallClock = createWallClock();
    wallClock.position.set(0, 11, -15.7);
    scene.add(wallClock);
    clockRef.current = wallClock;

    // SEATING AREA & HUMANOIDS
    const seatList: PatientSeatData[] = [];
    const rows = 3;
    const cols = 5;
    const seatSpacingX = 2.8;
    const seatSpacingZ = 3.4;
    const userIndex = queuePosition;

    const skinTones = [0xd4a574, 0xc68642, 0x8d5524, 0xf1c27d, 0xe0ac69, 0xa0522d, 0xdeb887];
    const shirtColors = [0x1e40af, 0x166534, 0x7c3aed, 0x0f766e, 0x9a3412, 0x1e3a5f, 0x4a2082];
    const pantsColors = [0x1e293b, 0x292524, 0x1c1917, 0x0f172a, 0x27272a];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const x = (c - (cols - 1) / 2) * seatSpacingX;
        const z = (r - 0.3) * seatSpacingZ + 2;

        const isUserSeat = idx === userIndex;
        const isServingSeat = idx === 0 && servingTokenNumber !== 'None';
        const isOccupied = idx <= totalWaiting;

        const chair = createChair(isUserSeat, isServingSeat, fabricNormalMap);
        chair.position.set(x, 0, z);
        scene.add(chair);

        if (isOccupied) {
          const skinIdx = idx % skinTones.length;
          const shirtIdx = idx % shirtColors.length;
          const pantsIdx = idx % pantsColors.length;

          const humanoid = createHumanoid(
            skinTones[skinIdx],
            isUserSeat ? 0x0284c7 : isServingSeat ? 0x0d9488 : shirtColors[shirtIdx],
            pantsColors[pantsIdx],
            isUserSeat || isServingSeat,
            fabricNormalMap,
            isUserSeat ? 0x0284c7 : isServingSeat ? 0x0d9488 : undefined,
            isUserSeat ? 0.5 : isServingSeat ? 0.4 : 0,
            idx,
            tweens
          );
          humanoid.position.set(x, 0.74, z);
          scene.add(humanoid);

          if (isUserSeat) {
            userHumanoidRef.current = {
              group: humanoid,
              seatPos: new THREE.Vector3(x, 0.74, z),
            };
          }
        }

        // Highlight spotlight & rings under user seat
        if (isUserSeat) {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.15, 1.5, 48),
            new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
          );
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(x, 0.02, z);
          scene.add(ring);

          const outerRing = new THREE.Mesh(
            new THREE.RingGeometry(1.5, 2.2, 48),
            new THREE.MeshBasicMaterial({ color: 0x0ea5e9, side: THREE.DoubleSide, transparent: true, opacity: 0.35 })
          );
          outerRing.rotation.x = -Math.PI / 2;
          outerRing.position.set(x, 0.015, z);
          scene.add(outerRing);

          const beamGeo = new THREE.CylinderGeometry(0.05, 1.4, 12, 24, 1, true);
          const beamMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.12,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          });
          const beam = new THREE.Mesh(beamGeo, beamMat);
          beam.position.set(x, 6, z);
          scene.add(beam);

          const userSpotLight = new THREE.SpotLight(0x38bdf8, 12, 16, Math.PI / 6, 0.4, 1.2);
          userSpotLight.position.set(x, 12, z);
          userSpotLight.target.position.set(x, 0, z);
          scene.add(userSpotLight);
          scene.add(userSpotLight.target);

          tweens.push(gsap.to(ring.scale, { x: 1.2, y: 1.2, duration: 1.5, repeat: -1, yoyo: true, ease: 'sine.inOut' }));
          tweens.push(gsap.to(outerRing.scale, { x: 1.18, y: 1.18, duration: 2, repeat: -1, yoyo: true, ease: 'sine.inOut' }));
          tweens.push(gsap.to(beamMat, { opacity: 0.18, duration: 1.8, repeat: -1, yoyo: true, ease: 'sine.inOut' }));
        }

        const worldPos = new THREE.Vector3(x, 3.0, z);
        let statusLabel = '';
        if (isUserSeat) statusLabel = `📍 YOU — ${userTokenNumber}`;
        else if (isServingSeat) statusLabel = `✅ Serving: ${servingTokenNumber}`;
        else if (idx < userIndex) statusLabel = `#${userIndex - idx} Ahead`;
        else if (isOccupied) statusLabel = `Waiting`;

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

    // Door Labels
    seatList.push({
      index: 998,
      tokenNumber: 'DOCTOR',
      isUser: false,
      isServing: false,
      position: new THREE.Vector3(-9, 7.5, -14.5),
      statusLabel: '🚪 OPD Consultation Room 12',
    });

    seatList.push({
      index: 999,
      tokenNumber: 'ER',
      isUser: false,
      isServing: false,
      position: new THREE.Vector3(9, 7.5, -14.5),
      statusLabel: '🚨 Emergency Trauma Bay',
    });

    seatPositionsRef.current = seatList;

    // ANIMATION LOOP
    let animationId: number;
    const clock = new THREE.Clock();
    let tickerCount = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      controls.update();

      // Walking Limb Animation
      if (isWalkingRef.current && userHumanoidRef.current) {
        walkPhaseRef.current += 0.15;
        const phase = walkPhaseRef.current;
        const { thighL, thighR, shinL, shinR, upperArmL, upperArmR } = userHumanoidRef.current.group.userData;
        if (thighL && thighR) {
          thighL.rotation.x = Math.sin(phase) * 0.45;
          thighR.rotation.x = -Math.sin(phase) * 0.45;
        }
        if (shinL && shinR) {
          shinL.rotation.x = Math.max(0, -Math.sin(phase) * 0.35);
          shinR.rotation.x = Math.max(0, Math.sin(phase) * 0.35);
        }
        if (upperArmL && upperArmR) {
          upperArmL.rotation.x = -Math.sin(phase) * 0.35;
          upperArmR.rotation.x = Math.sin(phase) * 0.35;
        }
      }

      // Dynamic TV Ticker & Screen Update
      tickerCount += 2;
      if (tvScreenMeshRef.current && Math.floor(tickerCount) % 15 === 0) {
        const newTVTex = createDynamicTVTexture(servingTokenNumber, userTokenNumber, queuePosition, tickerCount);
        const mat = tvScreenMeshRef.current.material as THREE.MeshStandardMaterial;
        if (mat.map) mat.map.dispose();
        if (mat.emissiveMap) mat.emissiveMap.dispose();
        mat.map = newTVTex;
        mat.emissiveMap = newTVTex;
        mat.needsUpdate = true;
      }

      // Animated Wall Clock
      if (clockRef.current && clockRef.current.userData) {
        const now = new Date();
        const h = now.getHours() % 12;
        const m = now.getMinutes();
        const s = now.getSeconds() + now.getMilliseconds() / 1000;
        const { hourPivot, minPivot, secPivot } = clockRef.current.userData;
        if (hourPivot) hourPivot.rotation.z = -(h / 12) * Math.PI * 2 - (m / 720) * Math.PI * 2;
        if (minPivot) minPivot.rotation.z = -(m / 60) * Math.PI * 2 - (s / 3600) * Math.PI * 2;
        if (secPivot) secPivot.rotation.z = -(s / 60) * Math.PI * 2;
      }

      // Emergency strobe
      if (emergencyLightRef.current && emergencyLightRef.current.intensity > 0) {
        emergencyLightRef.current.intensity = 5 + Math.sin(elapsed * 10) * 4;
      }

      // Animate Dust Particles
      if (typeof dustSystem !== 'undefined') {
        dustSystem.rotation.y += 0.0003;
        dustSystem.position.y = Math.sin(elapsed * 0.5) * 0.3;
      }

      // 3D Badges projection
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

      if (composerRef.current) {
        composerRef.current.render();
      }
    };

    animate();

    const handleResize = () => {
      if (!container || !cameraRef.current || !rendererRef.current || !composerRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
      composerRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      tweens.forEach((t) => t.kill());

      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.dispose();
        if (container.contains(rendererRef.current.domElement)) {
          container.removeChild(rendererRef.current.domElement);
        }
      }
    };
  }, [queuePosition, totalWaiting, userTokenNumber, servingTokenNumber]);

  // Handle Camera Presets
  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;

    if (cameraView === 'user') {
      const userSeat = seatPositionsRef.current.find((s) => s.isUser);
      const targetPos = userSeat ? userSeat.position : new THREE.Vector3(0, 2, 2);
      gsap.to(cam.position, { x: targetPos.x, y: targetPos.y + 4, z: targetPos.z + 8, duration: 1.5, ease: 'power2.inOut' });
      gsap.to(ctrl.target, { x: targetPos.x, y: targetPos.y, z: targetPos.z, duration: 1.5, ease: 'power2.inOut' });
    } else if (cameraView === 'doctor') {
      gsap.to(cam.position, { x: -8, y: 5, z: -8, duration: 1.5, ease: 'power2.inOut' });
      gsap.to(ctrl.target, { x: -9, y: 3, z: -15, duration: 1.5, ease: 'power2.inOut' });
    } else if (cameraView === 'emergency') {
      gsap.to(cam.position, { x: 8, y: 5, z: -8, duration: 1.5, ease: 'power2.inOut' });
      gsap.to(ctrl.target, { x: 9, y: 3, z: -15, duration: 1.5, ease: 'power2.inOut' });
    } else {
      // Orbit
      gsap.to(cam.position, { x: 0, y: 11, z: 24, duration: 1.5, ease: 'power2.inOut' });
      gsap.to(ctrl.target, { x: 0, y: 2, z: -2, duration: 1.5, ease: 'power2.inOut' });
    }
  }, [cameraView]);

  // Handle Emergency Flash Light Intensity & Walking Animation into Emergency Room
  useEffect(() => {
    if (emergencyLightRef.current) {
      emergencyLightRef.current.intensity = isEmergency ? 8 : 0;
    }

    if (!userHumanoidRef.current) return;
    const userH = userHumanoidRef.current.group;
    const seatPos = userHumanoidRef.current.seatPos;
    const emergencyGatePos = new THREE.Vector3(9, 0, -13.5);
    const insideRoomPos = new THREE.Vector3(9, 0, -15.5);
    const { thighL, thighR, shinL, shinR, shoeL, shoeR, upperArmL, upperArmR } = userH.userData;

    const erDoor = erDoorRef.current;
    const doorL = erDoor?.userData?.doorL;
    const doorR = erDoor?.userData?.doorR;

    if (isEmergency) {
      userH.visible = true;
      userH.scale.set(1, 1, 1);

      const dx = emergencyGatePos.x - userH.position.x;
      const dz = emergencyGatePos.z - userH.position.z;
      const targetAngle = Math.atan2(dx, dz);

      gsap.timeline()
        // 1. Stand up from chair
        .to([thighL.rotation, thighR.rotation], { x: 0, duration: 0.4, ease: 'power1.inOut' })
        .to([upperArmL.rotation, upperArmR.rotation], { x: 0, duration: 0.4, ease: 'power1.inOut' }, 0)
        .to(userH.position, { y: 0.82, duration: 0.4, ease: 'power1.inOut' }, 0)
        .to([shinL.position, shinR.position], { z: 0, y: -0.42, duration: 0.4, ease: 'power1.inOut' }, 0)
        .to([shoeL.position, shoeR.position], { z: 0.05, y: -0.70, duration: 0.4, ease: 'power1.inOut' }, 0)
        .to(userH.rotation, { y: targetAngle, duration: 0.4, ease: 'power1.inOut' })
        // 2. Walk to front of Emergency Gate
        .call(() => {
          isWalkingRef.current = true;
        })
        .to(userH.position, {
          x: emergencyGatePos.x,
          z: emergencyGatePos.z,
          duration: 3.2,
          ease: 'power1.inOut',
          onUpdate: () => {
            const userBadge = seatPositionsRef.current.find((s) => s.isUser);
            if (userBadge) {
              userBadge.position.copy(userH.position).add(new THREE.Vector3(0, 2.3, 0));
            }
          },
        })
        // 3. Open Emergency Doors as character reaches gate
        .call(() => {
          gsap.to(userH.rotation, { y: 0, duration: 0.3 });
          if (doorL && doorR) {
            gsap.to(doorL.position, { x: -2.3, duration: 0.7, ease: 'power2.out' });
            gsap.to(doorR.position, { x: 2.3, duration: 0.7, ease: 'power2.out' });
          }
        })
        .to({}, { duration: 0.4 })
        // 4. Walk inside room and disappear
        .to(userH.position, {
          z: insideRoomPos.z,
          duration: 1.4,
          ease: 'power1.in',
          onUpdate: () => {
            const userBadge = seatPositionsRef.current.find((s) => s.isUser);
            if (userBadge) {
              userBadge.position.copy(userH.position).add(new THREE.Vector3(0, 2.3, 0));
            }
          },
        })
        .to(userH.scale, {
          x: 0,
          y: 0,
          z: 0,
          duration: 0.5,
          ease: 'power2.in',
          onComplete: () => {
            isWalkingRef.current = false;
            userH.visible = false;

            // Close sliding doors behind entered patient
            if (doorL && doorR) {
              gsap.to(doorL.position, { x: -0.85, duration: 0.8, ease: 'power2.inOut' });
              gsap.to(doorR.position, { x: 0.85, duration: 0.8, ease: 'power2.inOut' });
            }

            // Update badge text to entered status
            const userBadge = seatPositionsRef.current.find((s) => s.isUser);
            if (userBadge) {
              userBadge.statusLabel = `🏥 Entered Trauma Bay`;
            }
          },
        }, '-=0.5');
    } else {
      // Emergency Mode OFF: Return to Lounge
      userH.visible = true;
      const userBadge = seatPositionsRef.current.find((s) => s.isUser);
      if (userBadge) {
        userBadge.statusLabel = `📍 YOU — ${userTokenNumber}`;
      }

      if (userH.position.distanceTo(seatPos) > 0.5) {
        gsap.timeline()
          // 1. Open Emergency Doors
          .call(() => {
            if (doorL && doorR) {
              gsap.to(doorL.position, { x: -2.3, duration: 0.6, ease: 'power2.out' });
              gsap.to(doorR.position, { x: 2.3, duration: 0.6, ease: 'power2.out' });
            }
            userH.position.set(emergencyGatePos.x, 0.82, insideRoomPos.z);
            gsap.to(userH.scale, { x: 1, y: 1, z: 1, duration: 0.4 });
            const dx = seatPos.x - emergencyGatePos.x;
            const dz = seatPos.z - emergencyGatePos.z;
            userH.rotation.y = Math.atan2(dx, dz);
          })
          .to({}, { duration: 0.4 })
          // 2. Walk out of room onto lounge floor
          .call(() => {
            isWalkingRef.current = true;
          })
          .to(userH.position, {
            z: emergencyGatePos.z,
            duration: 1.0,
            ease: 'linear',
            onComplete: () => {
              if (doorL && doorR) {
                gsap.to(doorL.position, { x: -0.85, duration: 0.7, ease: 'power2.inOut' });
                gsap.to(doorR.position, { x: 0.85, duration: 0.7, ease: 'power2.inOut' });
              }
            },
          })
          // 3. Walk back to assigned seat
          .to(userH.position, {
            x: seatPos.x,
            z: seatPos.z,
            duration: 3.2,
            ease: 'power1.inOut',
            onUpdate: () => {
              if (userBadge) {
                userBadge.position.copy(userH.position).add(new THREE.Vector3(0, 2.3, 0));
              }
            },
            onComplete: () => {
              isWalkingRef.current = false;
              // Sit back down
              gsap.timeline()
                .to(userH.rotation, { y: 0, duration: 0.4 })
                .to([thighL.rotation, thighR.rotation], { x: Math.PI / 2, duration: 0.5, ease: 'power1.inOut' }, 0)
                .to(userH.position, { y: 0.74, duration: 0.5, ease: 'power1.inOut' }, 0)
                .to(shinL.position, { x: -0.16, y: -0.15, z: 0.52, duration: 0.5 }, 0)
                .to(shinR.position, { x: 0.16, y: -0.15, z: 0.52, duration: 0.5 }, 0)
                .to(shoeL.position, { x: -0.16, y: -0.42, z: 0.56, duration: 0.5 }, 0)
                .to(shoeR.position, { x: 0.16, y: -0.42, z: 0.56, duration: 0.5 }, 0);
            },
          });
      }
    }
  }, [isEmergency]);

  return (
    <div className="relative w-full h-full min-h-[360px] rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-[#03050b]">
      {/* 3D WebGL Canvas Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* 2D Overlay Badges for Seating Position Tokens */}
      {badges.map(
        (badge) =>
          badge.visible && (
            <div
              key={badge.id}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-75 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-lg flex items-center gap-1.5 backdrop-blur-md border ${
                badge.isUser
                  ? 'bg-sky-500/90 text-zinc-950 border-sky-300 ring-2 ring-sky-400/50 scale-110 font-black'
                  : badge.isServing
                  ? 'bg-teal-500/90 text-zinc-950 border-teal-300 ring-2 ring-teal-400/50 scale-105 font-black'
                  : badge.id.includes('DOCTOR') || badge.id.includes('ER')
                  ? 'bg-zinc-900/90 text-zinc-200 border-white/20'
                  : 'bg-zinc-950/75 text-zinc-300 border-white/10'
              }`}
              style={{ left: `${badge.x}px`, top: `${badge.y}px` }}
            >
              <span>{badge.label}</span>
            </div>
          )
      )}
    </div>
  );
};

export default WaitingRoom3DCanvas;
