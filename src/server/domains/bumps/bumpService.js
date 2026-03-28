import PQueue from 'p-queue';
import { bumpRepository } from './bumpRepository.js';
import { downloadVideo } from '../media/downloader.js';
import { ioInstance } from '../../sockets/socketHandler.js';

import { resolve, join } from 'path';

const BUMP_DIR = join(resolve(process.env.VIDEO_DIR || './videos'), 'bumps');

const downloadQueue = new PQueue({ concurrency: 2 });

async function processBump(url) {
  // Deduplication: if URL already exists, skip
  const existing = await bumpRepository.getByUrl(url);
  if (existing) return;

  const bumpId = await bumpRepository.insertPending(url);
  ioInstance?.emit('bump:status', { bumpId, status: 'pending' });
}

async function processBumpApproval(bumpId) {
  const bump = await bumpRepository.getById(bumpId);
  if (!bump) return;

  await bumpRepository.setDownloading(bumpId);
  ioInstance?.emit('bump:status', { bumpId, status: 'downloading' });

  try {
    const { filePath, duration, title, channel } = await downloadVideo(bump.url, BUMP_DIR, bumpId);
    await bumpRepository.setApproved(bumpId, filePath, duration, title, channel);
    ioInstance?.emit('bump:status', { bumpId, status: 'approved', filePath });
  } catch (err) {
    const errorMessage = String(err?.message || 'Unknown error');
    await bumpRepository.setFailed(bumpId, errorMessage);
    ioInstance?.emit('bump:status', { bumpId, status: 'failed', error: errorMessage });
    console.error(`Bump ${bumpId} failed:`, err);
  }
}

export function approveBump(bumpId) {
  downloadQueue.add(() =>
    processBumpApproval(bumpId).catch((err) => {
      console.error('Unhandled bump approval error:', err);
    })
  );
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
