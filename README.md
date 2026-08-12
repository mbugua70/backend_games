# TV Picture Puzzle Game — Backend

Backend for a live, TV-based picture puzzle game show. It manages game
sessions, generates game codes, holds the authoritative game state
(score, puzzle progression, status), and keeps a **TV display** client
and a **facilitator (control)** client in sync in real time over
Socket.IO.

This backend does **not** store puzzle images, answers, or words — that
content lives entirely in the frontend. The backend only ever knows
*which puzzle ID* is currently active (`puzzleIds` + `currentPuzzleIndex`).

## Tech stack

Node.js, Express, TypeScript, MongoDB/Mongoose, Socket.IO, Zod, Pino.

## Installation

```bash
npm install
```

Copy the example env file and fill in your own values:

```bash
cp .env.example .env
```

## Environment variables

| Variable | Description | Example |
|---|---|---|
| `PORT` | HTTP port the server listens on | `5000` |
| `NODE_ENV` | `development` \| `production` \| `test` | `development` |
| `MONGO_URI` | MongoDB connection string (local or Atlas) | see below |
| `CLIENT_URL` | Origin(s) allowed by CORS/Socket.IO. Comma-separated if the facilitator and display frontends are on different domains | `http://localhost:5173` or `https://facilitator.example.com,https://display.example.com` |
| `LOG_LEVEL` | Pino log level | `info` |
| `JWT_SECRET` | Signs/verifies admin dashboard bearer tokens (min 32 chars) | generate with `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | Admin token lifetime | `12h` |

`env.ts` validates these with Zod at startup — the process exits
immediately with a logged error if anything required is missing or
malformed, rather than starting in a half-configured state.

### Connecting to MongoDB

**Local:**
```env
MONGO_URI=mongodb://localhost:27017/picture-puzzle
```

**Atlas:**
```env
MONGO_URI=mongodb+srv://<db_user>:<db_password>@<cluster-host>/picture-puzzle?appName=<app-name>
```

Make sure the database name (`/picture-puzzle` above) is included in
the URI — without it Mongo defaults to a database literally called
`test`. If using Atlas, the connecting IP must be allow-listed in the
Atlas dashboard's Network Access settings.

## Running

```bash
npm run dev         # nodemon + tsx, auto-restarts on src/ changes
npm run build       # tsc -> dist/
npm run start       # node dist/server.js (run build first)
npm run lint        # eslint .
npm run seed:admin  # create/reset an admin dashboard login (see below)
```

### Creating an admin account

There is deliberately no HTTP endpoint to create an admin — the only
way in is this terminal script, so there's nothing internet-reachable
to attack to mint an account:

```bash
npm run seed:admin
```

Prompts for an email and a masked password (typed twice to confirm).
Rerunning with the same email resets that admin's password; a
different email adds another admin. For scripted/non-interactive runs,
set `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD` in the environment instead
of typing them.

## Folder structure

```text
src/
├── config/          env.ts (Zod-validated env), constants.ts (game tunables),
│                     database.ts (mongoose connect/disconnect + logging)
├── logger/           logger.ts - single Pino instance, pretty in dev / JSON in prod
├── types/            game.types.ts (GameStatus, GameStatePayload, Role),
│                     socket.types.ts (typed Socket.IO event maps)
├── utils/            AppError, asyncHandler, response envelope, gameCode generator,
│                     jwt.ts (admin token sign/verify), csv.ts, dateRange.ts
│                     (Africa/Nairobi day boundaries for report filters)
├── models/           GameSession.ts (-> game_sessions), Player.ts, Score.ts, Admin.ts
├── validators/       game.validator.ts, player.validator.ts, score.validator.ts,
│                     admin.validator.ts, report.validator.ts - one Zod schema per action
├── services/         game.service.ts - all game logic and state transitions;
│                     player.service.ts, score.service.ts, admin.service.ts,
│                     report.service.ts - the self-service kiosk + admin side
├── controllers/      game.controller.ts, player.controller.ts, score.controller.ts,
│                     admin.controller.ts, report.controller.ts - REST glue
├── middleware/       errorHandler.ts, notFound.ts, requireAdmin.ts (bearer-token gate)
├── scripts/          seedAdmin.ts - the only way to create an admin login (no HTTP route)
├── routes/           game.routes.ts, player.routes.ts, score.routes.ts,
│                     admin.routes.ts, report.routes.ts
├── sockets/          index.ts (Socket.IO server setup), game.socket.ts (event
│                     handlers), timer.manager.ts (question timeout scheduling),
│                     presence.manager.ts (per-role connection tracking)
├── app.ts             Express app: helmet, cors, rate limiting, pino-http, routes
└── server.ts          http server, DB connect, Socket.IO init, graceful shutdown
```

## Architecture

Strict layering for REST:

```text
Route -> Controller -> Service -> Mongoose Model
```

Controllers only validate input (Zod), call a service function, and
shape the HTTP response — no game logic lives there. All game rules
(scoring, status transitions, puzzle progression) live in
`services/game.service.ts`, which is completely transport-agnostic: it
has no knowledge of Express or Socket.IO, and returns a single DTO
shape (`GameStatePayload`) used identically by both.

Socket.IO is a **parallel path into the same service layer**, not a
separate copy of the logic:

```text
Socket event -> Zod validate -> role check -> Service -> broadcast game:state
```

The one piece of state that lives outside MongoDB is the **question
timer** (`sockets/timer.manager.ts`, an in-memory `Map` keyed by game
code) and **presence tracking** (`sockets/presence.manager.ts`, tracks
which socket IDs are connected per role per game). Both are
transport-layer concerns — they need to call back into `io.emit(...)`
or reason about individual live connections, which the DB-only service
layer deliberately knows nothing about.

## How the TV and facilitator communicate

Every game has one Socket.IO room, `game:<CODE>`. Both the **display**
(TV) and **facilitator** (control) clients connect to the same room by
emitting `game:join` with their role. From then on:

- The facilitator emits control events (`game:start`, `game:judge`,
  `game:pause`, `game:resume`, `game:skip`, `game:restart`, `game:end`).
- The server validates the payload, checks the emitting socket
  actually joined *that* game as `facilitator` (a `display` socket, or
  a socket that joined a different game, gets a clean ack error and no
  state change), runs the corresponding service function, and
  broadcasts one `game:state` event to the whole room.
- The display client is purely reactive — it only ever listens for
  `game:state` and renders whatever it receives. It never computes
  score or timing itself; the backend is the single source of truth.

**Reconnects:** if the facilitator's socket drops while the game is
`"playing"`, the game auto-pauses so nothing times out unattended; the
facilitator must send `game:resume` after reconnecting. Multiple
sockets of the same role are tracked individually (`presence.manager`),
so a stale disconnect from an old tab won't wrongly flip
`facilitatorConnected`/`displayConnected` to false while a fresh
reconnect is still live.

**Pacing:** `game:judge` (and the internal auto-timeout) only record
the outcome — status becomes `"correct"` / `"wrong"` / `"timeout"` and
stays there so the TV can display it. `game:skip` is what actually
advances to the next puzzle (or finishes the game if none remain); it
only counts as a "skip" in the stats if the puzzle was still
unanswered. This keeps pacing entirely under the facilitator's control.

## REST endpoints

All responses use the envelope `{ success, data?, message? }`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness check → `{ "status": "ok" }` |
| `POST` | `/api/game-sessions` | Create a session. Body: `{ puzzleIds: string[] }`. Returns `{ gameCode, displayUrl, facilitatorUrl }` |
| `GET` | `/api/game-sessions/:gameCode` | Full current game state |
| `DELETE` | `/api/game-sessions/:gameCode` | Remove a session |

### Self-service kiosk endpoints (`online_rubuspuzzle`)

Unrelated to the game-sessions endpoints above - no facilitator, no
Socket.IO, one attempt per staff ID.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/players/login` | Body: `{ staffId, name }`. Returns `{ playerId, sessionId, staffId, name }`. `409` if that staff ID already played. |
| `POST` | `/api/scores/submit` | Body: `{ sessionId, playerId, staffId, name, score, correctCount, totalPuzzles, durationMs, answers[] }`. Returns `{ scoreId }`. |

