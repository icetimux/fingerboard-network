import { parseCommand } from './commandParser.js';
import { handleCommand } from './commandHandler.js';
import { ioInstance } from '../../sockets/socketHandler.js';
import dbPromise from '../../config/db.js';

export async function handleChat(msg, socket) {
  const parsed = parseCommand(msg.text);
  if (parsed) {
    await handleCommand(parsed, socket, msg);
    return;
  }

  // Save message to DB with user's color
  const db = await dbPromise;
  await db.run(
    "INSERT INTO messages (user, text, color, timestamp) VALUES (?, ?, ?, ?)",
    [msg.user, msg.text, socket.userColor, msg.timestamp || Date.now()]
  );

  // Broadcast message to all clients with the user's color
  ioInstance.emit('chat:message', {
    user: msg.user,
    text: msg.text,
    color: socket.userColor,
    timestamp: msg.timestamp || Date.now()
  });
}