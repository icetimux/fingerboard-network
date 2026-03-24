import { state } from './state.js';
import { getNextVideo, getVideoById, getVideoWithMedia } from '../queue/queueService.js';
import { ioInstance } from '../../sockets/socketHandler.js';

export async function buildEnrichedState() {
  let filePath = null;
  if (state.currentVideoId) {
    const vid = await getVideoWithMedia(state.currentVideoId);
    filePath = vid?.file_path ? '/' + vid.file_path : null;
  }
  return { ...state, filePath };
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
    const nextVideo = await getNextVideo(state.currentVideoId);
    if (!nextVideo) {
      state.playing = false;
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