import { handleChat } from '../domains/chat/chatHandler.js';
import { buildEnrichedState } from '../domains/playback/controller.js';
import { state as playbackState } from '../domains/playback/state.js';
import { getQueue } from '../domains/queue/queueService.js';
import dbPromise from '../config/db.js';

export let ioInstance = null;

const colorPalette = [
  'text-primary-fixed',
  'text-secondary-fixed',
  'text-tertiary-fixed',
  'text-primary',
  'text-secondary',
  'text-error'
];

function getRandomColor() {
  return colorPalette[Math.floor(Math.random() * colorPalette.length)];
}

export function initSockets(io) {
  ioInstance = io;

  io.on('connection', async (socket) => {
    console.log('Client connected');

    // Resolve authenticated username from session (if logged in)
    const sess = socket.request.session;
    socket.authedUsername = sess?.userId ? sess.username : null;

    // Assign user a color
    const userColor = getRandomColor();
    socket.userColor = userColor;

    // Send initial state, queue, and chat history
    socket.emit('state', await buildEnrichedState());
    socket.emit('queue', await getQueue());

    // Send chat history
    const db = await dbPromise;
    const chatHistory = await db.all("SELECT id, user, text, color, timestamp FROM messages ORDER BY id ASC LIMIT 50");
    socket.emit('chat:history', chatHistory);

    // Send welcome message after history so it appears most recent
    const welcomeRow = await db.get("SELECT value FROM settings WHERE key='welcome_message'");
    if (welcomeRow?.value) {
      socket.emit('chat:welcome', { text: welcomeRow.value });
    }

    // Send user's assigned color
    socket.emit('user:color', { color: userColor });

    // Client emits this after logging in mid-session so we re-read the session
    socket.on('user:authed', () => {
      socket.request.session.reload((err) => {
        if (!err && socket.request.session?.userId) {
          socket.authedUsername = socket.request.session.username;
        }
      });
    });

    socket.on('chat:message', msg => handleChat(msg, socket));

    // Sync ping — client measures RTT and corrects drift
    socket.on('sync:ping', ({ t }) => {
      socket.emit('sync:pong', {
        t,
        serverTime: Date.now(),
        startedAt: playbackState.startedAt,
        playing: playbackState.playing,
        pausedAt: playbackState.pausedAt,
      });
    });
  });
}