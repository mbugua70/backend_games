# Backend Games

A single backend hosting multiple game backends behind one Express
app and one deploy.

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
| `FEEDBACK_API_KEY` | Static key the `x-api-key` header must match to use `/api/feedback` (min 20 chars) |
| `SAFARICOM_CEO_ORG_SLUG` | Which Organization safaricom_ceo's public (no-org-in-URL) endpoints belong to |
| `SAFARICOM_CEO_RATE_LIMIT_*` / `SAFARICOM_CEO_LOGIN_RATE_LIMIT_*` | Rate limit window/max for safaricom_ceo's public endpoints and admin login respectively |

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
