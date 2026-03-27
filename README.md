---
TODO
- drift correction to stay more in sync
- only makt it download the video once its approved. same for bumps
---

# Synchronized Video + Chat Server

This Node.js project provides:

* Synchronized video playback across all clients
* Queue management (admin controlled)
* Chat system with `/submit` command to submit videos to queue katita and live forever and ever happy and long together ,3
* Admin panel with basic auth
* Public media player page

## Installation

1. Clone the repo:

```bash
git clone <repo-url>
cd project
```

2. Install dependencies:

```bash
npm install express socket.io sqlite sqlite3
```

3. Set package.json to ES Modules:

```json
{
  "type": "module"
}
```

4. Run the server:

```bash
node server/index.js
```

5. Open browser:

```
http://localhost:3000  → Media player
http://localhost:3000/admin  → Admin panel
```

## Architecture Diagram (ASCII)

```
+----------------------+        +----------------------+
|      Clients         |<-----> |    Socket.IO Server  |
|  (media player &     |        |  (initSockets)      |
|   chat UI)           |        +----------------------+
+----------------------+                   |
        | Chat / State                     |
        v                                   v
+----------------------+        +----------------------+
|   Chat Domain        |        |  Playback Domain     |
| chatHandler.js       |        | state.js            |
| commandParser.js     |        | controller.js       |
| commandHandler.js    |        | scheduler.js        |
+----------------------+        +----------------------+
         |                               |
         v                               v
+----------------------+        +----------------------+
|   Queue Domain       |<------ | Database (SQLite)   |
| queueService.js      |        | videos table        |
| queueRepository.js   |        +----------------------+
+----------------------+

Admin Panel → HTTP Requests → adminRoutes.js → Playback / Queue Domains
```

## Features

* Playback Domain: server-side playback state, scheduler auto-next video, pause/play/skip controls
* Queue Domain: DB-backed queue, admin approvals, emits queue updates
* Chat Domain: real-time messages, `/submit` command, system messages
* Sockets: single source of truth, emits `state`, `queue`, `chat:*`
* Admin Panel: HTTP Basic Auth, manage queue, control playback
* Public Routes: serve media player and static assets

## Dependencies

* `express` → Web framework
* `socket.io` → WebSocket communication
* `sqlite3` → Database

Install with:

```bash
npm install express socket.io sqlite3
```

## Run

```bash
node server/index.js
```

Open browser at `http://localhost:3000` to see the media player.
