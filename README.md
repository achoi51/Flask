# Flask — Mobile Fluid + “Chemistry” Simulation

A real-time, browser-based fluid / particle simulation inspired by FLIP (Fluid‑Implicit‑Particle) techniques. It’s designed to feel like a playful “chemistry flask” where liquids/gases/solids interact — and it can react to **mobile device sensors** (e.g., shake to change color).

**Live demo:** https://personal-flask-sim.vercel.app

## Demo

![Fluid Simulation Demo](mobile-fluid-sim.gif)

## Features

- Real-time fluid/particle simulation in the browser
- Mobile-friendly interactions
  - **Shake to change color** (implemented)
  - (Planned) Touch/finger control to influence flow
- Built with modern frontend tooling (Vite + SvelteKit)

## Tech Stack

- **SvelteKit** (Svelte 5)
- **Vite**
- **Tailwind CSS**
- Optional tooling: ESLint, Prettier, TypeScript, Svelte Check
- Deploy-friendly (static output via `@sveltejs/adapter-static`)

## Background / Inspiration

This project follows fluid simulation concepts taught by the excellent **Ten Minute Physics** YouTube channel (especially their FLIP-style simulation content).

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

## Contributing

Pull requests are welcome! If you’re adding a new interaction or simulation behavior, screenshots/GIFs are appreciated.

## License

MIT — see [LICENSE](LICENSE).
