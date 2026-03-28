import { parseCommand } from './commandParser.js';
import { handleCommand } from './commandHandler.js';
import { ioInstance } from '../../sockets/socketHandler.js';
import dbPromise from '../../config/db.js';

export async function handleChat(msg, socket) {
  // Always use server-verified username if available (prevents spoofing)
  const username = socket.authedUsername || msg.user;

  const parsed = parseCommand(msg.text);
  if (parsed) {
    await handleCommand(parsed, socket, { ...msg, user: username });
    return;
  }

  // Save message to DB with user's color
  const db = await dbPromise;
  const result = await db.run(
    "INSERT INTO messages (user, text, color, timestamp) VALUES (?, ?, ?, ?)",
    [username, msg.text, socket.userColor, msg.timestamp || Date.now()]
  );

  // Broadcast message to all clients with the user's color
  ioInstance.emit('chat:message', {
    id: result.lastID,
    user: username,
    text: msg.text,
    color: socket.userColor,
    timestamp: msg.timestamp || Date.now()
  });
}