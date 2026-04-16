import PQueue from 'p-queue';

import { mediaRepository } from './mediaRepository.js';
import { downloadVideo } from './downloader.js';
import { ioInstance } from '../../sockets/socketHandler.js';
import { enqueue } from '../queue/queueService.js';
import { playbackController } from '../playback/controller.js';
import { state as playbackState } from '../playback/state.js';
import dbPromise from '../../config/db.js';

import { resolve } from 'path';

const VIDEO_DIR = resolve(process.env.VIDEO_DIR || './videos');

const downloadQueue = new PQueue({ concurrency: 2 });

async function processVideo(url) {
  // Deduplication: skip if URL already exists
  const existing = await mediaRepository.getByUrl(url);
  if (existing) {
    ioInstance?.emit('chat:system', { text: 'This video has already been submitted.' });
    return;
  }

  const videoId = await mediaRepository.insertPending(url);
  ioInstance?.emit('media:status', { videoId, status: 'pending' });

  const db = await dbPromise;
  const autoApproveRow = await db.get("SELECT value FROM settings WHERE key = 'auto_approve'");
  if (autoApproveRow?.value === '1') {
    await processApproval(videoId);
  }
}

async function processApproval(videoId) {
  const video = await mediaRepository.getById(videoId);
  if (!video) return;

  await mediaRepository.setDownloading(videoId);
  ioInstance?.emit('media:status', { videoId, status: 'downloading' });

  try {
    const { filePath, duration, title, channel } = await downloadVideo(video.url, VIDEO_DIR, videoId);
    await mediaRepository.setApproved(videoId, filePath, duration, title, channel);
    await enqueue(videoId);
    ioInstance?.emit('media:status', { videoId, status: 'approved', filePath });
    if (!playbackState.playing && !playbackState.currentVideoId) {
      await playbackController.play();
    }
  } catch (err) {
    const errorMessage = String(err?.message || 'Unknown error');
    await mediaRepository.setFailed(videoId, errorMessage);
    ioInstance?.emit('media:status', { videoId, status: 'failed', error: errorMessage });
    console.error(`Video ${videoId} failed:`, err);
  }
}

export function approve(videoId) {
  downloadQueue.add(() =>
    processApproval(videoId).catch((err) => {
      console.error('Unhandled approval error:', err);
    })
  );
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