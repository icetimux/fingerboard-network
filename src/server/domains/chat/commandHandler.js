import { insertPending } from '../queue/queueService.js';
import { isValidUrl } from '../../utils/validators.js';
import { ioInstance } from '../../sockets/socketHandler.js';

export async function handleCommand(parsed, socket, msg) {
  if (parsed.command === '/submit') {
    const url = parsed.args[0];
    if (!isValidUrl(url)) return socket.emit('chat:system', { text: 'Invalid URL' });
    await insertPending(url);
    ioInstance.emit('chat:system', { text: `${msg.user} submitted a video` });
  }
}