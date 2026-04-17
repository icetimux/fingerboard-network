import { state } from './state.js';
import { playbackController } from './controller.js';
import { getVideoWithMedia } from '../queue/queueService.js';

let transitioning = false;

function checkVideoEnd() {
  if (!state.playing || transitioning) return;

  // Playing but idle (queue was empty when play was pressed) — try to start
  if (!state.currentBump && !state.currentVideoId) {
    transitioning = true;
    playbackController.next().finally(() => { transitioning = false; });
    return;
  }

  if (state.currentBump) {
    const duration = state.currentBump.duration;
    if (!duration) return;
    const elapsed = (Date.now() - state.startedAt) / 1000;
    if (elapsed >= duration) {
      transitioning = true;
      playbackController.next().finally(() => { transitioning = false; });
    }
    return;
  }

  if (!state.currentVideoId) return;
  getVideoWithMedia(state.currentVideoId).then(video => {
    if (!video || !video.duration) return;
    const elapsed = (Date.now() - state.startedAt) / 1000;
    if (elapsed >= video.duration) {
      transitioning = true;
      playbackController.next().finally(() => { transitioning = false; });
    }
  });
}

export function startScheduler() {
  setInterval(checkVideoEnd, 1000);
}