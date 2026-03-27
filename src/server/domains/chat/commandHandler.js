import { mediaService } from '../media/mediaService.js';
import { bumpService } from '../bumps/bumpService.js';
import { isValidUrl } from '../../utils/validators.js';

export async function handleCommand(parsed, socket, msg) {
  if (parsed.command === '/submit') {
    const url = parsed.args[0];
    if (!isValidUrl(url)) return socket.emit('chat:system', { text: 'Invalid URL' });
    try {
      mediaService.submitVideo(url);
      socket.emit('chat:system', { text: `Your video has been submitted successfully and is now pending review.` });
    } catch (err) {
      socket.emit('chat:system', { text: `Failed to submit video: ${err.message}` });
    }
  } else if (parsed.command === '/bump') {
    const url = parsed.args[0];
    if (!isValidUrl(url)) return socket.emit('chat:system', { text: 'Invalid URL' });
    try {
      bumpService.submitBump(url);
      socket.emit('chat:system', { text: `Your bump has been submitted successfully and is now pending review.` });
    } catch (err) {
      socket.emit('chat:system', { text: `Failed to submit bump: ${err.message}` });
    }
  }
}