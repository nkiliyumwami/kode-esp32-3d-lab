// KODE · Lesson 01 · Blink an LED on GPIO25.
// All geometry is procedural (no photos). Positions come from lesson01-circuit.js,
// which the automated connection tests also use.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import * as C from './lesson01-circuit.js';

const { PITCH } = C;
const host = document.getElementById('scene');
const reduceMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = reduceMotionQuery.matches;

// ---------------------------------------------------------------- renderer
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  document.getElementById('fallback').style.display = 'flex';
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.setAttribute('aria-hidden', 'true');
host.prepend(renderer.domElement);

const labelRenderer = new CSS2DRenderer({ element: document.getElementById('labels') });

const scene = new THREE.Scene();
const BACKGROUND = new THREE.Color('#1d2733');
scene.background = BACKGROUND;
scene.fog = new THREE.Fog(BACKGROUND, 380, 1100);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const camera = new THREE.PerspectiveCamera(30, 1, 1, 4000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = !reducedMotion;
controls.dampingFactor = 0.08;
controls.minDistance = 45;
controls.maxDistance = 700;
controls.maxPolarAngle = THREE.MathUtils.degToRad(84);

// ---------------------------------------------------------------- lights
const key = new THREE.DirectionalLight(0xfff3e4, 2.4);
key.position.set(-80, 170, 120);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -95, right: 95, top: 95, bottom: -95, near: 20, far: 520 });
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.04;
key.shadow.radius = 5;
scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0xc8dcff, 0.7);
rim.position.set(140, 90, -120);
scene.add(rim);
scene.add(new THREE.HemisphereLight(0xe6eeff, 0x2b2620, 0.3));

// ---------------------------------------------------------------- helpers
const maxAniso = renderer.capabilities.getMaxAnisotropy();
function canvasTexture(width, height, draw, { color = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const tex = new THREE.CanvasTexture(canvas);
  if (color) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

// A flat, upward-facing rectangle whose UVs sample a sub-rectangle of a texture
// that covers `full` (world XZ extents). Canvas y grows toward +Z (the learner).
function topPlane(x0, x1, z0, z1, y, material, full) {
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  geo.rotateX(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - full.x0) / (full.x1 - full.x0), 1 - (pos.getZ(i) - full.z0) / (full.z1 - full.z0));
  }
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
}

function box(w, h, d, material, x = 0, y = 0, z = 0, radius = 0) {
  const geo = radius > 0 ? new RoundedBoxGeometry(w, h, d, 3, radius) : new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  return mesh;
}

// Polyline with rounded corners: used for bent component leads.
function roundedPath(points, radius) {
  const path = new THREE.CurvePath();
  let cursor = points[0].clone();
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const inDir = p.clone().sub(points[i - 1]).normalize();
    const outDir = points[i + 1].clone().sub(p).normalize();
    const r = Math.min(radius, p.distanceTo(points[i - 1]) / 2, p.distanceTo(points[i + 1]) / 2);
    const start = p.clone().addScaledVector(inDir, -r);
    const end = p.clone().addScaledVector(outDir, r);
    path.add(new THREE.LineCurve3(cursor, start));
    path.add(new THREE.QuadraticBezierCurve3(start, p.clone(), end));
    cursor = end;
  }
  path.add(new THREE.LineCurve3(cursor, points[points.length - 1].clone()));
  return path;
}
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = t => Math.min(1, Math.max(0, t));

function noise(g, w, h, count, alpha, light = true) {
  for (let i = 0; i < count; i++) {
    g.fillStyle = light ? `rgba(255,255,255,${Math.random() * alpha})` : `rgba(0,0,0,${Math.random() * alpha})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
  }
}

// ---------------------------------------------------------------- materials
const MAT = {
  boardPlastic: new THREE.MeshStandardMaterial({ color: '#f4f3ee', roughness: 0.6 }),
  gold: new THREE.MeshStandardMaterial({ color: '#f0c46a', metalness: 1, roughness: 0.26 }),
  tin: new THREE.MeshStandardMaterial({ color: '#c9ced4', metalness: 1, roughness: 0.38 }),
  steel: new THREE.MeshStandardMaterial({ color: '#cfd4da', metalness: 1, roughness: 0.34 }),
  darkSteel: new THREE.MeshStandardMaterial({ color: '#8c939b', metalness: 1, roughness: 0.4 }),
  blackPlastic: new THREE.MeshStandardMaterial({ color: '#161718', roughness: 0.55 }),
  chip: new THREE.MeshStandardMaterial({ color: '#1b1c1e', roughness: 0.45 }),
  pcbEdge: new THREE.MeshPhysicalMaterial({ color: '#15171b', roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
  hole: new THREE.MeshBasicMaterial({ color: '#050505' }),
};

// ================================================================= DESK
{
  const tex = canvasTexture(1024, 1024, (g, w, h) => {
    g.fillStyle = '#21453d';
    g.fillRect(0, 0, w, h);
    noise(g, w, h, 9000, 0.05);
    noise(g, w, h, 9000, 0.08, false);
    for (let i = 0; i <= 10; i++) {
      const p = (i / 10) * w;
      g.strokeStyle = i % 5 === 0 ? 'rgba(220,240,230,0.30)' : 'rgba(220,240,230,0.14)';
      g.lineWidth = i % 5 === 0 ? 4 : 2;
      g.beginPath(); g.moveTo(p, 0); g.lineTo(p, h); g.stroke();
      g.beginPath(); g.moveTo(0, p); g.lineTo(w, p); g.stroke();
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16); // one tile = 100 mm, 10 mm grid
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 });
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), mat);
  desk.rotation.x = -Math.PI / 2;
  desk.position.y = -C.BREADBOARD.size.height;
  desk.receiveShadow = true;
  scene.add(desk);
}
const DESK_Y = -C.BREADBOARD.size.height;

// ================================================================= BREADBOARD
const BB = C.BREADBOARD.size;
const breadboard = new THREE.Group();
scene.add(breadboard);
{
  const L = BB.length, W = BB.width, H = BB.height;
  const groove = 2.6, grooveDepth = 1.8;
  const full = { x0: -L / 2, x1: L / 2, z0: -W / 2, z1: W / 2 };
  const S = 26; // px per mm
  const tex = canvasTexture(Math.round(L * S), Math.round(W * S), (g, w, h) => {
    const X = x => (x - full.x0) * S;
    const Z = z => (z - full.z0) * S;
    g.fillStyle = '#f4f3ee';
    g.fillRect(0, 0, w, h);
    noise(g, w, h, 30000, 0.035, false);
    // power rail stripes and polarity marks
    const xs = C.rowX(1) - 2.2, xe = C.rowX(30) + 2.2;
    for (const side of [1, -1]) {
      const minusZ = side * C.BREADBOARD.rails['N-'].z;
      const plusZ = side * C.BREADBOARD.rails['N+'].z;
      const blueZ = minusZ - side * 1.55;
      const redZ = plusZ + side * 1.55;
      g.lineWidth = 0.42 * S;
      g.strokeStyle = '#2f6fd6';
      g.beginPath(); g.moveTo(X(xs), Z(blueZ)); g.lineTo(X(xe), Z(blueZ)); g.stroke();
      g.strokeStyle = '#d93a32';
      g.beginPath(); g.moveTo(X(xs), Z(redZ)); g.lineTo(X(xe), Z(redZ)); g.stroke();
      g.font = `700 ${2.4 * S}px Arial, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (const x of [C.rowX(1) - 3.4, C.rowX(30) + 3.4]) {
        g.fillStyle = '#2f6fd6'; g.fillText('−', X(x), Z(minusZ));
        g.fillStyle = '#d93a32'; g.fillText('+', X(x), Z(plusZ));
      }
    }
    // holes
    const hole = (x, z) => {
      const cx = X(x), cz = Z(z), o = 0.78 * S, i = 0.5 * S;
      g.fillStyle = '#e1e0d8';
      g.beginPath(); g.roundRect(cx - o, cz - o, 2 * o, 2 * o, 0.25 * S); g.fill();
      const grad = g.createLinearGradient(0, cz - i, 0, cz + i);
      grad.addColorStop(0, '#0b0b0b');
      grad.addColorStop(1, '#3d3d3b');
      g.fillStyle = grad;
      g.fillRect(cx - i, cz - i, 2 * i, 2 * i);
    };
    for (let r = 1; r <= 30; r++) for (const c of C.BREADBOARD.columns) hole(C.rowX(r), C.columnZ(c));
    for (const rail of Object.keys(C.BREADBOARD.rails)) for (const r of C.BREADBOARD.railRows) {
      const p = C.holePosition(`${rail}${r}`);
      hole(p.x, p.z);
    }
    // row numbers and column letters
    g.fillStyle = '#5f646b';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `600 ${1.45 * S}px Arial, sans-serif`;
    for (let r = 1; r <= 30; r++) {
      g.fillText(String(r), X(C.rowX(r)), Z(C.columnZ('a') + 2.05));
      g.fillText(String(r), X(C.rowX(r)), Z(C.columnZ('j') - 2.05));
    }
    g.font = `700 ${1.7 * S}px Arial, sans-serif`;
    for (const c of C.BREADBOARD.columns) {
      g.fillText(c, X(C.rowX(1) - 2.7), Z(C.columnZ(c)));
      g.fillText(c, X(C.rowX(30) + 2.7), Z(C.columnZ(c)));
    }
  });
  const topMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
  const base = box(L, H - grooveDepth, W, MAT.boardPlastic, 0, -H / 2 - grooveDepth / 2, 0, 1.6);
  breadboard.add(base);
  const r = 0.5;
  for (const side of [1, -1]) {
    const z0 = side > 0 ? groove / 2 : -W / 2;
    const z1 = side > 0 ? W / 2 : -groove / 2;
    const slab = box(L, grooveDepth + 0.6, z1 - z0, MAT.boardPlastic, 0, -grooveDepth / 2 - 0.3, (z0 + z1) / 2, r);
    breadboard.add(slab);
    breadboard.add(topPlane(-L / 2 + r, L / 2 - r, z0 + r, z1 - r, 0.002, topMat, full));
  }
}

