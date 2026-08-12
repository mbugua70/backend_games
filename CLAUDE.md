# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                        # nodemon + tsx, auto-restarts on src/ changes, connects to MONGO_URI
npm run build                      # tsc -> dist/ (noEmitOnError: strict, must be clean)
npm run start                      # node dist/server.js (run build first)
npm run lint                       # eslint . (flat config, typescript-eslint recommended)
npm run seed:admin:jigsaw_puzzle   # create/reset a jigsaw_puzzle admin login - the only way to get one, no HTTP route does this
```

No test suite exists in this repo. `.env` (gitignored) holds `PORT`,
`NODE_ENV`, `MONGO_URI`, `CLIENT_URL`, `LOG_LEVEL`, `JWT_SECRET`,
`JWT_EXPIRES_IN` — see `.env.example` for the shape;
`src/core/config/env.ts` validates these with Zod at startup and exits
the process on failure rather than running half-configured.

## Repo shape: one backend, many games

This repo hosts multiple independent game backends behind a single
Express app and a single deploy, instead of standing up a new hosting
project for every new game. Each game lives in its own
`src/games/<name>/` folder with whatever subset of
`controllers/services/models/routes/validators/types` it actually
needs — `sockets/` only exists inside a game's folder if that game
needs live sync (most won't).

`src/core/` holds only transport-agnostic infra any game may use: env
validation, DB connect/disconnect, the logger, error-handling
middleware, `AppError`/`asyncHandler`/`response` helpers, and the
shared `Organization` directory (see Admin auth below). `core/`
deliberately has zero knowledge of any single game's rules — a file
belongs there only if it would make equal sense in every game's
folder.

`app.ts` mounts each game's router at its own path prefix
(`/api/<name>/...`). `server.ts` creates exactly one HTTP server and
one Socket.IO instance; a game that needs sockets registers its own
handlers onto that shared instance from inside its own `sockets/`
folder, a game that doesn't need sockets never touches it.

Adding a new game means creating `src/games/<name>/` and one mount
line in `app.ts` — no new hosting project, no new deploy. This trades
away process isolation between games (one game's crash or deploy
briefly affects the others sharing the process) for much simpler
day-to-day ops; that trade only makes sense because these games are
rarely live at the same time — confirm that's still true before
assuming it for a new game.

The only game currently implemented is **jigsaw_puzzle**. Two other
games — `rubus_puzzle` (a self-service kiosk + admin reporting
dashboard) and `tugwar` — previously lived in this repo undifferentiated
at the top level (not yet split into their own folders) and were
removed to start this restructure. Both are fully recoverable from git
history whenever they come back, at which point they should land as
their own `src/games/<name>/` folders following the pattern below.

## jigsaw_puzzle (`src/games/jigsaw_puzzle/`)

This is the backend for a live TV picture-puzzle game show: it manages
game sessions, generates game codes, and holds the authoritative game
state, syncing a TV **display** client and a **facilitator** (control)
client over Socket.IO. It deliberately does **not** own puzzle content
(images/answers/words) — that lives in the frontend. The backend only
ever knows a puzzle ID string and its index in `puzzleIds`.

**Strict layering for REST**: `Route -> Controller -> Service -> Mongoose Model`.
`controllers/game.controller.ts` only Zod-validates input, calls a
service function, and shapes the response — no game logic there.

**All game rules live in `services/game.service.ts`**, which is
completely transport-agnostic (no Express or Socket.IO imports). It
returns one DTO shape, `GameStatePayload` (`types/game.types.ts`), used
identically as the REST `GET` response body and the Socket.IO
`game:state` broadcast payload — there is one mapper
(`toGameStatePayload`) that produces it, so REST and sockets can never
drift apart on what "the state" looks like.

**`sockets/` is a parallel path into the same service layer**, not a
second copy of the logic: `socket event -> Zod validate -> role check
-> service function -> broadcast game:state to the room`. Every game
has one room, `game:<CODE>`. Control events
(start/judge/pause/resume/skip/restart/end) are rejected unless the
emitting socket joined that specific game as `"facilitator"`
(`sockets/game.socket.ts`'s `assertFacilitator`).

Two pieces of state intentionally live **outside MongoDB**, in-memory,
because they're transport-layer concerns the DB-only service layer has
no business knowing about:
- `sockets/timer.manager.ts` — the per-game question-duration auto-timeout
  (a `Map<gameCode, Timeout>`). Fires `gameService.timeoutQuestion()`
  and broadcasts the result when a puzzle's time runs out unanswered.
- `sockets/presence.manager.ts` — tracks connected socket IDs per role
  per game, so a stale disconnect from an old tab can't wrongly flip
  `facilitatorConnected`/`displayConnected` false while a fresh
  reconnect is still live. If the facilitator's *last* socket
  disconnects while the game is `"playing"`, the game auto-pauses.

**Pacing model** (the non-obvious part of the state machine): judging
an answer or timing out only records the outcome — status becomes
`"correct"` / `"wrong"` / `"timeout"` and stays there. `game:skip` is
what actually advances to the next puzzle (or finishes the game), and
only increments `skippedCount` if the puzzle was still unanswered when
skipped. This keeps pacing entirely under the facilitator's control
using only the events already defined, rather than an implicit
auto-advance timer.

REST routes are mounted at `/api/jigsaw_puzzle/sessions`. See
`README.md` for the full REST endpoint list, Socket.IO event payloads,
and env var reference.

## Admin auth (jigsaw_puzzle)

Admin accounts are scoped to a persistent **Organization** — a client
event, e.g. `safaricom-event` — not shared globally. The goal is that
an admin logged in for one client's event structurally cannot see
another client's data (a query filter, not a convention that could be
forgotten in one route).

`Organization` (`{ name, slug }`, `src/core/models/Organization.ts`)
is shared across games since "who the client is" isn't game-specific.
`games/jigsaw_puzzle/models/Admin.ts`
(`{ username, passwordHash, organizationId }`) and
`games/jigsaw_puzzle/middleware/requireAdmin.ts` are game-specific:
`requireAdmin` verifies the bearer token and attaches the decoded
payload to `res.locals.admin` rather than a global `req.admin` type
augmentation, so a second game's admin middleware can never collide
with this one's shape. The mongoose model name is prefixed
(`JigsawPuzzleAdmin`, not `Admin`) because mongoose's model registry is
global per process — an unprefixed name would collide if another game
registers its own `Admin` model later. Follow that prefix convention
for any future per-game model.

There is deliberately no HTTP endpoint to create an admin — the only
way in is:

```bash
npm run seed:admin:jigsaw_puzzle -- --org <slug> [--org-name <name>] --username <u> --password <p>
```

run directly on a machine with `MONGO_URI` access. It finds-or-creates
the `Organization` by slug — so onboarding a new client event is just
seeding its first admin, no separate provisioning step — then upserts
the `Admin` with a bcrypt hash and that `organizationId`.

This is currently auth scaffolding only: no admin routes are mounted
in `app.ts` yet, since jigsaw_puzzle has no admin dashboard or reports
to protect. `requireAdmin` is ready to gate routes whenever that work
happens — at that point, every admin-facing query must filter by
`res.locals.admin.organizationId` for the isolation guarantee above to
actually hold.
