import { state } from './state.js';
import { getNextVideo, getVideoById } from '../queue/queueService.js';
import { ioInstance } from '../../sockets/socketHandler.js';

export const playbackController = {
  async play() {
    if (!state.currentVideoId) {
      await this.next();
      return;
    }
    state.playing = true;
    state.startedAt = Date.now() - state.pausedAt * 1000;
    ioInstance.emit('state', state);
  },

  pause() {
    state.playing = false;
    state.pausedAt = (Date.now() - state.startedAt) / 1000;
    ioInstance.emit('state', state);
  },

  async next() {
    const nextVideo = await getNextVideo(state.currentVideoId);
    if (!nextVideo) {
      state.playing = false;
      ioInstance.emit('state', state);
      return;
    }
    state.currentVideoId = nextVideo.id;
    state.startedAt = Date.now();
    state.pausedAt = 0;
    state.playing = true;
    ioInstance.emit('state', state);
  }
};