// ================================================================= ESP32 DEVKIT V1
const esp = new THREE.Group();
esp.position.set(C.rowX(C.ESP32_PLACEMENT.firstRow + 7), 0, 0); // pin index 7 (D25) at local x = 0
scene.add(esp);
const DEV = C.ESP32_DEVKIT_V1;
const HALF_SPAN = DEV.headerSpacing / 2; // 11.43 mm
const PCB_BOTTOM = 2.5; // male header plastic height
const PCB_TOP = PCB_BOTTOM + DEV.size.pcbThickness;
const pinLocalX = i => (i - 7) * PITCH;
const BOARD = (() => {
  const x0 = pinLocalX(0) - 7.4; // antenna end
  return { x0, x1: x0 + DEV.size.length, z0: -DEV.size.width / 2, z1: DEV.size.width / 2 };
})();
const MODULE = { x0: BOARD.x0 + 0.25, x1: BOARD.x0 + 0.25 + 25.5, z: 9 };
const SHIELD = { x0: MODULE.x0 + 6.9, x1: MODULE.x1 - 0.45, w: 16.6, h: 2.3 };
const PARTS = {
  usb: { x: BOARD.x1 - 1.5, z: 0 },
  en: { x: BOARD.x1 - 3.4, z: 7.9 },
  boot: { x: BOARD.x1 - 3.4, z: -7.9 },
  ams: { x: 12.9, z: 5.6 },
  cp: { x: 13.6, z: -5.2 },
  pwrLed: { x: 19.6, z: 4.9 },
  blueLed: { x: 19.6, z: -4.9 },
};
{
  const L = DEV.size.length, W = DEV.size.width;
  const cx = (BOARD.x0 + BOARD.x1) / 2;
  const pcb = box(L, DEV.size.pcbThickness, W, MAT.pcbEdge, cx, PCB_BOTTOM + DEV.size.pcbThickness / 2, 0, 0.45);
  esp.add(pcb);

  const S = 40;
  const tex = canvasTexture(Math.round(L * S), Math.round(W * S), (g, w, h) => {
    const X = x => (x - BOARD.x0) * S;
    const Z = z => (z - BOARD.z0) * S;
    g.fillStyle = '#14161a';
    g.fillRect(0, 0, w, h);
    noise(g, w, h, 16000, 0.03);
    // decorative copper traces under the solder mask
    g.strokeStyle = '#1e232b';
    g.lineWidth = 0.32 * S;
    g.lineCap = 'round';
    for (let i = 0; i < 15; i++) for (const side of [1, -1]) {
      const x = pinLocalX(i);
      g.beginPath();
      g.moveTo(X(x), Z(side * HALF_SPAN));
      g.lineTo(X(x), Z(side * (HALF_SPAN - 1.6)));
      g.lineTo(X(x + 1.2), Z(side * (HALF_SPAN - 2.8)));
      if (x > MODULE.x1 - 0.5) g.lineTo(X(x + 1.2), Z(side * (3 + (i % 4))));
      g.stroke();
    }
    // header pads
    for (let i = 0; i < 15; i++) for (const side of [1, -1]) {
      const x = X(pinLocalX(i)), z = Z(side * HALF_SPAN);
      g.fillStyle = '#d5ad5f';
      if (i === 0) g.fillRect(x - 0.85 * S, z - 0.85 * S, 1.7 * S, 1.7 * S);
      else { g.beginPath(); g.arc(x, z, 0.85 * S, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#6d5326';
      g.beginPath(); g.arc(x, z, 0.42 * S, 0, Math.PI * 2); g.fill();
    }
    // silkscreen pin names, outside the header rows so they stay visible
    g.fillStyle = '#f4f4f0';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 ${1.05 * S}px Arial, Helvetica, sans-serif`;
    DEV.leftHeader.forEach((n, i) => g.fillText(n, X(pinLocalX(i)), Z(HALF_SPAN + 1.8)));
    DEV.rightHeader.forEach((n, i) => g.fillText(n, X(pinLocalX(i)), Z(-HALF_SPAN - 1.8)));
    // mounting holes
    for (const [x, z] of [[BOARD.x0 + 2.4, 11.3], [BOARD.x0 + 2.4, -11.3], [BOARD.x1 - 2.4, 11.3], [BOARD.x1 - 2.4, -11.3]]) {
      g.fillStyle = '#d5ad5f'; g.beginPath(); g.arc(X(x), Z(z), 1.55 * S, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#060708'; g.beginPath(); g.arc(X(x), Z(z), 1.05 * S, 0, Math.PI * 2); g.fill();
    }
    // component outlines and labels
    g.strokeStyle = '#e9e9e4';
    g.lineWidth = 0.14 * S;
    const outline = (x, z, wx, wz) => g.strokeRect(X(x - wx / 2), Z(z - wz / 2), wx * S, wz * S);
    outline(PARTS.ams.x, PARTS.ams.z, 7.4, 6.8);
    outline(PARTS.cp.x, PARTS.cp.z, 6.0, 6.0);
    outline(PARTS.en.x, PARTS.en.z, 4.2, 3.8);
    outline(PARTS.boot.x, PARTS.boot.z, 4.2, 3.8);
    g.font = `700 ${0.95 * S}px Arial, sans-serif`;
    g.fillText('EN', X(PARTS.en.x - 3.4), Z(PARTS.en.z));
    g.fillText('BOOT', X(PARTS.boot.x - 3.9), Z(PARTS.boot.z));
    g.font = `700 ${0.75 * S}px Arial, sans-serif`;
    g.fillText('PWR', X(PARTS.pwrLed.x), Z(PARTS.pwrLed.z + 1.3));
    g.fillText('IO2', X(PARTS.blueLed.x), Z(PARTS.blueLed.z - 1.3));
    g.font = `700 ${1.2 * S}px Arial, sans-serif`;
    g.fillText('ESP32', X(5.6), Z(-0.9));
    g.font = `700 ${0.9 * S}px Arial, sans-serif`;
    g.fillText('DEVKIT V1', X(5.6), Z(0.75));
  });
  const topMat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.25 });
  esp.add(topPlane(BOARD.x0 + 0.45, BOARD.x1 - 0.45, BOARD.z0 + 0.45, BOARD.z1 - 0.45, PCB_TOP + 0.003, topMat, BOARD));

  // ---- male headers: black plastic spacer on the breadboard, gold pins, solder fillets
  const pinGeo = new THREE.BoxGeometry(0.64, 12.4, 0.64);
  const pins = new THREE.InstancedMesh(pinGeo, MAT.gold, 30);
  const filletGeo = new THREE.CylinderGeometry(0.34, 0.72, 0.55, 20);
  const fillets = new THREE.InstancedMesh(filletGeo, MAT.tin, 30);
  const m = new THREE.Matrix4();
  let k = 0;
  for (const side of [1, -1]) {
    esp.add(box(15 * PITCH, PCB_BOTTOM, PITCH * 0.98, MAT.blackPlastic, 0, PCB_BOTTOM / 2, side * HALF_SPAN, 0.2));
    for (let i = 0; i < 15; i++, k++) {
      m.makeTranslation(pinLocalX(i), -6.8 + 12.4 / 2, side * HALF_SPAN);
      pins.setMatrixAt(k, m);
      m.makeTranslation(pinLocalX(i), PCB_TOP + 0.27, side * HALF_SPAN);
      fillets.setMatrixAt(k, m);
    }
  }
  esp.add(pins, fillets);

  // ---- ESP32-WROOM-32 module
  const modL = MODULE.x1 - MODULE.x0;
  const modTex = canvasTexture(Math.round(modL * S), Math.round(18 * S), (g, w, h) => {
    g.fillStyle = '#1a1d23';
    g.fillRect(0, 0, w, h);
    noise(g, w, h, 4000, 0.04);
    // meandered inverted-F PCB antenna
    g.strokeStyle = '#7a6a3c';
    g.lineWidth = 0.55 * S;
    g.lineJoin = 'round';
    const ax = mm => mm * S;
    g.beginPath();
    g.moveTo(ax(6.4), ax(15.5));
    g.lineTo(ax(1.2), ax(15.5));
    g.lineTo(ax(1.2), ax(2.6));
    let up = true;
    for (let zz = 2.6; zz < 15; zz += 2.1) {
      g.lineTo(ax(up ? 4.6 : 1.2), ax(zz));
      g.lineTo(ax(up ? 4.6 : 1.2), ax(zz + 2.1));
      up = !up;
    }
    g.stroke();
    g.fillStyle = '#e8e8e2';
    g.font = `700 ${0.7 * S}px Arial, sans-serif`;
    g.fillText('ESP32-WROOM-32', ax(7.5), ax(17.2));
  });
  const modMat = new THREE.MeshPhysicalMaterial({ map: modTex, roughness: 0.4, clearcoat: 0.4 });
  const modBody = box(modL, 0.8, 18, MAT.pcbEdge, (MODULE.x0 + MODULE.x1) / 2, PCB_TOP + 0.4, 0, 0.15);
  esp.add(modBody);
  esp.add(topPlane(MODULE.x0 + 0.15, MODULE.x1 - 0.15, -8.85, 8.85, PCB_TOP + 0.803, modMat,
    { x0: MODULE.x0, x1: MODULE.x1, z0: -9, z1: 9 }));

  const shL = SHIELD.x1 - SHIELD.x0;
  const shTex = canvasTexture(Math.round(shL * S), Math.round(SHIELD.w * S), (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#d3d7dc');
    grad.addColorStop(1, '#bfc4ca');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`;
      g.fillRect(Math.random() * w, Math.random() * h, Math.random() * 30, 1);
    }
    g.fillStyle = '#4b5057';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    const t = (s, x, z, size, weight = 700) => { g.font = `${weight} ${size * S}px Arial, sans-serif`; g.fillText(s, x * S, z * S); };
    // simple Espressif-style swirl
    g.strokeStyle = '#4b5057';
    g.lineWidth = 0.32 * S;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(3.2 * S, 3.6 * S, (0.7 + i * 0.75) * S, -1.2, 1.9); g.stroke(); }
    t('ESP-WROOM-32', 5.4, 3.6, 1.45);
    t('FCC ID: 2AC7Z-ESPWROOM32', 2.0, 7.4, 0.85, 600);
    t('211-161007', 2.0, 8.9, 0.85, 600);
    t('CE', 2.0, 11.4, 1.6, 800);
    g.strokeRect(5.6 * S, 10.3 * S, 2.6 * S, 2.2 * S);
    t('R', 6.35, 11.45, 1.4, 800);
    g.fillStyle = '#5a6068';
    g.beginPath(); g.arc((shL - 2) * S, (SHIELD.w - 2) * S, 0.5 * S, 0, Math.PI * 2); g.fill();
  });
  const shieldMat = new THREE.MeshStandardMaterial({ color: '#d6dade', metalness: 1, roughness: 0.33 });
  const shieldTopMat = new THREE.MeshStandardMaterial({ map: shTex, metalness: 0.95, roughness: 0.36 });
  const shieldY0 = PCB_TOP + 0.8;
  esp.add(box(shL, SHIELD.h, SHIELD.w, shieldMat, (SHIELD.x0 + SHIELD.x1) / 2, shieldY0 + SHIELD.h / 2, 0, 0.25));
  esp.add(topPlane(SHIELD.x0 + 0.25, SHIELD.x1 - 0.25, -SHIELD.w / 2 + 0.25, SHIELD.w / 2 - 0.25, shieldY0 + SHIELD.h + 0.002, shieldTopMat,
    { x0: SHIELD.x0, x1: SHIELD.x1, z0: -SHIELD.w / 2, z1: SHIELD.w / 2 }));

  // castellated module pads + solder
  const padGeo = new THREE.BoxGeometry(0.7, 0.6, 0.25);
  const padSolderGeo = new THREE.BoxGeometry(0.75, 0.22, 0.6);
  const pads = new THREE.InstancedMesh(padGeo, MAT.gold, 38);
  const padSolder = new THREE.InstancedMesh(padSolderGeo, MAT.tin, 38);
  const q = new THREE.Quaternion();
  const s1 = new THREE.Vector3(1, 1, 1);
  let n = 0;
  for (const side of [1, -1]) for (let i = 0; i < 14; i++, n++) {
    const x = MODULE.x1 - 1.0 - i * 1.27;
    m.compose(v3(x, PCB_TOP + 0.4, side * 8.98), q, s1); pads.setMatrixAt(n, m);
    m.compose(v3(x, PCB_TOP + 0.11, side * 9.2), q, s1); padSolder.setMatrixAt(n, m);
  }
  const qy = new THREE.Quaternion().setFromAxisAngle(v3(0, 1, 0), Math.PI / 2);
  for (let i = 0; i < 10; i++, n++) {
    const z = -5.7 + i * 1.27;
    m.compose(v3(MODULE.x1 - 0.02, PCB_TOP + 0.4, z), qy, s1); pads.setMatrixAt(n, m);
    m.compose(v3(MODULE.x1 + 0.2, PCB_TOP + 0.11, z), qy, s1); padSolder.setMatrixAt(n, m);
  }
  esp.add(pads, padSolder);

  // micro-USB receptacle
  const usb = box(5.2, 2.7, 7.6, MAT.steel, PARTS.usb.x, PCB_TOP + 1.35, 0, 0.45);
  esp.add(usb);
  esp.add(box(0.4, 1.7, 6.4, MAT.hole, PARTS.usb.x + 2.45, PCB_TOP + 1.4, 0));
  esp.add(box(0.5, 0.5, 4.6, MAT.blackPlastic, PARTS.usb.x + 2.5, PCB_TOP + 1.5, 0));
  for (const side of [1, -1]) esp.add(box(1.6, 0.6, 1.2, MAT.tin, PARTS.usb.x - 0.8, PCB_TOP + 0.3, side * 4.2));

  // EN and BOOT tactile switches
  for (const p of [PARTS.en, PARTS.boot]) {
    esp.add(box(3.6, 1.1, 3.2, MAT.steel, p.x, PCB_TOP + 0.55, p.z, 0.2));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.7, 24), MAT.blackPlastic);
    cap.position.set(p.x, PCB_TOP + 1.45, p.z);
    esp.add(cap);
    for (const dx of [-1.9, 1.9]) for (const dz of [-1.1, 1.1]) esp.add(box(0.6, 0.3, 0.6, MAT.tin, p.x + dx, PCB_TOP + 0.15, p.z + dz));
  }
  // AMS1117-3.3 regulator (SOT-223): tab toward the board centre
  esp.add(box(6.5, 1.6, 3.5, MAT.chip, PARTS.ams.x, PCB_TOP + 0.85, PARTS.ams.z + 0.6, 0.12));
  esp.add(box(3.0, 0.22, 1.6, MAT.tin, PARTS.ams.x, PCB_TOP + 0.11, PARTS.ams.z - 1.9));
  for (const dx of [-2.3, 0, 2.3]) esp.add(box(0.7, 0.22, 1.4, MAT.tin, PARTS.ams.x + dx, PCB_TOP + 0.11, PARTS.ams.z + 2.9));
  // CP2102 USB-to-serial (QFN)
  esp.add(box(5, 0.9, 5, MAT.chip, PARTS.cp.x, PCB_TOP + 0.45, PARTS.cp.z, 0.1));
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16), new THREE.MeshStandardMaterial({ color: '#555' }));
  dot.rotation.x = -Math.PI / 2;
  dot.position.set(PARTS.cp.x - 1.8, PCB_TOP + 0.91, PARTS.cp.z - 1.8);
  esp.add(dot);
  // small passives scattered like on the real board
  const passives = [[9.4, 3.2, 0], [9.4, -2.6, 0], [10.8, 0.4, 1], [17.4, 1.6, 0], [17.4, -1.6, 0], [20.6, 0.9, 1],
    [4.6, 6.8, 1], [4.6, -6.8, 1], [2.1, 8.2, 0], [2.1, -8.2, 0], [16.8, 8.5, 0], [16.8, -8.6, 0], [7.6, 5.3, 1], [7.6, -5.0, 1]];
  const capMat = new THREE.MeshStandardMaterial({ color: '#b48d62', roughness: 0.5 });
  passives.forEach(([x, z, rot], i) => {
    const g = new THREE.Group();
    g.add(box(1.6, 0.5, 0.8, i % 3 === 0 ? capMat : MAT.chip, 0, 0.25, 0));
    g.add(box(0.3, 0.52, 0.82, MAT.tin, -0.72, 0.26, 0));
    g.add(box(0.3, 0.52, 0.82, MAT.tin, 0.72, 0.26, 0));
    g.position.set(x, PCB_TOP, z);
    g.rotation.y = rot ? Math.PI / 2 : 0;
    esp.add(g);
  });
  // diode near VIN
  esp.add(box(2.7, 1.1, 1.6, MAT.chip, 16.9, PCB_TOP + 0.55, 6.6, 0.15));
  esp.add(box(0.35, 1.12, 1.62, new THREE.MeshStandardMaterial({ color: '#cfcfcf' }), 16.0, PCB_TOP + 0.56, 6.6));
}
// On-board LEDs (power = red, GPIO2 = blue)
function smdLed(p, color) {
  const g = new THREE.Group();
  g.add(box(1.6, 0.35, 0.8, new THREE.MeshStandardMaterial({ color: '#efe9da', roughness: 0.4 }), 0, 0.17, 0));
  const lensMat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.2, transmission: 0.2, emissive: color, emissiveIntensity: 0 });
  g.add(box(1.0, 0.3, 0.7, lensMat, 0, 0.48, 0));
  g.position.set(p.x, PCB_TOP, p.z);
  esp.add(g);
  return lensMat;
}
const powerLedMat = smdLed(PARTS.pwrLed, '#ff2a1f');
smdLed(PARTS.blueLed, '#2f6bff');

