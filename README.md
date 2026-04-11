# Fingerboard Network

Fingerboard Network is a synchronized watch-party server where users submit YouTube videos and bumps through chat, admins approve content, and all connected clients stay aligned on shared playback.

## Core Capabilities

- Real-time synchronized playback for all connected clients.
- Periodic drift correction to recover from tab sleep, buffering stalls, or reconnect lag.
- Moderated submission workflow for both full videos and bump clips.
- Admin dashboard for queue control, approvals, chat moderation, and live stats.
- Session-based user accounts with password reset support.

## Synchronization Model

- The server tracks playback using wall-clock timing (`startedAt`) and current play/pause state.
- Clients run drift checks every 30 seconds via `sync:ping` and `sync:pong`.
- Clients hard-seek only when drift exceeds 5 seconds.
- Small drift is intentionally ignored to avoid unnecessary seeking and stutter.

## Submission and Playback Flow

1. Users submit content via chat commands (`/submit` or `/bump`).
2. Content is stored as `pending` and is not downloaded yet.
3. Admin approval triggers `yt-dlp` download.
4. Status transitions: `pending` -> `downloading` -> `approved` or `failed`.
5. Approved videos are automatically added to the playback queue.
6. If nothing is playing, first approved video auto-starts playback.

### Bump Behavior

- Bumps are short interstitial clips between videos.
- Admins can start Bump Loop mode from the admin panel.
- In Bump Loop mode, random approved bumps play continuously.
- The current implementation avoids immediate repeat of the most recently played bump when possible.

## Admin Features

- HTTP Basic Auth protection for admin routes.
- Submissions management (approve/remove/remove all).
- Queue operations (remove, shuffle, clear).
- Bump management (approve/remove/remove all, start bump loop).
- Playback controls (play, pause, skip).
- Chat log moderation (view/delete messages).
- Live stats endpoint with connected clients and content counts.

## High-Level Architecture

- Client UI: public player/chat and separate admin pages.
- HTTP API: Express routes for public, auth, and admin functionality.
- Real-time layer: Socket.IO for state sync, chat, and status events.
- Domain modules: playback, queue, media, bumps, auth, chat.
- Data store: SQLite for media, queue, bumps, users, settings, messages, and reset tokens.
- Download worker: `yt-dlp` + `ffmpeg` pipeline for approved media.

## Tech Stack

- Node.js 22 (ES modules)
- Express 5
- Socket.IO
- SQLite (`sqlite` + `sqlite3`)
- `p-queue` for concurrency-limited download jobs
- `bcryptjs` + `express-session` for authentication
- Resend API (optional) for password reset email

## Deployment (Docker)

### Requirements

- Docker Engine 24+
- Docker Compose v2+
- Reverse proxy for TLS termination (nginx example shown below)

### 1. Clone and prepare data

```bash
git clone <repo-url>
cd fingerboard-network
mkdir -p data
```

The `data` directory is bind-mounted to `/app/data` and stores:

- SQLite database (`/app/data/db.sqlite`)
- downloaded videos (`/app/data/videos`)

If you created `data/` as root, fix ownership once:

```bash
chown -R 1000:1000 data/
```

### 2. Configure environment

```bash
cp .env.example .env
```

Recommended minimum values:

```env
ADMIN_USER=admin
ADMIN_PASS=replace-with-strong-password
SESSION_SECRET=replace-with-long-random-secret
SITE_URL=https://your-domain.com

# Optional for password reset emails
RESEND_API_KEY=
RESEND_FROM=noreply@your-domain.com
```

### 3. Build and start

```bash
docker compose up -d --build
```

### 4. Verify

```bash
docker compose logs -f
```

Expected startup log includes:

```text
Server running on http://localhost:3000
```

### 5. Update

```bash
git pull
docker compose up -d --build
```

`data/` is persistent, so content and database survive rebuilds.

## Reverse Proxy (nginx Example)

The compose service binds to `127.0.0.1:3000`, so a proxy can expose HTTPS publicly.

```nginx
server {
  listen 80;
  server_name your-domain.com www.your-domain.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

For Debian/Ubuntu hosts, one typical setup is:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## Local Development

### Requirements

- Node.js 22+
- Executable `yt-dlp` at `bin/yt-dlp`

### Run

```bash
npm install
cp .env.example .env
npm run dev
```

Local defaults:

- App: `http://localhost:3000`
- DB: `./database/db.sqlite`
- Video storage: `./videos`

Database and media directories are created automatically if missing.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ADMIN_USER` | yes | HTTP Basic Auth username for admin routes |
| `ADMIN_PASS` | yes | HTTP Basic Auth password for admin routes |
| `SESSION_SECRET` | yes | Session signing secret |
| `SITE_URL` | recommended | Base URL used in password reset flow |
| `RESEND_API_KEY` | optional | Enables email-based password reset |
| `RESEND_FROM` | optional | Sender email address for reset emails |
| `DB_PATH` | optional | SQLite database path |
| `VIDEO_DIR` | optional | Root directory for downloaded media |
| `YT_DLP_BIN` | optional | Path to `yt-dlp` binary |

## Chat Commands

| Command | Description |
|---|---|
| `/submit <url>` | Submit a video for admin review |
| `/bump <url>` | Submit a bump for admin review |

## Default URLs

| URL | Purpose |
|---|---|
| `/` | Public player + chat |
| `/debug` | Debug client page |
| `/admin` | Admin entry point (redirects to queue) |
| `/admin/submissions` | Submission moderation |
| `/admin/queue` | Queue controls |
| `/admin/bumps` | Bump moderation and loop controls |
| `/admin/stats` | Live system stats |
| `/admin/chat` | Chat moderation |

## Operational Notes

- Download work is queued with concurrency limits for stability.
- Deleting submissions or bumps removes associated files when present.
- Last 50 chat messages are sent to newly connected clients.
- No automated test suite is currently configured (`npm test` is a placeholder).
