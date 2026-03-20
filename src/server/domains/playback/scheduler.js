import { state } from './state.js';
import { playbackController } from './controller.js';
import { getVideoById } from '../queue/queueService.js';

function checkVideoEnd() {
  if (!state.playing || !state.currentVideoId) return;
  getVideoById(state.currentVideoId).then(video => {
    if (!video) return;
    const elapsed = (Date.now() - state.startedAt) / 1000;
    if (elapsed >= video.duration) {
      playbackController.next();
    }
  });
}

export function startScheduler() {
  setInterval(checkVideoEnd, 1000);
}