// ================================================================= RESISTOR 330 Ω
const RES_SPAN = C.holePosition(C.LESSON01.resistor.leads[1]).x - C.holePosition(C.LESSON01.resistor.leads[0]).x;
const RES_BODY_Y = 2.5;
const resistor = new THREE.Group();
scene.add(resistor);
{
  const profile = [];
  const N = 90;
  for (let i = 0; i <= N; i++) {
    const y = -3 + (6 * i) / N;
    const t = Math.abs(y);
    let r;
    if (t < 1.35) r = 0.98;
    else if (t < 1.9) { const s = (t - 1.35) / 0.55; r = 0.98 + 0.17 * s * s * (3 - 2 * s); }
    else if (t < 2.62) r = 1.15;
    else r = Math.max(0.3, 1.15 * Math.sqrt(Math.max(0, 1 - ((t - 2.62) / 0.4) ** 2)));
    profile.push(new THREE.Vector2(r, y));
  }
  const bandColors = { orange: '#e8701a', brown: '#6a3a1c', gold: '#d3a742' };
  const bands = [[-2.48, -1.98, 'orange'], [-1.6, -1.1, 'orange'], [-0.75, -0.25, 'brown'], [1.75, 2.25, 'gold']];
  const tex = canvasTexture(64, 1024, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#cdb489');
    grad.addColorStop(0.5, '#dcc59b');
    grad.addColorStop(1, '#cdb489');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    noise(g, w, h, 1500, 0.08, false);
    // v = 0 at y = -3 → canvas bottom (flipY)
    for (const [a, b, c] of bands) {
      g.fillStyle = bandColors[c];
      g.fillRect(0, h * (1 - (b + 3) / 6), w, h * ((b - a) / 6));
    }
  });
  const metalTex = canvasTexture(16, 1024, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const [a, b] = bands[3];
    g.fillStyle = '#fff'; g.fillRect(0, h * (1 - (b + 3) / 6), w, h * ((b - a) / 6));
  }, { color: false });
  const bodyGeo = new THREE.LatheGeometry(profile, 40);
  bodyGeo.rotateZ(-Math.PI / 2); // axis along +X; band 1 (y = -3) ends up at -X
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ map: tex, metalnessMap: metalTex, metalness: 0.9, roughness: 0.48 }));
  body.position.y = RES_BODY_Y;
  resistor.add(body);
  const h = RES_SPAN / 2;
  for (const s of [-1, 1]) {
    const path = roundedPath([v3(s * 2.9, RES_BODY_Y, 0), v3(s * h, RES_BODY_Y, 0), v3(s * h, -6.5, 0)], 0.9);
    resistor.add(new THREE.Mesh(new THREE.TubeGeometry(path, 48, 0.3, 10), MAT.tin));
  }
}
const resStart = C.holePosition(C.LESSON01.resistor.leads[0]);
const RES_FINAL = { pos: v3(resStart.x + RES_SPAN / 2, 0, resStart.z), quat: new THREE.Quaternion() };
const RES_DESK = {
  pos: v3(-2, DESK_Y + 1.15, 40 - RES_BODY_Y),
  quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0.12)),
};

