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

## carrefour_balloon (`src/games/carrefour_balloon/`)

Backend for a brand-festival balloon-pop game: an admin configures
events, participating brands, and gift inventory; the frontend
(Next.js) runs the actual balloon-pop/reveal logic **locally** and
only calls this backend to load configuration, optionally register a
participant, and record a win it already decided locally. This
backend never computes a pop's outcome — there is deliberately no
"pop a balloon" endpoint.

Same layering as the other REST games: `Route -> Controller -> Service
-> Mongoose Model`, controllers only Zod-validate and shape responses,
all rules live in `services/`. Routes mounted at
`/api/carrefour_balloon/v1/...` (public) and
`/api/admin/carrefour_balloon/v1/...` (admin, behind `requireAdmin` +
`services/eventAccess.ts#assertEventOwnedByOrg` on every event-scoped
query, same organization-isolation discipline as the Admin auth
section above).

**Gift pool mode.** `Event.giftPoolMode` is `"shared"` (default, every
brand plays the event's one gift pool) or `"perBrand"` (each brand has
its own). Both kinds of `GiftPool` document can exist for an event at
once regardless of which mode is active — switching modes
(`PATCH .../gift-pool-mode`) only changes which one
`services/giftPool.service.ts#resolveGiftPool` resolves to; it never
resets stock, copies inventory, or deletes the other configuration. A
brand with no pool configured in `perBrand` mode gets an explicit
"unavailable" result (reason string), not a 500 or a silently empty
gift list.

**Probability model.** Each pool's gifts are configured in
`GiftPoolEntry` with an integer `probabilityPercent` out of
`PROBABILITY_UNITS_TOTAL` (10,000 basis points = 100%, see
`models/GiftPoolEntry.ts`) to avoid floating-point boundary issues —
the admin REST API itself still speaks ordinary percent (e.g. `5` =
5%), converted at the controller boundary
(`controllers/giftPoolEntry.controller.ts`'s `toBasisPoints`/
`toPercent`). `services/probability.service.ts#isGiftEligible` is the
one place that decides a gift is awardable: visible, award-enabled,
in stock, and not archived. An ineligible gift's probability becomes
no-gift probability — it is **never** redistributed to other gifts.
`assertProbabilityBudget` rejects a configuration where the pool's
total configured `probabilityPercent` — summed across every entry,
including hidden/disabled ones — would exceed 100%, so re-enabling a
hidden gift later can never silently blow the budget.

**Win recording is the one place stock actually changes from
gameplay** (`POST .../events/:eventId/wins`,
`services/win.service.ts#recordWin`). Unlike every other game in this
repo, it uses a real MongoDB transaction
(`mongoose.startSession().withTransaction()`) to decrement
`GiftPoolEntry.availableQuantity` and insert the `WinningRecord`
atomically — chosen deliberately over this repo's usual
no-transaction/atomic-single-document convention (see `GameSession.ts`
in ar_basketball) because two simultaneous requests for a gift's last
unit must never both succeed, and this backend's documented production
target (MongoDB Atlas, see `.env.example`) is already a replica set,
so the transaction requirement costs nothing in production. It only
matters for local tests: `tests/testUtils/mongoReplSet.ts` boots a
one-node `MongoMemoryReplSet` instead of the `MongoMemoryServer`
standalone other games' tests use. `recordWin` is idempotent on a
client-supplied `idempotencyKey` (same key + same request data ⇒
returns the original result, no second decrement; same key + different
data ⇒ `409`) and rejects a second win for the same
`(eventId, brandId, roundId, balloonId)` outright — no individual
balloon *outcome* is ever stored, only the winning one.

