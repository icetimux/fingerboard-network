import PQueue from 'p-queue';

import { mediaRepository } from './mediaRepository.js';
import { downloadVideo } from './downloader.js';
import { ioInstance } from '../../sockets/socketHandler.js';
import { enqueue, enqueueBump, getRandomApprovedBump } from '../queue/queueService.js';

const VIDEO_DIR = './videos';

const downloadQueue = new PQueue({ concurrency: 2 });

async function processVideo(url) {
  // Deduplication: skip if URL already exists
  const existing = await mediaRepository.getByUrl(url);
  if (existing) {
    ioInstance?.emit('chat:system', { text: 'This video has already been submitted.' });
    return;
  }

  const videoId = await mediaRepository.insertPending(url);

  // 🔔 notify pending
  ioInstance?.emit('media:status', {
    videoId,
    status: 'pending'
  });

  try {
    await mediaRepository.setDownloading(videoId);

    // 🔔 notify downloading
    ioInstance?.emit('media:status', {
      videoId,
      status: 'downloading'
    });

    const { filePath, duration, title, channel } = await downloadVideo(url, VIDEO_DIR, videoId);

    await mediaRepository.setReady(videoId, filePath, duration, title, channel);

    // 🔔 notify ready
    ioInstance?.emit('media:status', {
      videoId,
      status: 'ready',
      filePath
    });
  } catch (err) {
    const errorMessage = String(err?.message || 'Unknown error');
    await mediaRepository.setFailed(videoId, errorMessage);

    // 🔔 notify failed
    ioInstance?.emit('media:status', {
      videoId,
      status: 'failed',
      error: errorMessage
    });

    console.error(`Video ${videoId} failed:`, err);
  }
}

export async function approve(videoId) {
  await mediaRepository.setApproved(videoId);
  // Enqueue the media video
  await enqueue(videoId);
  // Enqueue a random approved bump immediately after it
  const bump = await getRandomApprovedBump();
  if (bump) {
    await enqueueBump(bump.id);
  }
}

export const mediaService = {
  submitVideo(url) {
    downloadQueue.add(() =>
      processVideo(url).catch((err) => {
        console.error('Unhandled media error:', err);
      })
    );
  }
};