// Lesson 01 circuit: the single source of truth for hole positions, board pinout and wiring.
// app.js builds the 3D scene from this data and tests/lesson01-circuit.test.js checks
// the electrical connections, so the picture and the checks cannot drift apart.
//
// Units: millimetres. Breadboard top surface is y = 0; +X runs from row 1 to row 30;
// +Z points toward the learner (column a side).

export const PITCH = 2.54; // standard 0.1 inch breadboard / header pitch

// ---------- Half-size (400 tie-point) breadboard ----------
export const BREADBOARD = {
  rows: 30,
  columns: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
  size: { length: 82.5, width: 54.5, height: 8.5 },
  // The rails are continuous on a half-size board; holes sit in groups of five.
  railRows: [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 25, 26, 27, 28, 29],
  rails: {
    // N = near side (next to column a), F = far side (next to column j)
    'N-': { z: 7.8 * PITCH, polarity: '-', color: 'blue' },
    'N+': { z: 8.8 * PITCH, polarity: '+', color: 'red' },
    'F-': { z: -7.8 * PITCH, polarity: '-', color: 'blue' },
    'F+': { z: -8.8 * PITCH, polarity: '+', color: 'red' },
  },
};

export function rowX(row) {
  return (row - (BREADBOARD.rows + 1) / 2) * PITCH;
}

// a..e and f..j are separated by the 0.3 inch centre channel (3 pitches from e to f).
export function columnZ(letter) {
  const i = BREADBOARD.columns.indexOf(letter);
  if (i < 0) throw new Error(`Unknown column ${letter}`);
  const physical = i < 5 ? i : i + 2;
  return (5.5 - physical) * PITCH;
}

// Hole ids: "a11" for the terminal strips, "N-17" for rail holes.
export function parseHole(id) {
  let m = /^([a-j])(\d{1,2})$/.exec(id);
  if (m) {
    const row = Number(m[2]);
    if (row < 1 || row > BREADBOARD.rows) throw new Error(`Row out of range: ${id}`);
    return { kind: 'strip', column: m[1], row };
  }
  m = /^([NF][+-])(\d{1,2})$/.exec(id);
  if (m) {
    const row = Number(m[2]);
    if (!BREADBOARD.railRows.includes(row)) throw new Error(`No rail hole at ${id}`);
    return { kind: 'rail', rail: m[1], row };
  }
  throw new Error(`Bad hole id: ${id}`);
}

export function holePosition(id) {
  const h = parseHole(id);
  const z = h.kind === 'strip' ? columnZ(h.column) : BREADBOARD.rails[h.rail].z;
  return { x: rowX(h.row), y: 0, z };
}

// Which metal clip (net) a hole belongs to on an empty breadboard.
export function breadboardNet(id) {
  const h = parseHole(id);
  if (h.kind === 'rail') return `rail ${h.rail}`;
  const half = 'abcde'.includes(h.column) ? 'a-e' : 'f-j';
  return `row ${h.row} ${half}`;
}

// ---------- DOIT ESP32 DevKit V1, 30-pin version ----------
// Pin order, component side up, antenna at the top, micro-USB at the bottom.
// Sources: Random Nerd Tutorials "ESP32 DEVKIT V1 – DOIT version with 30 GPIOs" pinout
// and mischianti.org "DOIT ESP32 DEV KIT v1 high resolution pinout". Clones can differ:
// learners must always follow the labels printed on their own board.
export const ESP32_DEVKIT_V1 = {
  name: 'DOIT ESP32 DevKit V1 (30-pin)',
  size: { length: 51.5, width: 28.3, pcbThickness: 1.6 },
  headerSpacing: 9 * PITCH, // 22.86 mm (0.9 inch)
  leftHeader: ['EN', 'VP', 'VN', 'D34', 'D35', 'D32', 'D33', 'D25', 'D26', 'D27', 'D14', 'D12', 'D13', 'GND', 'VIN'],
  rightHeader: ['D23', 'D22', 'TX0', 'RX0', 'D21', 'D19', 'D18', 'D5', 'TX2', 'RX2', 'D4', 'D2', 'D15', 'GND', '3V3'],
  gpio: {
    VP: 36, VN: 39, D34: 34, D35: 35, D32: 32, D33: 33, D25: 25, D26: 26, D27: 27, D14: 14, D12: 12, D13: 13,
    D23: 23, D22: 22, TX0: 1, RX0: 3, D21: 21, D19: 19, D18: 18, D5: 5, TX2: 17, RX2: 16, D4: 4, D2: 2, D15: 15,
  },
  inputOnly: [34, 35, 36, 39],
  logicVoltage: 3.3,
};

