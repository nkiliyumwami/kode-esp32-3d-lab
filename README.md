# KODE ESP32 3D Lab

An independent proof-of-concept learning lab for complete beginners: ESP32 DevKit V1, MicroPython, and interactive 3D wiring scenes.

## Run locally

From the repository root:

```bash
python3 -m http.server 8765   # or: npm start
```

Open http://localhost:8765 in a modern browser. An internet connection is needed for the Three.js CDN (three@0.160.1, pinned in the import map). There is no build step.

## Tests

```bash
npm test             # node --test tests/ (Node 18+, no dependencies)
npm install          # once, for the scene test (playwright-core only)
npm run test:scene   # renders the page in Chrome and checks the 3D geometry
```

`tests/lesson01-circuit.test.js` checks the lesson wiring as a netlist: the DevKit V1 pin order, 0.9 inch header spacing across the centre channel, D25 in hole b11, resistor bands = 330 Ω, the path GPIO25 → resistor → LED anode → LED cathode → GND, no shorts or bypassed parts, and a safe LED current (about 4 mA).

`tests/independent-wiring.test.js` does not trust the shared data file: it hard-codes the 30-pin DOIT DevKit V1 pin order from published pinouts, rebuilds the breadboard strips and the netlist from scratch, and checks that the data, the wiring checklist in `index.html` and the step texts all agree.

`tests/browser/scene-geometry.mjs` opens the lesson in headless Chrome (set `CHROME_PATH` if Chrome is not at `/usr/bin/google-chrome`), reads the rendered meshes and checks where they really are: every ESP32 pin sits in the right hole (EN at the antenna end, D25 in b11, GND in b17), the board is not mirrored and the printed pin names match the pins, the resistor is in c24/c28, the long LED leg is in e28 and the short leg in e29, and each wire lands in its holes without passing through the board.

## Lesson 01 — Blink an LED

Six steps: meet the parts → find GPIO25 → add the 330 Ω resistor → place the LED → complete the path to GND → run the code. You can rotate, zoom and pan the scene with a mouse, touch, or keyboard (arrow keys, + / −, 0 to reset). Labels in the scene name GPIO25, GND, 330 Ω, anode (+, long leg) and cathode (−, flat side), so nothing depends on colour alone. With *prefers-reduced-motion*, parts appear without animation and the LED is shown steadily on.

| Connection | Breadboard holes |
| --- | --- |
| ESP32 DevKit V1 (30-pin) straddles the channel | left header EN…VIN in b4–b18, right header D23…3V3 in i4–i18 |
| GPIO25 = pin **D25** | b11 → yellow wire **a11 → a24** |
| 330 Ω resistor (orange-orange-brown-gold) | **c24 ↔ c28** |
| LED anode (+, long leg) / cathode (−, flat side) | **e28** / **e29** |
| Ground return | black wire **a29 → blue − rail (N-26)**, black wire **blue − rail (N-14) → a17**, next to **GND** in b17 |

All hole positions come from `assets/lesson01-circuit.js`, which the 3D scene and the tests both use.

**Accuracy notes.** The model follows the DOIT ESP32 DevKit V1 30-pin layout: 51.5 × 28.3 mm board, 2.54 mm pin pitch, headers 22.86 mm (0.9 in) apart. Pin order comes from the Random Nerd Tutorials "ESP32 DEVKIT V1 – DOIT version with 30 GPIOs" pinout and the mischianti.org DOIT DevKit V1 pinout. Clone boards vary, so learners should always follow the labels printed on their own board. The wiring has passed the automated connection tests but has **not yet been tested on real hardware**. Have an adult check the real wiring before connecting USB. This POC never flashes hardware.

All visuals are generated in code (canvas textures and Three.js geometry). No third-party images are used.

## Agent instructions

Read `AGENTS.md` before changing anything. Work on a feature branch and prepare a pull request. Never merge, deploy, or modify other repositories automatically.

## Future milestones

- Accurate 30-pin ESP32 DevKit model and full-size breadboard with hole-level electrical net validation.
- Interactive connection check, safe resistor selection, and independent verification of circuits.
- Additional labs: traffic light, push button, ultrasonic distance sensor, servo and smart bin.
- Learner writing and executing MicroPython, with safe Web Serial hardware support on compatible browsers.
- Accessibility, testing, progressive challenge/quiz system, bilingual curriculum options.
