import { state } from './state.js';
import { getNextVideo, getVideoWithMedia, getRandomApprovedBump } from '../queue/queueService.js';
import { ioInstance } from '../../sockets/socketHandler.js';
import { resolve, relative } from 'path';

const VIDEO_DIR = resolve(process.env.VIDEO_DIR || './videos');

function filePathToUrl(filePath) {
  if (!filePath) return null;
  // Convert absolute or relative stored path to a web URL under /videos/
  return '/videos/' + relative(VIDEO_DIR, resolve(filePath));
}

export async function buildEnrichedState() {
  if (state.currentBump) {
    const b = state.currentBump;
    return {
      ...state,
      filePath: filePathToUrl(b.file_path),
      duration: b.duration ?? null,
      title: b.title ?? null,
      channel: b.channel ?? null,
      url: b.url ?? null,
      nextVideo: null
    };
  }
  let filePath = null;
  let duration = null;
  let title = null;
  let channel = null;
  let url = null;
  let nextVideo = null;
  if (state.currentVideoId) {
    const vid = await getVideoWithMedia(state.currentVideoId);
    filePath = filePathToUrl(vid?.file_path);
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

async function playBump(excludeId = null) {
  const bump = await getRandomApprovedBump(excludeId);
  if (!bump) return false;
  state.currentBump = bump;
  state.startedAt = Date.now();
  state.pausedAt = 0;
  state.playing = true;
  ioInstance.emit('state', await buildEnrichedState());
  return true;
}

export const playbackController = {
  // Play — exits bump loop mode and starts the media queue
  async play() {
    const wasInBumpLoop = state.bumpLoopMode;
    state.bumpLoopMode = false;
    state.currentBump = null;
    // When stopping bump loop, restart queue from the top
    if (wasInBumpLoop) state.currentVideoId = null;
    if (!state.currentVideoId) {
      const nextMedia = await getNextVideo(null);
      if (!nextMedia) {
        // Queue empty — stay in playing state; scheduler will start when videos arrive
        state.playing = true;
        state.currentVideoId = null;
        ioInstance.emit('state', await buildEnrichedState());
        return;
      }
      state.currentVideoId = nextMedia.id;
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
    if (state.bumpLoopMode) {
      // Bump loop mode: always cycle to next random bump, never touch queue
      const lastId = state.currentBump?.id ?? null;
      state.currentBump = null;
      const played = await playBump(lastId);
      if (!played) {
        state.playing = false;
        ioInstance.emit('state', await buildEnrichedState());
      }
      return;
    }

    if (state.currentBump) {
      // Just finished a between-media bump — advance to next media
      const lastBumpId = state.currentBump.id;
      state.currentBump = null;
      const nextMedia = await getNextVideo(state.currentVideoId);
      if (nextMedia) {
        state.currentVideoId = nextMedia.id;
        state.startedAt = Date.now();
        state.pausedAt = 0;
        state.playing = true;
        ioInstance.emit('state', await buildEnrichedState());
        return;
      }
      // Queue exhausted — loop back to start
      state.currentVideoId = null;
      const loopMedia = await getNextVideo(null);
      if (loopMedia) {
        state.currentVideoId = loopMedia.id;
        state.startedAt = Date.now();
        state.pausedAt = 0;
        state.playing = true;
        ioInstance.emit('state', await buildEnrichedState());
        return;
      }
      // Queue truly empty — stop
      state.playing = false;
      ioInstance.emit('state', await buildEnrichedState());
      return;
    }

    if (state.currentVideoId) {
      // Just finished a media video — play a bump between if available
      const bump = await getRandomApprovedBump();
      if (bump) {
        state.currentBump = bump;
        state.startedAt = Date.now();
        state.pausedAt = 0;
        state.playing = true;
        ioInstance.emit('state', await buildEnrichedState());
        return;
      }
      // No bumps — go straight to next media
      const nextMedia = await getNextVideo(state.currentVideoId);
      if (nextMedia) {
        state.currentVideoId = nextMedia.id;
        state.startedAt = Date.now();
        state.pausedAt = 0;
        state.playing = true;
        ioInstance.emit('state', await buildEnrichedState());
        return;
      }
      // Queue exhausted, no bumps — loop back to start
      state.currentVideoId = null;
      const loopMedia = await getNextVideo(null);
      if (loopMedia) {
        state.currentVideoId = loopMedia.id;
        state.startedAt = Date.now();
        state.pausedAt = 0;
        state.playing = true;
        ioInstance.emit('state', await buildEnrichedState());
        return;
      }
      // Queue truly empty — stop
      state.playing = false;
      ioInstance.emit('state', await buildEnrichedState());
      return;
    }

    // Nothing playing — start from queue
    const nextMedia = await getNextVideo(null);
    if (nextMedia) {
      state.currentVideoId = nextMedia.id;
      state.startedAt = Date.now();
      state.pausedAt = 0;
      state.playing = true;
      ioInstance.emit('state', await buildEnrichedState());
      return;
    }
    state.playing = false;
    ioInstance.emit('state', await buildEnrichedState());
  },

  async startBumpLoop() {
    state.bumpLoopMode = true;
    state.currentVideoId = null;
    state.currentBump = null;
    return playBump();
  }
};