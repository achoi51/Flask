# Flask — Mobile Fluid + "Chemistry" Sandbox

A real-time, browser-based fluid / particle simulation inspired by FLIP (Fluid‑Implicit‑Particle) techniques. It’s designed to be a "chemistry flask" sandbox where different compounds such as certain liquids/gases/solids interact, demonstrating different reactions. Its purpose is to create a fun and interactive learning tool to teach younger individuals on chemical reactions, but not limited to a younger audience.

**Live demo:** https://personal-flask-sim.vercel.app

## Demo

![Fluid Simulation Demo](mobile-fluid-sim.gif)

## Features

- Real-time fluid/particle simulation in the browser
- Mobile-friendly interactions
  - Addition of liquids, gases, and solids through UI
  - Motion sensing for mobile devices to move liquid, solids, and gases
  - Particle dumping system to remove particles from the environment
  - Lid to prevent accidental removal of particles
- Built with modern frontend tooling (Vite + SvelteKit)

## Tech Stack

- **SvelteKit** (Svelte 5)
- **Vite**
- **Tailwind CSS**
- Optional tooling: ESLint, Prettier, TypeScript, Svelte Check
- Deploy-friendly (static output via `@sveltejs/adapter-static`)

## Background / Inspiration

This project follows fluid simulation concepts taught by the excellent **Ten Minute Physics** YouTube channel (especially their FLIP-style simulation content).
This project is heavily inspired by THIX, an developer group creating many educational learning tools. We were particularly inspired by their chemistry sandbox BEAKER. 
Our idea was to create a more robust sandbox setting that is more exaggerated than BEAKER, as it does not display its chemical reactions and particles to be super similar to the real life counterpart.

It was also inspired by / forked from: https://github.com/shajidhasan/mobile-fluid-sim

## Getting Started (Development)

### Prerequisites

- Node.js (recommended: current LTS)
- npm (or pnpm/yarn — commands below use npm)

### Install & run

```bash
npm install
npm run dev
```

Then open the local URL printed in your terminal.

### Other scripts

```bash
npm run build     # production build
npm run preview   # preview the production build locally
npm run lint      # prettier check + eslint
npm run format    # auto-format with prettier
npm run check     # type + svelte checks
```

## Roadmap / Todo

- [ ] Add more elements
- [ ] Add more reactions
- [ ] Fix collisions with solids rather than clipping through
- [ ] Add proper shaking of particles
- [ ] Add more utility features such as heating or mixers
- [ ] Better optimize particle movements for gases and liquids
- [ ] Polish and publish

## Contributing

Pull requests are welcome! If you’re adding a new interaction or simulation behavior, screenshots/GIFs are appreciated.

## License

MIT — see [LICENSE](LICENSE).