**Socket.IO is additive, not a replacement for the REST config
endpoint.** `GET .../events/:eventId/game-config` stays the
spec-required, firewall-safe source of truth for loading/re-loading
configuration (the frontend should still fetch it fresh when starting
a new round or switching brands). `sockets/game.socket.ts` reintroduces
Socket.IO to this repo (dropped when jigsaw_puzzle's TV-show mechanic
was removed, see `git log d236a58`) on its own namespace
(`/carrefour_balloon`): a client emits `game:join` with
`{ eventId, brandId? }`, the server resolves the same gift pool REST
would, joins the socket to a pool-scoped room, and acks with the same
`game:config` payload REST returns —
`services/gameConfig.service.ts#getGameConfig` and
`services/poolSnapshot.service.ts#buildPoolSnapshot` are the single
mappers both paths share, so REST and sockets can never drift on what
"the config" looks like (same principle this file documents for
jigsaw_puzzle's `toGameStatePayload` above). Whenever a win is
recorded or an admin changes gift visibility/odds/stock/balloon
settings, `sockets/broadcast.ts#broadcastPoolUpdate` pushes a lighter
`game:pool-updated` delta to every socket in that pool's room, so two
devices playing the same brand/pool never drift on what's actually
left to win. This narrows, not replaces, the race the transaction
above actually closes — the socket push shrinks the window where two
devices both think a gift is available, but only the transaction
guarantees exactly one of two simultaneous "last unit" wins succeeds.
`sockets/ioRegistry.ts` holds the shared `Server` instance `server.ts`
creates (per this file's "exactly one Socket.IO instance" rule above)
so services can broadcast without threading `io` through every call;
a broadcast is a safe no-op if no socket server has been registered
(e.g. in unit tests).

**Frontend integration contract:**

1. `GET /api/carrefour_balloon/v1/events/:eventId/game-config` (no
   `brandId`) for the brand-selection screen; with `brandId` for the
   full config needed to run a round. Optionally also open a socket
   (`game:join`) for the same `(eventId, brandId)` to get live updates
   without re-fetching.
2. If `data.registration.enabled`, `POST .../participants` before
   play; otherwise play begins immediately with a client-generated
   `anonymousIdentity`.
3. Create a round locally; assign `guaranteedNoGiftBalloonCount`
   balloons as guaranteed-empty, then draw the rest from each visible
   gift's `effectiveProbabilityPercent` (one categorical draw per pop,
   not independent per-gift checks) plus
   `effectiveNoGiftProbabilityPercent`. Track remaining quantity
   locally, capped at each gift's fetched `availableQuantity` for the
   round; once a gift is locally depleted, its probability becomes
   no-gift probability for later pops in that round — never
   redistributed.
4. A losing/empty pop: no backend request at all.
5. A winning pop: `POST .../wins` with the client-generated
   `idempotencyKey`, `roundId`, and `balloonId`, the resolved
   `brandId`/`giftPoolId`/`giftId`, and the participant token (or
   `anonymousIdentity`). Treat the local reveal as **provisional**
   until this call returns `201` — only then show the confirmed
   `claimReference`. A `409` (`"This gift is no longer available"`)
   means stock ran out between the local draw and the request landing;
   show that honestly rather than awarding a different gift.
6. Re-fetch config (or rely on the live socket snapshot) before the
   next round.

Example `GET .../game-config?brandId=...` response shape (abridged):

```json
{
  "success": true,
  "data": {
    "event": { "id": "...", "name": "Carrefour Balloon Festival", "status": "live", "available": true },
    "brands": [{ "id": "...", "name": "Carrefour", "logoUrl": "..." }],
    "selectedBrand": { "id": "...", "name": "Carrefour", "logoUrl": "..." },
    "giftPoolMode": "shared",
    "giftPoolId": "...",
    "configVersion": 3,
    "balloonSettings": { "balloonCount": 20, "guaranteedNoGiftBalloonCount": 5, "maxPopsPerRound": 5, "maxWinsPerRound": 1 },
    "gifts": [{ "id": "...", "name": "Tote Bag", "availableQuantity": 48, "configuredProbabilityPercent": 500, "effectiveProbabilityPercent": 500, "eligible": true }],
    "effectiveNoGiftProbabilityPercent": 9300,
    "registration": { "enabled": false, "fields": [], "consentText": null },
    "unavailableReason": null
  }
}
```

Example `POST .../wins` request/response:

```json
// request
{
  "idempotencyKey": "client-uuid-1",
  "brandId": "...", "giftPoolId": "...", "giftId": "...",
  "roundId": "round-uuid-1", "balloonId": "balloon-7",
  "configVersion": 3, "anonymousIdentity": "device-uuid-1"
}
// 201 response
{ "success": true, "data": { "winId": "...", "claimReference": "CB-AB12CD34", "claimStatus": "pending", "gift": { "id": "...", "name": "Tote Bag", "imageUrl": null }, "receivedAt": "..." } }
```

Honest limitations this contract does not paper over: the frontend's
local draw/browser state can be manipulated, a fetched
`availableQuantity` does not reserve stock, two devices can both
locally reveal the same "last" gift before either submits, this
backend validates and records submitted wins but cannot prove the
frontend actually followed the probability rules, and a probability
describes a chance, not a guarantee (5% does not mean "one win in
every twenty pops"). Admin stats
(`GET .../events/:eventId/stats`) deliberately report only accepted
wins and remaining stock — never total plays or losing-pop counts,
since the frontend never reports those.

Admin accounts follow the same offline-seed pattern as the Admin auth
section above:

```bash
npm run seed:admin:carrefour_balloon -- --org <slug> [--org-name <name>] --username <u> --password <p>
npm run seed:demo:carrefour_balloon
```

the second seeds a ready-to-play demo event (shared pool, three
brands, two per-brand pools, and one gift each at normal/0%-probability/
award-disabled/out-of-stock) for manually exercising the flow above
without hand-building one through the admin API first.
