# Forehead Guess

A full-stack real-time multiplayer web game where players guess what word/item is on their forehead while holding their phone up.

## Overview

pnpm workspace monorepo using TypeScript.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Real-time**: WebSockets (ws library) at `/ws`
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui

## Artifacts

- **forehead-guess** (`artifacts/forehead-guess`) - React frontend, served at `/`
- **api-server** (`artifacts/api-server`) - Express backend, served at `/api` and `/ws`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/forehead-guess run dev` — run frontend locally

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned)
- `ADMIN_PASSWORD` — password for /admin panel (default: `admin123`)
- `SESSION_SECRET` — express session secret

## Game Architecture

### REST Endpoints
- `POST /api/rooms` — create room (returns room + hostPlayerId)
- `GET /api/rooms/:code` — get room info
- `POST /api/rooms/:code/join` — join room
- `GET /api/categories` — list enabled categories
- `POST /api/admin/verify` — verify admin password
- `GET /api/admin/categories` — list all categories (with header `x-admin-password`)
- `POST /api/admin/categories` — create category
- `PUT /api/admin/categories/:id` — update category
- `DELETE /api/admin/categories/:id` — delete category
- `GET /api/admin/categories/:id/items` — list items
- `POST /api/admin/categories/:id/upload` — upload CSV/XLSX

### WebSocket Protocol (`/ws`)
Client sends JSON `{ type, payload }` messages. Server broadcasts state updates.

**Client → Server:**
- `join` — connect to room after HTTP join
- `setCategory` — host changes category
- `setOptions` — host sets turn duration / round count
- `startGame` — host starts the game
- `correct` — active player got it right
- `pass` — active player passes
- `playAgain` — host resets room

**Server → Client:**
- `roomUpdate` — full room state
- `turnUpdate` — current turn info (assignment hidden from guesser)
- `timerTick` — countdown seconds
- `turnEnd` — turn result
- `gameEnd` — final scores

## Admin Panel

Visit `/admin` in the browser. Default password: `admin123`.

Set `ADMIN_PASSWORD` environment variable to change the password.

Admin can:
- Create/edit/delete/enable/disable categories
- Upload items via CSV or XLSX (columns: `item_text`, `image_url`)
- View items in each category

## Database Schema

- `categories` — category id, name, description, type (text|image), enabled
- `category_items` — items with itemText + optional imageUrl
- `rooms` — game rooms with code, status, settings
- `players` — players in each room with scores
- `turns` — turn history with results

## Sample Data

5 categories pre-seeded with 15 items each:
- Famous People
- Animals
- Movies
- Food & Drink
- Sports

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
