import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/controls/OrbitControls.js';

// Educational representation only. The board pins and breadboard holes are not
// electrically validated. Never treat this scene as a physical wiring guide.
const host = document.getElementById('scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e8f1f8');

const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 100);
camera.position.set(8, 9, 12);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
host.prepend(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.minDistance = 5;
controls.maxDistance = 30;
controls.saveState();

scene.add(new THREE.HemisphereLight(0xffffff, 0x7185a0, 2.1));
const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(6, 12, 8);
scene.add(sun);

const mat = (color, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness: 0.43 });

function cube(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  mesh.position.set(x, y, z);
  scene.add(mesh);
  return mesh;
}

function cylinder(r1, r2, height, color, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, height, 20), mat(color));
  mesh.position.set(x, y, z);
  scene.add(mesh);
  return mesh;
}

function wire(a, b, color) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const direction = new THREE.Vector3().subVectors(B, A);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, direction.length(), 10),
    mat(color)
  );
  mesh.position.copy(A).add(B).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  scene.add(mesh);
  return mesh;
}

// A simplified ESP32, breadboard, and LED circuit.
cube(14, 0.2, 10, '#d7e5eb', 0, -0.35, 0);
cube(4.1, 0.25, 6.5, '#0a5363', -3.1, 0, 0);
cube(2.4, 0.12, 2, '#a8b4b8', -3.1, 0.2, 0.9);
cube(5.3, 0.24, 6.2, '#f7fafc', 3, 0, 0);

for (let row = 0; row < 12; row++) {
  for (let col = 0; col < 9; col++) {
    if (col === 4) continue;
    cylinder(0.047, 0.047, 0.011, '#5f7187',
      0.78 + col * 0.55, 0.145, -2.55 + row * 0.46);
  }
}

for (let i = 0; i < 15; i++) {
  cube(0.12, 0.11, 0.18, '#d6bf80', -5.06, 0.17, -2.77 + i * 0.385);
  cube(0.12, 0.11, 0.18, '#d6bf80', -1.12, 0.17, -2.77 + i * 0.385);
}

const resistor = cylinder(0.14, 0.14, 0.8, '#d5a26b', 1.4, 0.42, -0.8);
resistor.rotation.z = Math.PI / 2;
const rings = [0.95, 1.24, 1.55].map((x, i) =>
  cube(0.065, 0.3, 0.3, ['#9b4d1d', '#141b2f', '#edc44e'][i], x, 0.42, -0.8));

const led = cylinder(0.28, 0.28, 0.5, '#ef3338', 3.45, 0.46, -0.7);
const ledTip = new THREE.Mesh(
  new THREE.SphereGeometry(0.28, 18, 12),
  new THREE.MeshStandardMaterial({ color: 0xef3338, emissive: 0x370000 })
);
ledTip.position.set(3.45, 0.74, -0.7);
scene.add(ledTip);

const w1 = wire([-1.1, 0.17, -0.7], [1, 0.43, -0.7], '#da4539');
const w2 = wire([1.9, 0.43, -0.7], [3.45, 0.3, -0.7], '#da4539');
const w3 = wire([3.45, 0.21, 0.1], [-1.1, 0.17, 1.15], '#303744');

const steps = [
  ['Meet the circuit',
   'This is an ESP32, a resistor, and an LED. We will let the ESP32 switch the little light on and off.',
   'The ESP32 is a tiny computer that can control electrical signals.'],
  ['GPIO25 sends the signal',
   'We will use GPIO25 as an output. Its signal can be high (about 3.3 volts) or low (0 volts).',
   'A GPIO output is a programmable on/off connection. This lesson uses pin number 25.'],
  ['Add a resistor',
   "A 330-ohm resistor sits between GPIO25 and the LED's long leg (anode).",
   'It limits current to protect both the LED and the ESP32 output.'],
  ['Connect the LED',
   'Connect the LED long leg through the resistor. The short leg (cathode) goes to GND.',
   'Electric current needs a complete return path to ground. An LED also has direction.'],
  ['Run the code',
   'The code switches GPIO25 high, waits one second, switches low, and waits again.',
   'The repeated loop makes the LED blink. This is a simulation; the sample main.py is for a real ESP32 with MicroPython.']
];

const progress = document.getElementById('progress');
const back = document.getElementById('back');
const next = document.getElementById('next');
let step = 0;

function update() {
  document.getElementById('stepTitle').textContent = steps[step][0];
  document.getElementById('stepText').textContent = steps[step][1];
  document.getElementById('why').textContent = steps[step][2];
  progress.textContent = 'Step ' + (step + 1) + ' of ' + steps.length;
  back.disabled = step === 0;
  next.disabled = step === steps.length - 1;
  resistor.visible = step >= 2;
  rings.forEach(ring => { ring.visible = step >= 2; });
  led.visible = step >= 3;
  ledTip.visible = step >= 3;
  w1.visible = step >= 1;
  w2.visible = step >= 3;
  w3.visible = step >= 3;
}

back.addEventListener('click', () => { step = Math.max(0, step - 1); update(); });
next.addEventListener('click', () => { step = Math.min(steps.length - 1, step + 1); update(); });
document.getElementById('replay').addEventListener('click', () => { update(); controls.reset(); });
document.getElementById('reset').addEventListener('click', () => { step = 0; update(); controls.reset(); });

function resize() {
  const width = host.clientWidth;
  const height = host.clientHeight;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(host);
resize();
update();

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  if (step === 4) {
    const on = Math.floor(clock.elapsedTime) % 2 === 0;
    ledTip.material.emissive.setHex(on ? 0xff1d1d : 0x240000);
    ledTip.material.emissiveIntensity = on ? 1.6 : 0.1;
  } else {
    ledTip.material.emissive.setHex(0x250000);
    ledTip.material.emissiveIntensity = 0.1;
  }
  renderer.render(scene, camera);
}
animate();
