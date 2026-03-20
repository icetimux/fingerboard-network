import { parseCommand } from './commandParser.js';
import { handleCommand } from './commandHandler.js';
import { ioInstance } from '../../sockets/socketHandler.js';

export async function handleChat(msg, socket) {
  const parsed = parseCommand(msg.text);
  if (parsed) {
    await handleCommand(parsed, socket, msg);
    return;
  }
  ioInstance.emit('chat:message', {
    user: msg.user,
    text: msg.text,
    timestamp: Date.now()
  });
}