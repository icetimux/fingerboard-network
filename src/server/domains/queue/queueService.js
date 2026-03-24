import { queueRepository } from './queueRepository.js';
import { ioInstance } from '../../sockets/socketHandler.js';

export async function getVideoWithMedia(id) {
  return queueRepository.getVideoWithMedia(id);
}

export async function getQueueWithMedia() {
  return queueRepository.getQueueWithMedia();
}

export async function getQueue() {
  return queueRepository.getQueue();
}

export async function enqueue(mediaId, type = 'video') {
  const queueId = await queueRepository.enqueue(mediaId, type);
  const queue = await getQueue();
  ioInstance.emit('queue', queue);
  return queueId;
}

export async function getNextVideo(currentId) {
  return queueRepository.getNext(currentId);
}

export async function getVideoById(id) {
  return queueRepository.getVideoById(id);
}