// ================================================================= LED (5 mm, red)
const ledGroup = new THREE.Group();
scene.add(ledGroup);
const LED_LIFT = 5.5; // flange bottom above the breadboard when inserted
const epoxy = new THREE.MeshPhysicalMaterial({
  color: '#e3141c', roughness: 0.08, transmission: 0.32, thickness: 3.5, ior: 1.5,
  attenuationColor: new THREE.Color('#d10a10'), attenuationDistance: 2.2, clearcoat: 1, clearcoatRoughness: 0.08,
  emissive: new THREE.Color('#ff1206'), emissiveIntensity: 0, transparent: true, opacity: 0.96,
});
const ledLight = new THREE.PointLight('#ff3020', 0, 45, 2);
{
  const inner = new THREE.Group();
  inner.position.y = LED_LIFT;
  ledGroup.add(inner);
  // rim with a flat on the cathode (+X) side
  const R = 2.9, flatX = 2.45, a0 = Math.acos(flatX / R);
  const shape = new THREE.Shape();
  shape.absarc(0, 0, R, a0, Math.PI * 2 - a0, false);
  shape.lineTo(flatX, R * Math.sin(a0));
  const flange = new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 48 });
  flange.rotateX(-Math.PI / 2);
  inner.add(new THREE.Mesh(flange, epoxy));
  const pts = [v3(0, 0.9, 0), v3(2.5, 0.9, 0), v3(2.5, 6.1, 0)];
  for (let i = 1; i <= 24; i++) {
    const a = (i / 24) * (Math.PI / 2);
    pts.push(v3(2.5 * Math.cos(a), 6.1 + 2.5 * Math.sin(a), 0));
  }
  inner.add(new THREE.Mesh(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(Math.max(p.x, 0.001), p.y)), 48), epoxy));
  // lead frame inside the epoxy: anode post (−X) and cathode anvil (+X)
  const frame = new THREE.MeshStandardMaterial({ color: '#b9bec4', metalness: 1, roughness: 0.35 });
  inner.add(box(0.45, 4.2, 0.45, frame, -1.27, 2.1, 0));
  inner.add(box(0.45, 3.2, 0.45, frame, 1.27, 1.6, 0));
  inner.add(box(1.7, 1.1, 0.5, frame, 0.75, 3.7, 0));
  const die = box(0.35, 0.2, 0.35, new THREE.MeshStandardMaterial({ color: '#ffd0c0', emissive: '#ff5030', emissiveIntensity: 0 }), 0.6, 4.35, 0);
  inner.add(die);
  ledGroup.userData.die = die;
  const bond = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(v3(0.6, 4.4, 0), v3(-0.4, 5.6, 0), v3(-1.27, 4.2, 0)), 16, 0.04, 6);
  inner.add(new THREE.Mesh(bond, frame));
  ledLight.position.set(0, 6.2, 0);
  inner.add(ledLight);
  // legs: anode longer than cathode (14 mm vs 12 mm below the rim)
  const legMat = MAT.tin;
  ledGroup.add(box(0.5, 14, 0.5, legMat, -1.27, LED_LIFT - 7, 0));
  ledGroup.add(box(0.5, 12, 0.5, legMat, 1.27, LED_LIFT - 6, 0));
}
const ledAnode = C.holePosition(C.LESSON01.led.anode);
const ledCathode = C.holePosition(C.LESSON01.led.cathode);
const LED_FINAL = { pos: v3((ledAnode.x + ledCathode.x) / 2, 0, ledAnode.z), quat: new THREE.Quaternion() };
const LED_DESK = {
  // Lying on its side on the mat: the LED axis is horizontal at rim height, legs toward +X.
  pos: v3(22, DESK_Y + 2.9, 36),
  quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -0.35, Math.PI / 2, 'YXZ')),
};

