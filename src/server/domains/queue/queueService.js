import { queueRepository } from './queueRepository.js';
import { ioInstance } from '../../sockets/socketHandler.js';

export async function getQueue() {
  return queueRepository.getQueue();
}

export async function getNextVideo(currentId) {
  return queueRepository.getNext(currentId);
}

export async function insertPending(url) {
  return queueRepository.insertPending(url);
}

export async function getVideoById(id) {
  return queueRepository.getVideoById(id);
}

// export async function approve(id) {
//   await queueRepository.approve(id);
//   const queue = await getQueue();
//   ioInstance.emit('queue', queue);
// }