### Admin reporting endpoints

Powers the `/admin` dashboard in `online_rubuspuzzle`. Bearer-token
auth (`Authorization: Bearer <token>`), not a cookie — the dashboard
and this API are on different domains, and a cookie there would be
third-party and liable to browser blocking. Tokens are minted by
`POST /login` and expire after `JWT_EXPIRES_IN`. The only way to
create an admin account is `npm run seed:admin` (see above) — there is
no signup endpoint.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/admin/auth/login` | none (rate-limited: 10/15min) | Body: `{ email, password }`. Returns `{ token, email }`. |
| `GET` | `/api/admin/auth/me` | bearer | Validates the stored token. Returns `{ email }`. |
| `GET` | `/api/admin/reports/players` | bearer | Query: `date` (`YYYY-MM-DD`, Africa/Nairobi), `q` (staffId/name search), `sortBy` (`score` default \| `date`), `sortOrder` (`desc` default \| `asc`), `page`, `limit`. Returns `{ items[], total, page, limit }`. |
| `GET` | `/api/admin/reports/summary` | bearer | Returns `{ totalPlayers, averageScore, topScore, playDays: [{ date, count }] }` — `playDays` is computed from actual data, not hardcoded event dates. |
| `GET` | `/api/admin/reports/export` | bearer | Same filters as `/players` (no pagination). Streams a `text/csv` file. |

## Socket.IO events

**Incoming** (client → server, all take `{ gameCode, ... }` and an
optional ack callback receiving `{ success, data }` or `{ success:
false, message }`):

`game:join` (+`role: "display" | "facilitator"`), `game:start`,
`game:judge` (+`result: "correct" | "wrong"`), `game:pause`,
`game:resume`, `game:skip`, `game:restart`, `game:end`

**Outgoing** (server → clients in the room):

`game:state` — the full `GameStatePayload`, broadcast after every
successful action. There is deliberately no finer-grained event; every
client always gets the complete current state.

## Future plans

Puzzle CRUD and image storage are out of scope for this backend by
design — puzzle content lives in the frontend today. If that ever
needs to move server-side (e.g. a shared puzzle bank across multiple
frontends), it would live in its own collection/module without
touching the game-session state machine described above.
