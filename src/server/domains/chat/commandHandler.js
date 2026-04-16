import { mediaService } from '../media/mediaService.js';
import { bumpService } from '../bumps/bumpService.js';
import { isValidUrl } from '../../utils/validators.js';
import dbPromise from '../../config/db.js';

async function isAutoApproveEnabled() {
  const db = await dbPromise;
  const row = await db.get("SELECT value FROM settings WHERE key = 'auto_approve'");
  return row?.value === '1';
}

export async function handleCommand(parsed, socket, msg) {
  if (parsed.command === '/submit') {
    const url = parsed.args[0];
    if (!isValidUrl(url)) return socket.emit('chat:system', { text: 'Invalid URL' });
    mediaService.submitVideo(url);
    const autoApprove = await isAutoApproveEnabled();
    const text = autoApprove
      ? 'Your video has been submitted successfully.'
      : 'Your video has been submitted successfully and is now pending review.';
    socket.emit('chat:system', { text });
  } else if (parsed.command === '/bump') {
    const url = parsed.args[0];
    if (!isValidUrl(url)) return socket.emit('chat:system', { text: 'Invalid URL' });
    bumpService.submitBump(url);
    socket.emit('chat:system', { text: 'Your bump has been submitted successfully and is now pending review.' });
  }
}