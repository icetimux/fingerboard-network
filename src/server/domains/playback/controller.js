import { state } from './state.js';
import { getNextVideo, getVideoById, getVideoWithMedia, enqueueBump, getRandomApprovedBump } from '../queue/queueService.js';
import { ioInstance } from '../../sockets/socketHandler.js';

export async function buildEnrichedState() {
  let filePath = null;
  let duration = null;
  let title = null;
  let channel = null;
  let url = null;
  let nextVideo = null;
  if (state.currentVideoId) {
    const vid = await getVideoWithMedia(state.currentVideoId);
    filePath = vid?.file_path ? '/' + vid.file_path : null;
    duration = vid?.duration ?? null;
    title = vid?.title ?? null;
    channel = vid?.channel ?? null;
    url = vid?.url ?? null;
    const next = await getNextVideo(state.currentVideoId);
    if (next) {
      nextVideo = { title: next.title ?? null, channel: next.channel ?? null, url: next.url ?? null };
    }
  }
  return { ...state, filePath, duration, title, channel, url, nextVideo };
}

export const playbackController = {
  async play() {
    if (!state.currentVideoId) {
      await this.next();
      return;
    }
    state.playing = true;
    state.startedAt = Date.now() - state.pausedAt * 1000;
    ioInstance.emit('state', await buildEnrichedState());
  },

  async pause() {
    state.playing = false;
    state.pausedAt = (Date.now() - state.startedAt) / 1000;
    ioInstance.emit('state', await buildEnrichedState());
  },

  async next() {
    let nextVideo = await getNextVideo(state.currentVideoId);
    if (!nextVideo) {
      // Queue exhausted — try to loop a random approved bump
      const bump = await getRandomApprovedBump();
      if (bump) {
        const queueId = await enqueueBump(bump.id);
        nextVideo = await getVideoById(queueId);
      }
    }
    if (!nextVideo) {
      state.playing = false;
      state.currentVideoId = null;
      ioInstance.emit('state', await buildEnrichedState());
      return;
    }
    state.currentVideoId = nextVideo.id;
    state.startedAt = Date.now();
    state.pausedAt = 0;
    state.playing = true;
    ioInstance.emit('state', await buildEnrichedState());
  }
};