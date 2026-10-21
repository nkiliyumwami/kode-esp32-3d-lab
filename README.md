# KODE ESP32 3D Lab

An independent proof-of-concept learning lab for complete beginners: ESP32 DevKit V1, MicroPython, and interactive 3D wiring scenes.

## Run locally

From the repository root:

```bash
python3 -m http.server 8765
```

Open http://localhost:8765 in a modern browser. An internet connection is needed for the Three.js CDN.

## Proof-of-concept lesson

**01 — Blink an LED:** Rotate/zoom a 3D circuit, move through wiring steps, replay, reset, and read beginner-friendly explanations. GPIO25 → 330 Ω resistor → LED anode; LED cathode → GND. Use only 3.3 V logic with an ESP32.

The 3D breadboard is an educational schematic: its coordinates and models are conceptual, not a physically validated hole-for-hole assembly guide. Adult-check real wiring before power. No hardware flashing from this POC.

## Agent instructions

Read `AGENTS.md` before changing anything. Work on a feature branch and prepare a pull request. Never merge, deploy, or modify other repositories automatically.

## Future milestones

- Accurate 30-pin ESP32 DevKit model and full-size breadboard with hole-level electrical net validation.
- Interactive connection check, safe resistor selection, and independent verification of circuits.
- Additional labs: traffic light, push button, ultrasonic distance sensor, servo and smart bin.
- Learner writing and executing MicroPython, with safe Web Serial hardware support on compatible browsers.
- Accessibility, testing, progressive challenge/quiz system, bilingual curriculum options.
