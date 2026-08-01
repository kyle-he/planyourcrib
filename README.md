# Plan Your Crib

A browser-based 2D room planner built with React, TypeScript, Zustand, and Vite.

## Development

```bash
npm install
npm run dev
```

Use `npm run build` for a production build, `npm run lint` for static checks, and `npm run check:api` to verify the public schema, catalog, and example remain synchronized with the editor.

## Plan JSON API

Plans can be imported as `.json` files or exported as ZIP archives containing `plan.json` and optional image assets. See the [Plan JSON API](docs/PLAN_JSON_API.md) for the format, geometry rules, AI-generation prompt, JSON Schema, catalog, and complete example.

Machine-readable resources live in [`public/api`](public/api):

- [`plan.schema.json`](public/api/plan.schema.json)
- [`item-catalog.json`](public/api/item-catalog.json)
- [`example-plan.json`](public/api/example-plan.json)
- [`index.json`](public/api/index.json)
