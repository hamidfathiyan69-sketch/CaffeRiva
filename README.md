# Caffè Riva — Dish Orbit Carousel

A small React + TypeScript + Vite app featuring the GSAP-powered Dish Orbit menu carousel. The carousel supports scroll snapping, keyboard arrows, swipes, thumbnails, an ingredients/overview tab, and reduced-motion preferences.

## Run locally

```bash
npm install
npm run dev
```

Create an optimized production build with `npm run build`.

## Component and style paths

This repository uses the standard `src/` application layout:

- `src/components/ui/dish-orbit-carousel.tsx` — reusable UI component
- `src/data/dishes.ts` — demo menu data
- `src/index.css` — Tailwind v4 import, theme tokens, and app styles
- `components.json` — shadcn/ui aliases and generator settings

The component alias is `@/components/ui/...`, configured in `tsconfig.app.json` and `vite.config.ts`. Keeping reusable primitives in `components/ui` (under `src` in this app) makes them easy for shadcn's generator and app code to discover, reuse, and extend. If starting from a root-level layout without `src`, point the shadcn `ui` alias at `@/components/ui` and create that folder before adding generated components; this matches the import convention used here.

## shadcn, Tailwind, and TypeScript setup

The repository is already configured for React, TypeScript, Tailwind CSS v4, and shadcn-style components. The relevant setup includes `components.json`, the `@/*` alias, `src/components/ui`, `src/lib/utils.ts`, and theme tokens in `src/index.css`.

For a new project, the shadcn CLI can bootstrap a compatible app with `npx shadcn@latest init`; choose the Vite + TypeScript option and `src/components/ui` as the UI component directory. If integrating this component into an existing Vite project instead, install Tailwind v4 with `npm install tailwindcss @tailwindcss/vite`, add the Tailwind Vite plugin and `@import "tailwindcss";`, enable TypeScript with `npm install -D typescript @types/react @types/react-dom`, and configure the `@/*` alias in both TypeScript and Vite. This component's non-Tailwind layout styling is scoped to its `dsh-*` classes, while the surrounding demo uses Tailwind utilities.

## Component usage

```tsx
import DishOrbitCarousel, { type Dish } from "@/components/ui/dish-orbit-carousel"

<DishOrbitCarousel
  dishes={dishes}
  height="100svh"
  loop
  onChange={(index) => console.log("Selected dish:", index)}
/>
```

Provide each dish with a title, subtitle, image URL, rating, chef, description, likes, and accent color. Ingredients, kitchen, labels, and alt text are optional. The demo images are served by Unsplash; use your own licensed, locally hosted images in production.
