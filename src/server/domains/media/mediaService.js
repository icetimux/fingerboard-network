import PQueue from 'p-queue';

import { mediaRepository } from './mediaRepository.js';
import { downloadVideo } from './downloader.js';
import { ioInstance } from '../../sockets/socketHandler.js';
import { enqueue } from '../queue/queueService.js';

const VIDEO_DIR = './videos';

const downloadQueue = new PQueue({ concurrency: 2 });

async function processVideo(url) {
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

    const filePath = await downloadVideo(url, VIDEO_DIR, videoId);

    await mediaRepository.setReady(videoId, filePath);

    // 🔔 notify ready
    ioInstance?.emit('media:status', {
      videoId,
      status: 'ready',
      filePath
    });
  } catch (err) {
    await mediaRepository.setFailed(videoId, err.message);

    // 🔔 notify failed
    ioInstance?.emit('media:status', {
      videoId,
      status: 'failed',
      error: err.message
    });

    console.error(`Video ${videoId} failed:`, err);
  }
}

export async function approve(videoId) {
  await mediaRepository.setApproved(videoId);
  // Move to queue now, use media id as fk in queue table
  await enqueue(videoId);
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