// Soft additive halo used for lit LEDs (cheaper and more controllable than bloom).
const haloTexture = canvasTexture(256, 256, (g, w) => {
  const grad = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  grad.addColorStop(0, 'rgba(255,70,50,1)');
  grad.addColorStop(0.2, 'rgba(255,30,18,0.6)');
  grad.addColorStop(0.5, 'rgba(255,14,8,0.18)');
  grad.addColorStop(1, 'rgba(255,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, w);
});
function halo(size, opacity) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity, toneMapped: false }));
  sp.scale.set(size, size, 1);
  sp.visible = false;
  return sp;
}
const ledHalo = halo(34, 0.95);
ledHalo.renderOrder = 5;
ledHalo.position.set(0, LED_LIFT + 6.4, 0);
ledGroup.add(ledHalo);
const powerHalo = halo(7, 0.9);
powerHalo.position.set(esp.position.x + PARTS.pwrLed.x, PCB_TOP + 0.9, PARTS.pwrLed.z);
scene.add(powerHalo);

// ================================================================= JUMPER WIRES
const WIRE_COLORS = { yellow: '#f5c518', black: '#25272b' };
function makeWire(spec, controlPoints) {
  const A = C.holePosition(spec.from), B = C.holePosition(spec.to);
  const pts = [v3(A.x, 1.7, A.z), ...controlPoints.map(p => v3(...p)), v3(B.x, 1.7, B.z)];
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const insulation = new THREE.MeshPhysicalMaterial({ color: WIRE_COLORS[spec.color], roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.35 });
  const geo = new THREE.TubeGeometry(curve, 160, 0.78, 14, false);
  const tube = new THREE.Mesh(geo, insulation);
  const group = new THREE.Group();
  group.add(tube);
  const ends = [A, B].map(H => {
    const g = new THREE.Group();
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 7.2, 12), MAT.tin);
    pin.position.set(H.x, 1.8 - 3.6, H.z);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.84, 1.3, 18), insulation);
    sleeve.position.set(H.x, 1.7 + 0.45, H.z);
    g.add(pin, sleeve);
    group.add(g);
    return g;
  });
  scene.add(group);
  const total = geo.index.count;
  return {
    group,
    set(p) {
      group.visible = p > 0;
      geo.setDrawRange(0, Math.floor((total * clamp01(p)) / 6) * 6);
      ends[1].visible = p >= 0.995;
    },
  };
}
const xr = r => C.rowX(r);
const zA = C.columnZ('a');
const wireSpecs = Object.fromEntries(C.LESSON01.wires.map(w => [w.id, w]));
const wires = {
  // a11 sits right at the edge of the ESP32 board, so the wire leaves the hole outward first.
  signal: makeWire(wireSpecs.signal, [[xr(11), 2.2, zA + 1.1], [xr(11) + 0.6, 4.6, zA + 3.6], [xr(17.5), 11.5, zA + 6.2], [xr(24) - 0.8, 6.5, zA + 3.2], [xr(24), 3.0, zA + 0.6]]),
  gndBoard: makeWire(wireSpecs.gndBoard, [[xr(17), 2.2, zA + 1.1], [xr(16.6), 5.2, zA + 3.2], [xr(15), 6.0, zA + 5.2], [xr(14.15), 3.2, zA + 5.75]]),
  gndLed: makeWire(wireSpecs.gndLed, [[xr(29), 3.4, zA + 0.4], [xr(28.4), 6.6, zA + 2.6], [xr(26.8), 6.4, zA + 5.0], [xr(26.1), 3.2, zA + 5.75]]),
};

