// Independent cross-check of lesson 01 wiring.
// Nothing here is derived from lesson01-circuit.js: the pinout is typed in from the
// published sources, the breadboard rule is re-implemented, and the expected holes are
// the ones the lesson text tells learners to use. The data module is only *compared*
// against these values, so a mistake in it cannot also hide in this test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as model from '../assets/lesson01-circuit.js';

// DOIT ESP32 DevKit V1, 30-pin, component side up, antenna at top, USB at bottom.
// Agreeing sources (checked 2026-10-20):
//  - Random Nerd Tutorials, "ESP32 DEVKIT V1 – DOIT version with 30 GPIOs" pinout image
//  - mischianti.org, "DOIT ESP32 DEV KIT v1 high resolution pinout"
//  - openlabbench.gwark.dev/pinouts/esp32-devkit-v1 and boardpilot ESP32 DevKit 30-pin table
// (mokxi.com lists a clone variant with "D12, GND, D13" and D0 on the right; D25 is the
// same 8th position there too.)
const SOURCE_LEFT = ['EN', 'VP', 'VN', 'D34', 'D35', 'D32', 'D33', 'D25', 'D26', 'D27', 'D14', 'D12', 'D13', 'GND', 'VIN'];
const SOURCE_RIGHT = ['D23', 'D22', 'TX0', 'RX0', 'D21', 'D19', 'D18', 'D5', 'TX2', 'RX2', 'D4', 'D2', 'D15', 'GND', '3V3'];

// What the lesson tells the learner (see index.html checklist and README table).
const EXPECTED = {
  firstPinRow: 4, nearColumn: 'b', farColumn: 'i',
  d25: 'b11', gnd: 'b17',
  signalWire: ['a11', 'a24'],
  resistor: ['c24', 'c28'],
  anode: 'e28', cathode: 'e29',
  gndWires: [['a29', 'N-26'], ['N-14', 'a17']],
};

// Breadboard rule, written from scratch: in a numbered row, a–e share one clip and f–j
// another; the centre channel separates them. A half-size board's rails run its full length.
function strip(hole) {
  let m = /^([a-j])([1-9]|[12]\d|30)$/.exec(hole);
  if (m) return `${'abcde'.includes(m[1]) ? 'L' : 'R'}${m[2]}`;
  m = /^([NF])([+-])\d+$/.exec(hole);
  if (m) return `rail${m[1]}${m[2]}`;
  throw new Error(`not a hole: ${hole}`);
}

test('data pinout equals the published pinout, pin by pin', () => {
  assert.deepEqual(model.ESP32_DEVKIT_V1.leftHeader, SOURCE_LEFT);
  assert.deepEqual(model.ESP32_DEVKIT_V1.rightHeader, SOURCE_RIGHT);
});

test('every ESP32 pin lands in the hole implied by the sources', () => {
  const r0 = EXPECTED.firstPinRow;
  for (const [i, name] of SOURCE_LEFT.entries()) {
    const got = model.esp32PinHoles().find(p => p.header === 'left' && p.index === i);
    assert.equal(got.name, name);
    assert.equal(got.hole, `${EXPECTED.nearColumn}${r0 + i}`, name);
  }
  for (const [i, name] of SOURCE_RIGHT.entries()) {
    const got = model.esp32PinHoles().find(p => p.header === 'right' && p.index === i);
    assert.equal(got.hole, `${EXPECTED.farColumn}${r0 + i}`, name);
  }
  assert.equal(`${EXPECTED.nearColumn}${r0 + SOURCE_LEFT.indexOf('D25')}`, EXPECTED.d25);
  assert.equal(`${EXPECTED.nearColumn}${r0 + SOURCE_LEFT.indexOf('GND')}`, EXPECTED.gnd);
  // the two headers must be on opposite sides of the channel, 9 holes (0.9 in) apart
  assert.notEqual(strip('b11')[0], strip('i11')[0]);
});

test('lesson data uses exactly the holes the lesson text describes', () => {
  const L = model.LESSON01;
  assert.deepEqual(L.resistor.leads, EXPECTED.resistor);
  assert.equal(L.led.anode, EXPECTED.anode);
  assert.equal(L.led.cathode, EXPECTED.cathode);
  const w = Object.fromEntries(L.wires.map(x => [x.id, [x.from, x.to]]));
  assert.deepEqual(w.signal, EXPECTED.signalWire);
  const gnd = [w.gndLed, w.gndBoard].map(p => [...p].sort());
  assert.deepEqual(gnd, EXPECTED.gndWires.map(p => [...p].sort()));
});

test('independent netlist: GPIO25 → 330 Ω → LED anode, LED cathode → GND, no shorts', () => {
  const parent = {};
  const find = x => (parent[x] ??= x) === x ? x : (parent[x] = find(parent[x]));
  const join = (a, b) => { parent[find(strip(a))] = find(strip(b)); };
  join(...EXPECTED.signalWire);
  for (const pair of EXPECTED.gndWires) join(...pair);
  const net = h => find(strip(h));
  const [r1, r2] = EXPECTED.resistor;
  assert.equal(net(r1), net(EXPECTED.d25), 'resistor lead 1 shares GPIO25’s net');
  assert.notEqual(net(r1), net(r2), 'resistor legs in different strips (not shorted)');
  assert.equal(net(r2), net(EXPECTED.anode), 'resistor lead 2 meets the LED anode');
  assert.notEqual(net(EXPECTED.anode), net(EXPECTED.cathode), 'LED legs in different strips');
  assert.equal(net(EXPECTED.cathode), net(EXPECTED.gnd), 'LED cathode returns to GND');
  assert.notEqual(net(EXPECTED.d25), net(EXPECTED.gnd), 'GPIO25 not shorted to GND');
  // every wire end on the board side of the channel is on the a–e half, like the pins it joins
  for (const h of ['a11', 'a24', 'c24', 'c28', 'e28', 'e29', 'a29', 'a17', 'b11', 'b17']) assert.equal(strip(h)[0], 'L', h);
  // both black wires use the same continuous rail
  assert.equal(strip('N-26'), strip('N-14'));
});

test('the page instructions name the same holes', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const list = html.slice(html.indexOf('<ul class="wiring">'), html.indexOf('</ul>'));
  for (const h of ['D25', 'a11', 'a24', 'c24', 'c28', 'e28', 'e29', 'a29', 'a17', 'GND']) assert.ok(list.includes(h), h);
  const app = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
  for (const phrase of ['row 11', 'from a11 to a24', 'c24 and c28', 'in e28', 'in e29', 'from a29', 'back to a17']) {
    assert.ok(app.includes(phrase), `step text mentions "${phrase}"`);
  }
});
