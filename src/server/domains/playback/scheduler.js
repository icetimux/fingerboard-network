import { state } from './state.js';
import { playbackController } from './controller.js';
import { getVideoById } from '../queue/queueService.js';

let transitioning = false;

function checkVideoEnd() {
  if (!state.playing || !state.currentVideoId || transitioning) return;
  getVideoById(state.currentVideoId).then(video => {
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