// ================================================================= USB CABLE (final step)
const usbPlug = new THREE.Group();
scene.add(usbPlug);
{
  const tipX = esp.position.x + PARTS.usb.x + 2.6; // receptacle mouth (world)
  const y = PCB_TOP + 1.4;
  usbPlug.add(box(4.6, 1.8, 6.8, MAT.steel, tipX - 1.4, y, 0, 0.3));
  const moldMat = new THREE.MeshStandardMaterial({ color: '#1c1d1f', roughness: 0.5 });
  usbPlug.add(box(10.5, 4.4, 8.8, moldMat, tipX + 6.0, y, 0, 1.4));
  const cable = new THREE.CatmullRomCurve3([
    v3(tipX + 10.5, y, 0), v3(tipX + 14.5, y + 0.4, -1.5), v3(tipX + 17, y + 0.5, -8), v3(tipX + 19, y - 1, -22),
    v3(tipX + 24, DESK_Y + 6, -38), v3(tipX + 30, DESK_Y + 1.6, -60), v3(tipX + 60, DESK_Y + 1.6, -140),
  ], false, 'centripetal');
  usbPlug.add(new THREE.Mesh(new THREE.TubeGeometry(cable, 200, 1.6, 16), moldMat));
  usbPlug.userData.tipX = tipX;
}

// ================================================================= highlights + labels
const ringMat = new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false });
function ring(x, y, z, r = 1.35) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.17, 10, 40), ringMat);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  m.renderOrder = 2;
  scene.add(m);
  return m;
}
const pinWorld = (name, header = 'left') => {
  const p = C.holePosition(C.esp32PinHole(name, header));
  return v3(p.x, PCB_TOP + 1.3, p.z);
};
const holeWorld = id => { const p = C.holePosition(id); return v3(p.x, 0.05, p.z); };
const rings = {
  d25: ring(...pinWorld('D25').toArray(), 1.1),
  a11: ring(...holeWorld('a11').toArray()),
  a24: ring(...holeWorld('a24').toArray()),
  c24: ring(...holeWorld('c24').toArray()),
  c28: ring(...holeWorld('c28').toArray()),
  e28: ring(...holeWorld('e28').toArray()),
  e29: ring(...holeWorld('e29').toArray()),
  gnd: ring(...pinWorld('GND').toArray(), 1.1),
  a17: ring(...holeWorld('a17').toArray()),
  a29: ring(...holeWorld('a29').toArray()),
};

