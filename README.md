# Fingerboard Network

A synchronized internet TV server — community members submit YouTube videos and bumps via chat, admins review and approve them, and every connected client watches in perfect sync.

---

## Features

### Synchronized Playback
- All clients play the same video at the same position in real time
- Server tracks wall-clock `startedAt` for accurate position across connects
- **Drift correction**: every 30 seconds clients ping the server and hard-seek if drift exceeds 5 seconds (e.g. after a long buffer stall or tab sleep) — normal small drift is intentionally ignored to prevent stuttering

### Queue
- DB-backed playback queue (FIFO — first submitted, first played)
- Admin can shuffle, clear the entire queue, or remove individual entries
- Auto-starts playback when the first video is approved if the player is idle

### Bumps
- Short interstitial clips played between videos
- Submitted via `/bump <url>` in chat, reviewed and approved by admins
- **Bump Loop mode**: plays random approved bumps back-to-back (no repeat until all played), automatically exits when a video is queued

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
- **Stats page**: live viewer count and server uptime
- **Chat Log page**: view and delete chat messages in real time
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
- nginx installed on the host (acts as reverse proxy for HTTPS)
- Ports 80 and 443 open on the server

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

### 4. Set up nginx + HTTPS

The container binds to `127.0.0.1:3000` only — nginx sits in front and handles HTTPS.

```bash
apt install -y nginx certbot python3-certbot-nginx
```

Create `/etc/nginx/sites-available/fingerboard-network`:

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

```bash
ln -s /etc/nginx/sites-available/fingerboard-network /etc/nginx/sites-enabled/
systemctl enable --now nginx
certbot --nginx -d your-domain.com -d www.your-domain.com
```

Certbot automatically configures HTTPS and sets up auto-renewal.

### 5. Build and start

```bash
docker compose up -d --build
```

On the first build Docker installs `ffmpeg` and `python3` (required by yt-dlp) via Alpine's package manager, then copies `bin/yt-dlp` from the repo into the image. This may take a minute on a fresh server.

### 6. Verify

```bash
docker compose logs -f
```

You should see `Server running on http://localhost:3000`. The app is reachable externally via nginx at `https://your-domain.com`.

### Updating

```bash
git pull
docker compose up -d --build
```

> **Note:** If nginx config or SSL certs are already in place, you don't need to redo those steps — just rebuild the container.

The `data/` directory is never touched during updates — your database and videos are safe.

### Access

| URL | Description |
|-----|-------------|
| `https://your-domain.com` | Public media player + chat |
| `https://your-domain.com/admin` | Admin panel (Basic Auth) |
| `https://your-domain.com/admin/submissions` | Review submissions |
| `https://your-domain.com/admin/bumps` | Manage bumps |
| `https://your-domain.com/admin/queue` | Manage playback queue |
| `https://your-domain.com/admin/stats` | Live stats |
| `https://your-domain.com/admin/chat` | Chat log |

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
| `resend` | Password reset emails (optional) |
| `nodemon` | Dev auto-restart |
