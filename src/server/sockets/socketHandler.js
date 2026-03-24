import { handleChat } from '../domains/chat/chatHandler.js';
import { state } from '../domains/playback/state.js';
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

    // Assign user a color
    const userColor = getRandomColor();
    socket.userColor = userColor;

    // Send initial state, queue, and chat history
    socket.emit('state', state);
    socket.emit('queue', await getQueue());

    // Send chat history
    const db = await dbPromise;
    const chatHistory = await db.all("SELECT user, text, color, timestamp FROM messages ORDER BY id ASC LIMIT 50");
    socket.emit('chat:history', chatHistory);

    // Send user's assigned color
    socket.emit('user:color', { color: userColor });

    socket.on('chat:message', msg => handleChat(msg, socket));
  });
}