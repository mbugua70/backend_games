# Backend Games

A single backend hosting multiple game backends behind one Express
app and one deploy.

The only game currently implemented is **jigsaw_puzzle**: a live,
TV-based picture puzzle game show that syncs a TV display and a
facilitator (control) client in real time over Socket.IO.

## Tech stack

Node.js, Express, TypeScript, MongoDB/Mongoose, Socket.IO, Zod, Pino.

## Setup

```bash
npm install
cp .env.example .env   # fill in your own values
npm run dev
```

## Environment variables

| Variable | Description |
|---|---|
| `PORT` | HTTP port the server listens on |
| `NODE_ENV` | `development` \| `production` \| `test` |
| `MONGO_URI` | MongoDB connection string |
| `CLIENT_URL` | Origin(s) allowed by CORS/Socket.IO (comma-separated for multiple) |
| `LOG_LEVEL` | Pino log level |
| `JWT_SECRET` | Signs/verifies admin bearer tokens (min 32 chars) |
| `JWT_EXPIRES_IN` | Admin token lifetime |

Startup validates these and exits on anything missing or malformed
rather than running half-configured.

## Scripts

```bash
npm run dev      # auto-restart on changes
npm run build    # compile to dist/
npm run start    # run compiled build
npm run lint
```

Admin accounts are created by an offline script (no HTTP signup
endpoint) — run `npm run` with no arguments to see the available
`seed:admin:*` commands.

Architecture, folder layout, and endpoint details are documented
separately for contributors rather than in this file.
