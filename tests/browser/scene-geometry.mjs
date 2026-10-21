// Renders lesson 01 in headless Chrome and checks the *drawn* geometry:
// where every leg, pin and wire end actually enters the breadboard, which side of the
// rendered board D25 / GND are on, the LED polarity, and wire clearance under the PCB.
// Hole names are recomputed here from raw coordinates (2.54 mm grid), not taken from the app.
//
//   npm run test:scene            (needs playwright-core; Chrome at CHROME_PATH or /usr/bin/google-chrome)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.py': 'text/plain' };
const server = createServer(async (req, res) => {
  try {
    const path = normalize(join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    const file = path.endsWith('/') ? join(path, 'index.html') : path;
    if (!file.startsWith(ROOT)) throw new Error('outside root');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/`;

// ---- independent expectations (same sources as tests/independent-wiring.test.js)
const SOURCE_LEFT = ['EN', 'VP', 'VN', 'D34', 'D35', 'D32', 'D33', 'D25', 'D26', 'D27', 'D14', 'D12', 'D13', 'GND', 'VIN'];
const SOURCE_RIGHT = ['D23', 'D22', 'TX0', 'RX0', 'D21', 'D19', 'D18', 'D5', 'TX2', 'RX2', 'D4', 'D2', 'D15', 'GND', '3V3'];
const EXPECT_WIRES = { signal: ['a11', 'a24'], gndBoard: ['a17', 'N-14'], gndLed: ['a29', 'N-26'] };
const P = 2.54;
function holeAt(x, z) {
  const row = Math.round(x / P + 15.5);
  const ex = Math.abs(x - (row - 15.5) * P);
  if (Math.abs(z) > 17) {
    const k = Math.abs(z) / P;
    const pol = Math.abs(k - 7.8) < 0.2 ? '-' : Math.abs(k - 8.8) < 0.2 ? '+' : '?';
    return { id: `${z > 0 ? 'N' : 'F'}${pol}${row}`, err: Math.max(ex, Math.abs(k - (pol === '-' ? 7.8 : 8.8)) * P) };
  }
  const p = Math.round(5.5 - z / P);
  const letter = { 0: 'a', 1: 'b', 2: 'c', 3: 'd', 4: 'e', 7: 'f', 8: 'g', 9: 'h', 10: 'i', 11: 'j' }[p] ?? '?';
  return { id: `${letter}${row}`, err: Math.max(ex, Math.abs(z - (5.5 - p) * P)) };
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__kode);
const parts = await page.evaluate(async () => {
  const k = window.__kode;
  k.goTo(5); k.finishStep();
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  k.scene.updateMatrixWorld(true);
  const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) o[c * 4 + r] += a[i * 4 + r] * b[c * 4 + i]; return o; };
  const ap = (e, x, y, z) => [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]];
  const shown = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const out = [];
  k.scene.traverse(o => {
    if (!o.userData.check) return;
    const a = o.geometry.attributes.position.array;
    const mats = o.isInstancedMesh ? Array.from({ length: o.count }, (_, i) => mul(o.matrixWorld.elements, Array.from(o.instanceMatrix.array.slice(i * 16, i * 16 + 16)))) : [o.matrixWorld.elements];
    mats.forEach((m, i) => {
      const verts = [];
      for (let j = 0; j < a.length; j += 3) verts.push(ap(m, a[j], a[j + 1], a[j + 2]));
      const labels = (o.userData.labels || []).map(l => ({ text: l.text, p: ap(m, l.x, l.y, l.z) }));
      const det = m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]);
      out.push({ check: o.userData.check, wire: o.userData.wire, instance: o.isInstancedMesh ? i : null, visible: shown(o), verts, labels, det });
    });
  });
  return out;
});
await browser.close();
server.close();

const results = [];
const check = (name, fn) => { try { fn(); results.push(['ok', name]); } catch (e) { results.push(['FAIL', name, e.message]); } };
const bbox = v => v.reduce((b, p) => ({ min: b.min.map((m, i) => Math.min(m, p[i])), max: b.max.map((m, i) => Math.max(m, p[i])) }), { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
const centre = b => b.min.map((m, i) => (m + b.max[i]) / 2);
// where a conductor enters the breadboard: centroid of its vertices below the surface
function entry(part) {
  const below = part.verts.filter(p => p[1] < -0.5);
  assert.ok(below.length > 0, `${part.check} does not reach into the breadboard`);
  const x = below.reduce((s, p) => s + p[0], 0) / below.length, z = below.reduce((s, p) => s + p[2], 0) / below.length;
  const h = holeAt(x, z);
  assert.ok(h.err < 0.05, `${part.check} is ${h.err.toFixed(3)} mm off the hole grid`);
  return h.id;
}
const of = c => parts.filter(p => p.check === c);

check('no page errors', () => assert.deepEqual(errors, []));

// ---- ESP32 orientation and pin order, derived from where the module and USB port are drawn
const pins = of('esp32-pins');
check('30 header pins rendered', () => assert.equal(pins.length, 30));
const shield = centre(bbox(of('module-shield')[0].verts));
const usb = centre(bbox(of('usb-receptacle')[0].verts));
const pcb = bbox(of('pcb')[0].verts);
const toAntenna = [shield[0] - usb[0], 0, shield[2] - usb[2]];
// Looking down on the component side (view direction −Y) with the antenna at the top of the
// picture, "right" = viewDir × up = (−Y) × toAntenna, so "left" is the opposite.
// cross((0,−1,0), (fx,0,fz)) = (−fz, 0, fx)
const right = [-toAntenna[2], 0, toAntenna[0]];
const boardMid = centre(pcb);
const pinInfo = pins.map(p => {
  const c = centre(bbox(p.verts));
  const d = [c[0] - boardMid[0], c[2] - boardMid[2]];
  return { hole: entry(p), side: d[0] * right[0] + d[1] * right[2] < 0 ? 'left' : 'right', along: d[0] * toAntenna[0] + d[1] * toAntenna[2] };
});
check('component side faces up (module above the PCB)', () => assert.ok(shield[1] > pcb.max[1]));
const named = {};
for (const side of ['left', 'right']) {
  const list = pinInfo.filter(p => p.side === side).sort((a, b) => b.along - a.along); // antenna end first
  check(`15 pins on the ${side} header`, () => assert.equal(list.length, 15));
  (side === 'left' ? SOURCE_LEFT : SOURCE_RIGHT).forEach((n, i) => { named[`${side}:${n}`] = list[i]?.hole; });
}
check('EN (pin 1) is at the antenna end, in b4', () => assert.equal(named['left:EN'], 'b4'));
check('VIN is at the USB end, in b18', () => assert.equal(named['left:VIN'], 'b18'));
check('D25 (8th from EN, left header) is in b11', () => assert.equal(named['left:D25'], 'b11'));
check('GND (14th, left header) is in b17', () => assert.equal(named['left:GND'], 'b17'));
check('right header D23…3V3 runs i4…i18', () => { assert.equal(named['right:D23'], 'i4'); assert.equal(named['right:3V3'], 'i18'); });
check('left header is on the learner side (a–e half), right header across the channel', () => {
  assert.ok(Object.entries(named).filter(([k]) => k.startsWith('left')).every(([, h]) => 'abcde'.includes(h[0])));
  assert.ok(Object.entries(named).filter(([k]) => k.startsWith('right')).every(([, h]) => 'fghij'.includes(h[0])));
});

// ---- printed pin names (silkscreen) must sit next to the right pins, unmirrored
const silk = of('silkscreen')[0];
check('ESP32 board is not mirrored (silkscreen reads correctly)', () => assert.ok(silk.det > 0 && pins.every(p => p.det > 0)));
const pinCentres = pins.map((p, i) => ({ c: centre(bbox(p.verts)), hole: pinInfo[i].hole, side: pinInfo[i].side }));
const nearestPin = l => pinCentres.reduce((a, b) => (Math.hypot(a.c[0] - l.p[0], a.c[2] - l.p[2]) < Math.hypot(b.c[0] - l.p[0], b.c[2] - l.p[2]) ? a : b));
check('printed "D25" is beside the pin in b11, on the left header', () => {
  const l = silk.labels.find(x => x.text === 'D25');
  assert.equal(nearestPin(l).hole, 'b11');
  assert.equal(nearestPin(l).side, 'left');
});
check('printed "GND" labels are beside b17 and i17', () => assert.deepEqual(silk.labels.filter(x => x.text === 'GND').map(l => nearestPin(l).hole).sort(), ['b17', 'i17']));
check('all 30 printed pin names match the published pinout position', () => {
  const want = {};
  SOURCE_LEFT.forEach((n, i) => { (want[n] ??= []).push(`b${4 + i}`); });
  SOURCE_RIGHT.forEach((n, i) => { (want[n] ??= []).push(`i${4 + i}`); });
  assert.equal(silk.labels.length, 30);
  for (const l of silk.labels) assert.ok(want[l.text]?.includes(nearestPin(l).hole), `"${l.text}" printed next to ${nearestPin(l).hole}`);
});

// ---- resistor
const leads = of('resistor-lead').map(entry).sort();
check('resistor legs in c24 and c28 (different rows, same a–e half)', () => assert.deepEqual(leads, ['c24', 'c28']));

// ---- LED polarity
const legs = of('led-leg').map(p => ({ hole: entry(p), len: bbox(p.verts).max[1] - bbox(p.verts).min[1], x: centre(bbox(p.verts))[0], z: centre(bbox(p.verts))[2] }));
const anode = legs.reduce((a, b) => (a.len > b.len ? a : b));
const cathode = legs.find(l => l !== anode);
check('long leg (anode) in e28', () => assert.equal(anode.hole, 'e28'));
check('short leg (cathode) in e29', () => assert.equal(cathode.hole, 'e29'));
check('flat side of the LED rim faces the cathode leg', () => {
  const rim = of('led-rim')[0].verts;
  const c = [(anode.x + cathode.x) / 2, (anode.z + cathode.z) / 2];
  const d = [cathode.x - anode.x, cathode.z - anode.z];
  const n = Math.hypot(...d);
  const proj = rim.map(p => ((p[0] - c[0]) * d[0] + (p[2] - c[1]) * d[1]) / n);
  const towardCathode = Math.max(...proj), towardAnode = -Math.min(...proj);
  assert.ok(towardAnode - towardCathode > 0.3, `rim reach: ${towardCathode.toFixed(2)} toward cathode vs ${towardAnode.toFixed(2)} toward anode`);
});

// ---- jumper wires
const pcbBox = { min: pcb.min.map(v => v - 0.02), max: pcb.max.map(v => v + 0.02) };
const spacers = of('header-spacer').map(p => bbox(p.verts));
const inside = (p, b) => p.every((v, i) => v > b.min[i] && v < b.max[i]);
for (const [id, want] of Object.entries(EXPECT_WIRES)) {
  const ends = parts.filter(p => p.check === 'wire-pin' && p.wire === id);
  const tube = parts.find(p => p.check === 'wire-insulation' && p.wire === id);
  check(`${id} wire: both pin ends visible and in ${want.join(' + ')}`, () => {
    assert.ok(ends.every(e => e.visible), 'an end is hidden');
    assert.deepEqual(ends.map(entry).sort(), [...want].sort());
  });
  check(`${id} wire: insulation reaches both pins`, () => {
    for (const e of ends) {
      const c = centre(bbox(e.verts));
      const gap = Math.min(...tube.verts.map(p => Math.hypot(p[0] - c[0], p[2] - c[2]) + Math.max(0, p[1] - 3)));
      assert.ok(gap < 1.0, `gap ${gap.toFixed(2)} mm`);
    }
  });
  check(`${id} wire: does not pass through the ESP32 PCB, header spacers or breadboard`, () => {
    const bad = tube.verts.filter(p => inside(p, pcbBox) || spacers.some(b => inside(p, b)) || p[1] < 0.05);
    assert.equal(bad.length, 0, `${bad.length} vertices collide, e.g. ${bad[0]?.map(v => v.toFixed(2))}`);
  });
}
check('both black wires use the same (continuous) blue − rail', () => {
  const rails = ['gndBoard', 'gndLed'].map(id => parts.filter(p => p.check === 'wire-pin' && p.wire === id).map(entry).find(h => h.startsWith('N')));
  assert.deepEqual(rails.map(r => r.slice(0, 2)), ['N-', 'N-']);
});

for (const r of results) console.log(r[0] === 'ok' ? `ok   ${r[1]}` : `FAIL ${r[1]}\n     ${r[2]}`);
const failed = results.filter(r => r[0] !== 'ok').length;
console.log(`\n${results.length - failed}/${results.length} scene geometry checks passed`);
process.exit(failed ? 1 : 0);
