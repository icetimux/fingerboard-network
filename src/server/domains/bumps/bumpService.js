import PQueue from 'p-queue';
import { bumpRepository } from './bumpRepository.js';
import { downloadVideo } from '../media/downloader.js';
import { ioInstance } from '../../sockets/socketHandler.js';

const BUMP_DIR = './videos/bumps';

const downloadQueue = new PQueue({ concurrency: 2 });

async function processBump(url) {
  // Deduplication: if URL already exists, skip download
  const existing = await bumpRepository.getByUrl(url);
  if (existing) return;

  const bumpId = await bumpRepository.insertPending(url);
  ioInstance?.emit('bump:status', { bumpId, status: 'pending' });

  try {
    await bumpRepository.setDownloading(bumpId);
    ioInstance?.emit('bump:status', { bumpId, status: 'downloading' });

    const { filePath, duration, title, channel } = await downloadVideo(url, BUMP_DIR, bumpId);
    await bumpRepository.setReady(bumpId, filePath, duration, title, channel);
    ioInstance?.emit('bump:status', { bumpId, status: 'ready', filePath });
  } catch (err) {
    const errorMessage = String(err?.message || 'Unknown error');
    await bumpRepository.setFailed(bumpId, errorMessage);
    ioInstance?.emit('bump:status', { bumpId, status: 'failed', error: errorMessage });
    console.error(`Bump ${bumpId} failed:`, err);
  }
}

export async function approveBump(bumpId) {
  await bumpRepository.setApproved(bumpId);
}

export const bumpService = {
  submitBump(url) {
    downloadQueue.add(() =>
      processBump(url).catch((err) => {
        console.error('Unhandled bump error:', err);
      })
    );
  },
};
