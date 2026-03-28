# Fingerboard Network

A synchronized internet TV server — community members submit YouTube videos and bumps via chat, admins review and approve them, and every connected client watches in perfect sync.

---

## Features

### Synchronized Playback
- All clients play the same video at the same position in real time
- Server tracks wall-clock `startedAt` for accurate position across connects
- **Drift correction**: every 5 seconds clients ping the server, measure round-trip latency, and either hard-seek (>0.5s drift) or nudge `playbackRate` (0.08–0.5s drift) to stay in sync

### Queue
- DB-backed playback queue (FIFO — first submitted, first played)
- Admin can shuffle, clear the entire queue, or remove individual entries
- Auto-starts playback when the first video is approved if the player is idle

### Bumps
- Short interstitial clips played between videos
- Submitted via `/bump <url>` in chat, reviewed and approved by admins
- **Bump Loop mode**: plays random approved bumps back-to-back (no repeat until all played), exits when a video is queued

### Community Submissions
- Chat commands: `/submit <youtube-url>` and `/bump <youtube-url>`
- Submissions enter `pending` state — **no download happens until admin approves**
- Approval triggers download (`yt-dlp`), then moves to `approved` and enqueues automatically
- Status flow: `pending` → `downloading` → `approved` (or `failed`)
- Removing a submission or bump also deletes the video file from disk

### Admin Panel
- HTTP Basic Auth protected
- **Submissions page**: filter by status (All / Approved / Downloading / Failed), approve, remove, Remove All
- **Queue page**: view queue, remove entries, shuffle, clear queue
- **Bumps page**: approve, remove bumps; trigger Bump Loop
- Live playback controls: Play, Pause, Skip

### Chat
- Real-time chat via Socket.IO
- `/submit` and `/bump` commands with URL validation and deduplication
- System messages for submission confirmations and errors
- Persistent chat history (last 50 messages)
- Per-user color assignment

### Auth
- User accounts with sessions (`express-session`)
- Password hashing with `bcryptjs`
- Password reset flow

---

## Architecture

```
  Clients (browser)
  ├── index.html       Media player + chat UI
  └── admin/*.html     Admin panel pages
        │
        │  WebSocket (Socket.IO)          HTTP (Express)
        │  state, queue, chat:*           adminRoutes, publicRoutes
        ▼                                        │
  ┌─────────────────────────────────────────────┤
  │              Socket.IO Server               │
  │  socketHandler.js                           │
  │  sync:ping ↔ sync:pong (drift correction)   │
  └────────────┬────────────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
  ┌────▼────┐     ┌─────▼──────┐
  │Playback │     │    Chat    │
  │ Domain  │     │   Domain   │
  │         │     │            │
  │state.js │     │chatHandler │
  │control  │     │commandHand-│
  │ler.js   │     │  ler.js    │
  │schedul  │     │commandPars-│
  │ er.js   │     │  er.js     │
  └────┬────┘     └─────┬──────┘
       │                │
  ┌────▼────────────────▼──────┐
  │           Domains          │
  ├────────────────────────────┤
  │  Queue   │ Media  │ Bumps  │
  │  Service │Service │Service │
  │  Repo    │ Repo   │ Repo   │
  └────────────────────────────┘
               │
  ┌────────────▼───────────────┐
  │       SQLite Database      │
  │  media · queue · bumps     │
  │  messages · users          │
  └────────────────────────────┘
               │
  ┌────────────▼───────────────┐
  │      yt-dlp (binary)       │
  │  Downloads on approval     │
  │  videos/ · videos/bumps/   │
  └────────────────────────────┘
```

---

## Deployment (Docker)

### Prerequisites

- Docker Engine 24+ and Docker Compose v2
- Port 80 open on the server

### 1. Clone the repo

```bash
git clone <repo-url>
cd fingerboard-network
```

### 2. Create the data directory

`./data` means a folder called `data` in the root of the cloned repo on your server. It is bind-mounted into the container at `/app/data` and holds the SQLite database and all downloaded videos. It is listed in `.gitignore` so git will never touch it.

```bash
mkdir -p data
```

> **Permissions gotcha:** The container runs as the `node` user (UID 1000). If the `data/` directory is owned by root (e.g. you cloned as root and ran `mkdir` as root), the app will fail to write the database file on first start. Fix with:
> ```bash
> chown -R 1000:1000 data/
> ```
> You only need to do this once. The directory persists across `git pull` and container restarts.

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
ADMIN_USER=admin
ADMIN_PASS=a-strong-password
SESSION_SECRET=a-long-random-string-at-least-32-chars
SITE_URL=https://your-domain.com

# Optional — needed only if you use the password reset email feature
RESEND_API_KEY=re_...
RESEND_FROM=noreply@your-domain.com
```

> **Security note:** Never commit `.env` to version control. It is listed in `.gitignore`.

### 4. Build and start

```bash
docker compose up -d --build
```

On the first build Docker installs `ffmpeg` and `python3` (required by yt-dlp) via Alpine's package manager, then copies `bin/yt-dlp` from the repo into the image. This may take a minute on a fresh server.

### 5. Verify

```bash
docker compose logs -f
```

You should see `Server running on http://localhost:3000`. The app is reachable externally on port 80.

### Updating

```bash
git pull
docker compose up -d --build
```

The `data/` directory is never touched during updates — your database and videos are safe.

### Access

| URL | Description |
|-----|-------------|
| `http://your-server` | Public media player + chat |
| `http://your-server/admin` | Admin panel (Basic Auth) |
| `http://your-server/admin/submissions` | Review submissions |
| `http://your-server/admin/queue` | Manage playback queue |
| `http://your-server/admin/bumps` | Manage bumps |

---

## Local Development (without Docker)

### Prerequisites
- Node.js 22+
- `yt-dlp` binary placed at `bin/yt-dlp`

### Install & run

```bash
npm install
cp .env.example .env
# edit .env as needed
npm run dev
```

App runs on `http://localhost:3000`.

> **Note:** The `database/` and `videos/` directories are created automatically on first run if they don't exist.

---

## Chat Commands

| Command | Description |
|---------|-------------|
| `/submit <url>` | Submit a YouTube video for admin review |
| `/bump <url>` | Submit a bump clip for admin review |

Videos and bumps remain `pending` until an admin approves them. Approval triggers the download.

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `express` | Web framework & routing |
| `socket.io` | Real-time WebSocket communication |
| `sqlite` / `sqlite3` | Database |
| `p-queue` | Concurrency-limited download queue |
| `bcryptjs` | Password hashing |
| `express-session` | User sessions |
| `nodemon` | Dev auto-restart |
