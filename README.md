# TickOck

A bilingual (English/French) event ticketing platform built with Next.js 14, Convex, and Tailwind CSS.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Backend:** [Convex](https://convex.dev) — real-time database, auth, and serverless functions
- **Styling:** Tailwind CSS
- **i18n:** next-intl (EN/FR)
- **Auth:** @convex-dev/auth (email/password with verification)
- **PDF generation:** pdf-lib (on-demand, never stored)
- **QR scanning:** jsqr

## Prerequisites

- Node.js 18+
- npm
- A [Convex](https://convex.dev) account (free tier works)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Convex

```bash
npx convex dev
```

This will prompt you to log in and link a Convex project. It starts the Convex backend and keeps it in sync with your local `convex/` directory.

### 3. Run the dev server

In a separate terminal:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> Both `npx convex dev` and `npm run dev` need to run at the same time during development.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Build for production |
| `npm run start` | Start the production server |
| `npm run lint` | Lint the codebase |
| `npm run lint:fix` | Lint and auto-fix issues |
| `npm run typecheck` | Run TypeScript type checks |
| `npm test` | Run the Convex function test suite |
| `npx convex dev` | Start the Convex backend in watch mode |

## Project Structure

```
tickOck/
├── app/               # Next.js App Router pages and layouts
├── components/
│   ├── ui/            # Shared primitives (buttons, inputs, etc.)
│   └── {domain}/      # Feature-scoped components
├── convex/            # Convex backend (queries, mutations, schema)
│   ├── _helpers/      # Shared helpers (permissions, etc.)
│   └── __tests__/     # Convex function tests (vitest + convex-test)
├── messages/
│   ├── en.json        # English strings
│   └── fr.json        # French strings
├── lib/               # Shared utilities
├── hooks/             # Custom React hooks
└── types/             # TypeScript type definitions
```

## Key Features

- Event creation with multi-step form, speakers, and tiered pricing
- Bilingual UI (EN/FR) — all strings live in `messages/`
- Manual payment flow: screenshot upload → pending → owner confirms → ticket activates
- HMAC-signed QR codes for ticket validation (per-event secret, never global)
- Ticket PDFs generated on-demand via API route
- Event owner dashboard with Overview, Payments, Attendees, and Staff tabs
- RBAC: platform-level roles + event-scoped staff permissions

## Testing

Convex functions are tested with [vitest](https://vitest.dev) and [convex-test](https://www.npmjs.com/package/convex-test) (a mock Convex backend). Test files live in `convex/__tests__/`, with shared seed helpers in `convex/__tests__/helpers.ts`.

```bash
npm test
```

`npm test`, `npm run typecheck`, and `npm run lint` all run automatically on every commit via a husky pre-commit hook, and the commit is blocked if any of them fails.

## Deployment

The recommended way to deploy is [Vercel](https://vercel.com) for the Next.js frontend paired with a production Convex deployment.

1. Push your code to GitHub
2. Import the repo in Vercel and set the required environment variables (from your Convex dashboard)
3. Run `npx convex deploy` to deploy the backend
