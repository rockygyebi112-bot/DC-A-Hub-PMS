# DC&A Hub PMS

Project Management System for DC&A Hub. Lets DC&A Hub staff track project work (phases, activities, proofs) and lets clients log in to see live progress on their project.

See [`docs/superpowers/specs/2026-05-06-dcahub-pms-design.md`](docs/superpowers/specs/2026-05-06-dcahub-pms-design.md) for the design spec.

## Stack

Next.js 16 (App Router), Supabase, TypeScript, shadcn/ui, Tailwind v4.

## Local development

```bash
npm install
cp .env.local.example .env.local
# fill in Supabase keys
npm run dev
```

## Tests

```bash
npm test
```