function label(html, anchor, parent = scene, cls = '') {
  const el = document.createElement('div');
  el.className = `tag ${cls}`;
  el.innerHTML = html;
  const obj = new CSS2DObject(el);
  obj.position.copy(anchor);
  const centers = { left: [1, 0.5], right: [0, 0.5], below: [0.5, 0] };
  const [cx, cy] = centers[cls.split(' ').find(c => centers[c])] || [0.5, 1];
  obj.center.set(cx, cy);
  el.style.margin = cls.includes('left') ? '0 0 0 -9px' : cls.includes('right') ? '0 0 0 9px' : cls.includes('below') ? '9px 0 0 0' : '-9px 0 0 0';
  parent.add(obj);
  return obj;
}
const labels = {
  esp: label('ESP32 DevKit V1', v3(esp.position.x - 9, PCB_TOP + 3.4, -4)),
  bb: label('Breadboard', v3(C.rowX(26), 0, C.columnZ('h')), scene, 'below'),
  res: label('<b>330 Ω</b><span class="xl"> resistor</span>', v3(0, RES_BODY_Y + 1.3, 0), resistor),
  led: label('Red LED', v3(0, LED_LIFT + 8.8, 0), ledGroup),
  gpio: label('<b>GPIO25</b> · pin D25', pinWorld('D25').add(v3(0, 0.6, 0)), scene, 'signal'),
  a11: label('a11', holeWorld('a11'), scene, 'below'),
  a24: label('a24', holeWorld('a24'), scene, 'below'),
  anode: label('<b>Anode +</b><span class="xl"> (long leg)</span>', v3(-1.6, 2.6, 0), ledGroup, 'left'),
  cathode: label('<b>Cathode −</b><span class="xl"> (flat side)</span>', v3(1.27, 0.4, 0.6), ledGroup, 'below'),
  gnd: label('<b>GND</b> pin', pinWorld('GND').add(v3(0, 0.6, 0)), scene, 'gnd'),
  rail: label('Blue <b>−</b> rail = GND', holeWorld('N-23'), scene, 'below gnd'),
  usb: label('USB cable<span class="xl"> (power + code)</span>', v3(usbPlug.userData.tipX + 18.5, PCB_TOP + 1.5, -16)),
};
labels.usb.removeFromParent();
usbPlug.add(labels.usb);

// ================================================================= lesson steps
const STEPS = [
  {
    title: 'Meet the parts',
    text: 'Here is your kit. The ESP32 DevKit V1 is already pushed into the breadboard, with one row of pins on each side of the middle gap. In front of the breadboard are a 330 Ω resistor and a red LED. We will add jumper wires as we go.',
    why: 'A breadboard joins parts without soldering. In each numbered row, holes a–e are connected by a metal clip under the plastic, and holes f–j by another clip.',
    labels: ['esp', 'bb', 'res', 'led'], rings: [], code: [], duration: 900,
    desc: 'ESP32 DevKit V1 straddling the centre gap of a breadboard, rows 4 to 18. A 330 ohm resistor and a red LED lie on the desk in front.',
  },
  {
    title: 'Find GPIO25 (pin D25)',
    text: 'Find the pin labelled D25 on the board: row 11, on the side nearest you. Holes a11 to e11 are all connected to it, and a11 is the one hole the board does not cover. A yellow jumper wire goes from a11 to a24.',
    why: 'GPIO25 is a pin your code can switch HIGH (about 3.3 volts) or LOW (0 volts). The wire carries that signal to row 24, where there is room to build.',
    labels: ['gpio', 'a11', 'a24'], rings: ['d25', 'a11', 'a24'], code: [3], duration: 1800,
    desc: 'Pin D25, which is GPIO25, sits in hole b11. A yellow wire runs from hole a11 to hole a24.',
  },
  {
    title: 'Add the 330 Ω resistor',
    text: 'Push the resistor’s legs into holes c24 and c28. Its colour bands read orange, orange, brown, gold: 3, 3, then ×10 = 330 Ω. Gold means ±5%. A resistor works either way round.',
    why: 'The resistor limits the current. A red LED needs about 2 V, so roughly (3.3 V − 2 V) ÷ 330 Ω ≈ 4 mA flows. That is safe for both the LED and the ESP32 pin.',
    labels: ['res'], rings: ['c24', 'c28'], code: [], duration: 2000,
    desc: 'The 330 ohm resistor goes from hole c24 to hole c28. Row 24 already connects to GPIO25.',
  },
  {
    title: 'Place the LED',
    text: 'Put the LED’s long leg (anode, +) in e28, the same row as the resistor’s second leg. Put the short leg (cathode, −) in e29. The rim of the LED is flat on the cathode side.',
    why: 'An LED only lets current flow one way: in through the anode, out through the cathode. If it is in backwards it simply stays dark.',
    labels: ['anode', 'cathode'], rings: ['e28', 'e29'], code: [], duration: 2000,
    desc: 'LED anode, the long leg, in hole e28. LED cathode, the short leg next to the flat side, in hole e29.',
  },
  {
    title: 'Complete the path to GND',
    text: 'Two black wires finish the loop. One goes from a29 (the LED cathode’s row) to the blue − rail. The other goes from the blue − rail back to a17, the row of the board’s GND pin.',
    why: 'Electricity needs a complete loop. It leaves GPIO25, flows through the resistor and the LED, and returns to the ESP32 through GND (0 volts).',
    labels: ['cathode', 'gnd', 'rail'], rings: ['gnd', 'a17', 'a29'], code: [], duration: 2200,
    desc: 'Black wire from hole a29 to the blue minus rail. Black wire from the blue minus rail to hole a17, next to the GND pin in b17.',
  },
  {
    title: 'Run the code',
    text: 'Plug in the USB cable: the red PWR light on the board turns on. Then run main.py. GPIO25 switches HIGH for 1 second, then LOW for 1 second, again and again.',
    why: 'led.value(1) puts 3.3 V on GPIO25 and the LED lights; led.value(0) makes it 0 V and the LED goes dark. "while True" repeats forever. This is a simulation: ask an adult to check the real wiring before plugging in.',
    labels: ['gpio', 'usb'], rings: [], code: [], duration: 1400,
    desc: 'USB cable plugged in, power light on. The LED blinks: on for one second, off for one second.',
  },
];

const ui = {
  title: document.getElementById('stepTitle'),
  text: document.getElementById('stepText'),
  why: document.getElementById('why'),
  progress: document.getElementById('progress'),
  bar: document.getElementById('bar'),
  back: document.getElementById('back'),
  next: document.getElementById('next'),
  desc: document.getElementById('sceneDesc'),
  signal: document.getElementById('signal'),
  signalValue: document.querySelector('#signal .v'),
  codeLines: [...document.querySelectorAll('#code [data-l]')],
};
let step = 0;
let stepStart = performance.now();

function updateUI() {
  const s = STEPS[step];
  ui.title.textContent = s.title;
  ui.text.textContent = s.text;
  ui.why.textContent = s.why;
  ui.progress.textContent = `Step ${step + 1} of ${STEPS.length}`;
  ui.bar.style.width = `${((step + 1) / STEPS.length) * 100}%`;
  ui.back.disabled = step === 0;
  ui.next.disabled = step === STEPS.length - 1;
  const reducedNote = step === STEPS.length - 1 && reducedMotion;
  ui.desc.textContent = `Step ${step + 1}: ${reducedNote ? s.desc.replace(/The LED blinks.*$/, 'Reduced motion is on, so the LED is shown steadily on instead of blinking.') : s.desc}`;
  const narrow = host.clientWidth < 520;
  for (const [k, obj] of Object.entries(labels)) obj.visible = s.labels.includes(k) && !(narrow && (s.narrowHide || []).includes(k));
  for (const [k, m] of Object.entries(rings)) m.visible = s.rings.includes(k);
  ui.signal.style.display = step === STEPS.length - 1 ? 'block' : 'none';
}
function goTo(i) {
  step = Math.max(0, Math.min(STEPS.length - 1, i));
  stepStart = performance.now();
  updateUI();
}