// Placement: the board straddles the centre channel, antenna toward row 1.
// Rotating the board this way puts the left header (EN … VIN) on the near side.
export const ESP32_PLACEMENT = { firstRow: 4, leftColumn: 'b', rightColumn: 'i' };

export function esp32PinHoles() {
  const out = [];
  const { firstRow, leftColumn, rightColumn } = ESP32_PLACEMENT;
  ESP32_DEVKIT_V1.leftHeader.forEach((name, i) =>
    out.push({ header: 'left', index: i, name, hole: `${leftColumn}${firstRow + i}` }));
  ESP32_DEVKIT_V1.rightHeader.forEach((name, i) =>
    out.push({ header: 'right', index: i, name, hole: `${rightColumn}${firstRow + i}` }));
  return out;
}

export function esp32PinHole(name, header = 'left') {
  const p = esp32PinHoles().find(pin => pin.name === name && pin.header === header);
  if (!p) throw new Error(`No ${header} header pin ${name}`);
  return p.hole;
}

// ---------- Lesson 01 parts and wiring ----------
export const LESSON01 = {
  gpio: 25,
  boardPin: 'D25',
  resistor: {
    ohms: 330,
    tolerance: '±5%',
    bands: ['orange', 'orange', 'brown', 'gold'], // 3, 3, ×10, ±5%
    leads: ['c24', 'c28'],
  },
  led: {
    color: 'red',
    diameterMm: 5,
    forwardVoltage: 2.0, // typical red LED
    maxCurrentmA: 20,
    anode: 'e28', // long leg, +
    cathode: 'e29', // short leg, -, flat side of the rim
  },
  wires: [
    { id: 'signal', color: 'yellow', from: 'a11', to: 'a24', purpose: 'GPIO25 (D25) row to resistor row' },
    { id: 'gndBoard', color: 'black', from: 'a17', to: 'N-14', purpose: 'board GND row to blue − rail' },
    { id: 'gndLed', color: 'black', from: 'a29', to: 'N-26', purpose: 'LED cathode row to blue − rail' },
  ],
};

const BAND_DIGITS = { black: 0, brown: 1, red: 2, orange: 3, yellow: 4, green: 5, blue: 6, violet: 7, grey: 8, white: 9 };
export function resistorValueFromBands(bands) {
  const [a, b, m] = bands;
  return (BAND_DIGITS[a] * 10 + BAND_DIGITS[b]) * 10 ** BAND_DIGITS[m];
}

export function ledCurrentmA(supply = ESP32_DEVKIT_V1.logicVoltage) {
  const { forwardVoltage } = LESSON01.led;
  return ((supply - forwardVoltage) / LESSON01.resistor.ohms) * 1000;
}

// Build the connectivity graph (union-find over breadboard nets plus wires) and
// report the nets each component terminal lands on.
export function analyseCircuit() {
  const parent = new Map();
  const find = n => {
    if (!parent.has(n)) parent.set(n, n);
    while (parent.get(n) !== n) n = parent.get(n);
    return n;
  };
  const union = (a, b) => parent.set(find(a), find(b));

  const used = new Map();
  const occupy = (hole, who) => {
    parseHole(hole);
    if (used.has(hole)) throw new Error(`Hole ${hole} used twice (${used.get(hole)} and ${who})`);
    used.set(hole, who);
  };

  const pins = esp32PinHoles();
  pins.forEach(p => occupy(p.hole, `ESP32 ${p.name}`));
  // Both GND pins are joined on the ESP32 PCB.
  const gndHoles = pins.filter(p => p.name === 'GND').map(p => breadboardNet(p.hole));
  union(gndHoles[0], gndHoles[1]);

  for (const w of LESSON01.wires) {
    occupy(w.from, `wire ${w.id}`);
    occupy(w.to, `wire ${w.id}`);
    union(breadboardNet(w.from), breadboardNet(w.to));
  }
  LESSON01.resistor.leads.forEach((h, i) => occupy(h, `resistor lead ${i + 1}`));
  occupy(LESSON01.led.anode, 'LED anode');
  occupy(LESSON01.led.cathode, 'LED cathode');

  const netOfHole = hole => find(breadboardNet(hole));
  const pinNets = pins.map(p => ({ ...p, net: netOfHole(p.hole) }));
  return {
    used,
    pinNets,
    netOfHole,
    gpioNet: netOfHole(esp32PinHole(LESSON01.boardPin)),
    gndNet: netOfHole(esp32PinHole('GND', 'left')),
    resistorNets: LESSON01.resistor.leads.map(netOfHole),
    anodeNet: netOfHole(LESSON01.led.anode),
    cathodeNet: netOfHole(LESSON01.led.cathode),
  };
}
