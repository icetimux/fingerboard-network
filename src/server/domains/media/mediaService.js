import PQueue from 'p-queue';

import { mediaRepository } from './mediaRepository.js';
import { downloadVideo } from './downloader.js';
import { ioInstance } from '../../sockets/socketHandler.js';
import { enqueue } from '../queue/queueService.js';
import { playbackController } from '../playback/controller.js';
import { state as playbackState } from '../playback/state.js';

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
  ioInstance?.emit('media:status', { videoId, status: 'pending' });
}

async function processApproval(videoId) {
  const video = await mediaRepository.getById(videoId);
  if (!video) return;

  // If already downloaded (e.g. legacy 'ready' entry), skip re-downloading
  if (video.file_path) {
    await mediaRepository.setApproved(videoId);
    await enqueue(videoId);
    ioInstance?.emit('media:status', { videoId, status: 'approved' });
    if (!playbackState.playing && !playbackState.currentVideoId) {
      await playbackController.play();
    }
    return;
  }

  await mediaRepository.setDownloading(videoId);
  ioInstance?.emit('media:status', { videoId, status: 'downloading' });

  try {
    const { filePath, duration, title, channel } = await downloadVideo(video.url, VIDEO_DIR, videoId);
    await mediaRepository.setReady(videoId, filePath, duration, title, channel);
    await mediaRepository.setApproved(videoId);
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