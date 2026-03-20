// server/index.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

import { initSockets } from './sockets/socketHandler.js';
import { startScheduler } from './domains/playback/scheduler.js';
import adminRoutes from './routes/adminRoutes.js';
import publicRoutes from './routes/publicRoutes.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Middleware
app.use(express.json());

// Routes
app.use('/admin', adminRoutes);
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