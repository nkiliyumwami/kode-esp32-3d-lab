import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PITCH, ESP32_DEVKIT_V1, LESSON01, analyseCircuit, esp32PinHole, esp32PinHoles,
  holePosition, breadboardNet, resistorValueFromBands, ledCurrentmA,
} from '../assets/lesson01-circuit.js';

test('DevKit V1 30-pin pinout matches the published DOIT pin order', () => {
  assert.equal(ESP32_DEVKIT_V1.leftHeader.length, 15);
  assert.equal(ESP32_DEVKIT_V1.rightHeader.length, 15);
  assert.equal(ESP32_DEVKIT_V1.leftHeader[7], 'D25', 'D25 is the 8th pin from EN');
  assert.equal(ESP32_DEVKIT_V1.leftHeader[13], 'GND');
  assert.equal(ESP32_DEVKIT_V1.rightHeader[13], 'GND');
  assert.equal(ESP32_DEVKIT_V1.gpio.D25, 25);
  assert.ok(!ESP32_DEVKIT_V1.inputOnly.includes(25), 'GPIO25 can drive an output');
});

test('board straddles the centre channel with 0.9 inch header spacing', () => {
  const left = holePosition(esp32PinHole('EN'));
  const right = holePosition(esp32PinHole('D23', 'right'));
  assert.ok(Math.abs(Math.abs(left.z - right.z) - ESP32_DEVKIT_V1.headerSpacing) < 1e-9);
  assert.ok(Math.abs(ESP32_DEVKIT_V1.headerSpacing - 22.86) < 1e-9);
  const nets = new Set(esp32PinHoles().map(p => breadboardNet(p.hole)));
  assert.equal(nets.size, 30, 'no two ESP32 pins share a breadboard strip');
});

test('D25 lands in hole b11 and GND in b17', () => {
  assert.equal(esp32PinHole('D25'), 'b11');
  assert.equal(esp32PinHole('GND'), 'b17');
});

test('hole pitch is 2.54 mm', () => {
  const a = holePosition('a1'), b = holePosition('a2');
  assert.ok(Math.abs(b.x - a.x - PITCH) < 1e-9);
});

test('resistor bands read 330 ohm', () => {
  assert.deepEqual(LESSON01.resistor.bands.slice(0, 3), ['orange', 'orange', 'brown']);
  assert.equal(resistorValueFromBands(LESSON01.resistor.bands), 330);
  assert.equal(LESSON01.resistor.ohms, 330);
});

test('circuit path: GPIO25 -> resistor -> LED anode, LED cathode -> GND', () => {
  const c = analyseCircuit();
  assert.ok(c.resistorNets.includes(c.gpioNet), 'one resistor lead is on the GPIO25 net');
  const other = c.resistorNets.find(n => n !== c.gpioNet);
  assert.equal(other, c.anodeNet, 'other resistor lead shares a strip with the LED anode');
  assert.equal(c.cathodeNet, c.gndNet, 'LED cathode returns to ESP32 GND');
});

test('no short circuits', () => {
  const c = analyseCircuit();
  assert.notEqual(c.gpioNet, c.gndNet, 'GPIO25 is not shorted to GND');
  assert.notEqual(c.resistorNets[0], c.resistorNets[1], 'resistor is not bypassed');
  assert.notEqual(c.anodeNet, c.cathodeNet, 'LED is not bypassed');
  assert.notEqual(c.anodeNet, c.gpioNet, 'LED anode does not bypass the resistor');
  // Only GPIO25 and the two GND pins are connected to anything.
  const touched = c.pinNets.filter(p => [c.gpioNet, c.gndNet, c.anodeNet].includes(p.net)).map(p => p.name);
  assert.deepEqual(touched.sort(), ['D25', 'GND', 'GND']);
});

test('LED current is safe for the LED and the ESP32 pin', () => {
  const mA = ledCurrentmA();
  assert.ok(mA > 2 && mA < 12, `about ${mA.toFixed(1)} mA`);
  assert.ok(mA < LESSON01.led.maxCurrentmA);
});
