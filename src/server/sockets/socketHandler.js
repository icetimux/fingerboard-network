import { handleChat } from '../domains/chat/chatHandler.js';
import { state } from '../domains/playback/state.js';
import { getQueue } from '../domains/queue/queueService.js';

export let ioInstance = null;

export function initSockets(io) {
  ioInstance = io;

  io.on('connection', async (socket) => {
    console.log('Client connected');

    socket.emit('state', state);
    socket.emit('queue', await getQueue());

    socket.on('chat:message', msg => handleChat(msg, socket));
  });
}