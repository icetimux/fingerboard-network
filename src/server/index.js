// server/index.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import session from 'express-session';

import { initSockets } from './sockets/socketHandler.js';
import { startScheduler } from './domains/playback/scheduler.js';
import adminRoutes from './routes/adminRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import authRoutes from './routes/authRoutes.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'fbn-secret-please-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 },
});

// Middleware
app.use(express.json());
app.use(sessionMiddleware);

// Share session with Socket.IO so socket.request.session is available
io.engine.use(sessionMiddleware);

// Routes
app.use('/admin', adminRoutes);
app.use('/auth', authRoutes);
app.use('/', publicRoutes);

// Initialize WebSocket connections
initSockets(io);

// Start playback scheduler
startScheduler();

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});