function placePart(obj, desk, final, p) {
  if (p <= 0) { obj.position.copy(desk.pos); obj.quaternion.copy(desk.quat); return; }
  if (p >= 1) { obj.position.copy(final.pos); obj.quaternion.copy(final.quat); return; }
  const hover = final.pos.clone().add(v3(0, 20, 0));
  if (p < 0.55) {
    const t = ease(p / 0.55);
    obj.position.lerpVectors(desk.pos, hover, t);
    obj.position.y += Math.sin(t * Math.PI) * 10;
    obj.quaternion.slerpQuaternions(desk.quat, final.quat, t);
  } else {
    const t = ease((p - 0.55) / 0.45);
    obj.position.lerpVectors(hover, final.pos, t);
    obj.quaternion.copy(final.quat);
  }
}

let ledOn = false;
const LED_GLOW = { epoxy: 1.45, die: 10, light: 9 };
function applyScene(now) {
  const p = reducedMotion ? 1 : clamp01((now - stepStart) / STEPS[step].duration);
  const at = (i, local = p) => (step > i ? 1 : step === i ? local : 0);
  wires.signal.set(at(1, ease(p)));
  placePart(resistor, RES_DESK, RES_FINAL, at(2));
  placePart(ledGroup, LED_DESK, LED_FINAL, at(3));
  wires.gndBoard.set(at(4, ease(clamp01(p * 2))));
  wires.gndLed.set(at(4, ease(clamp01(p * 2 - 1))));

  const last = STEPS.length - 1;
  usbPlug.visible = step === last;
  const plug = step === last ? ease(clamp01(p / 0.7)) : 0;
  usbPlug.position.x = (1 - plug) * 22;
  const powered = step === last && plug >= 1;
  powerLedMat.emissiveIntensity = powered ? 3 : 0;
  powerHalo.visible = powered;

  let high = false;
  if (powered) {
    if (reducedMotion) high = true;
    else {
      const t = (now - stepStart) / 1000 - STEPS[last].duration / 1000 - 0.3;
      high = t >= 0 && Math.floor(t) % 2 === 0;
    }
  }
  if (high !== ledOn || ui.signal.dataset.powered !== String(powered)) {
    ledOn = high;
    ui.signal.dataset.powered = String(powered);
    epoxy.emissiveIntensity = high ? LED_GLOW.epoxy : 0;
    ledGroup.userData.die.material.emissiveIntensity = high ? LED_GLOW.die : 0;
    ledLight.intensity = high ? LED_GLOW.light : 0;
    ledHalo.visible = high;
    ui.signal.classList.toggle('on', high);
    ui.signalValue.textContent = !powered ? 'no power' : high ? 'HIGH (3.3 V) · LED on' : 'LOW (0 V) · LED off';
    const active = step === last && powered ? (high ? [5] : [7]) : STEPS[step].code;
    ui.codeLines.forEach(l => l.classList.toggle('hl', active.includes(Number(l.dataset.l))));
  }
  if (!powered && step !== last) {
    const active = STEPS[step].code;
    ui.codeLines.forEach(l => l.classList.toggle('hl', active.includes(Number(l.dataset.l))));
  }
  ringMat.opacity = reducedMotion ? 0.95 : 0.55 + 0.4 * (0.5 + 0.5 * Math.sin(now / 260));
}

// ================================================================= camera framing
// Frame the breadboard plus the spot on the desk where the loose parts wait.
const FIT_POINTS = [];
for (const x of [-42.5, 42.5]) for (const y of [DESK_Y, 12]) for (const z of [-28, 28]) FIT_POINTS.push(v3(x, y, z));
for (const x of [-12, 34]) for (const z of [30, 42]) FIT_POINTS.push(v3(x, DESK_Y, z));
const FIT_CENTER = v3(0, -2, 6);
let VIEW_DIR = v3(0.16, 1.0, 1.05).normalize();
function fitCamera() {
  // Portrait screens get a steeper, more top-down view so the board uses more of the height.
  VIEW_DIR = camera.aspect < 1 ? v3(0.1, 1.55, 1.0).normalize() : v3(0.16, 1.0, 1.05).normalize();
  let lo = 20, hi = 3000;
  const tmp = new THREE.Vector3();
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    camera.position.copy(FIT_CENTER).addScaledVector(VIEW_DIR, mid);
    camera.lookAt(FIT_CENTER);
    camera.updateMatrixWorld();
    const ok = FIT_POINTS.every(pt => { tmp.copy(pt).project(camera); return Math.abs(tmp.x) <= 0.97 && Math.abs(tmp.y) <= 0.95; });
    if (ok) hi = mid; else lo = mid;
  }
  camera.position.copy(FIT_CENTER).addScaledVector(VIEW_DIR, hi);
  controls.target.copy(FIT_CENTER);
  controls.update();
  controls.saveState();
}

scene.traverse(o => {
  if (o.isMesh && o.material !== ringMat) { o.castShadow = true; o.receiveShadow = true; }
});

function resize() {
  const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  fitCamera();
  updateUI();
}
new ResizeObserver(resize).observe(host);
resize();

// ================================================================= input
document.getElementById('back').addEventListener('click', () => goTo(step - 1));
document.getElementById('next').addEventListener('click', () => goTo(step + 1));
document.getElementById('replay').addEventListener('click', () => goTo(step));
document.getElementById('reset').addEventListener('click', () => { goTo(0); controls.reset(); });

const spherical = new THREE.Spherical();
host.addEventListener('keydown', e => {
  const offset = camera.position.clone().sub(controls.target);
  spherical.setFromVector3(offset);
  const rot = THREE.MathUtils.degToRad(8);
  switch (e.key) {
    case 'ArrowLeft': spherical.theta -= rot; break;
    case 'ArrowRight': spherical.theta += rot; break;
    case 'ArrowUp': spherical.phi -= rot; break;
    case 'ArrowDown': spherical.phi += rot; break;
    case '+': case '=': spherical.radius *= 0.88; break;
    case '-': case '_': spherical.radius /= 0.88; break;
    case '0': case 'Home': controls.reset(); e.preventDefault(); return;
    default: return;
  }
  e.preventDefault();
  spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.12, controls.maxPolarAngle);
  spherical.radius = THREE.MathUtils.clamp(spherical.radius, controls.minDistance, controls.maxDistance);
  offset.setFromSpherical(spherical);
  camera.position.copy(controls.target).add(offset);
  controls.update();
});

reduceMotionQuery.addEventListener('change', e => {
  reducedMotion = e.matches;
  controls.enableDamping = !reducedMotion;
  updateUI();
});

// Hooks for automated screenshots / tests (no effect on learners).
window.__kode = {
  goTo,
  finishStep() { stepStart = performance.now() - STEPS[step].duration - 10; },
  get step() { return step; },
  get ledOn() { return ledOn; },
  camera, controls, scene,
};

updateUI();
function frame(now) {
  requestAnimationFrame(frame);
  applyScene(now);
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}
requestAnimationFrame(frame);
