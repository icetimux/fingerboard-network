import { spawn } from 'child_process';
import path from 'path';
import { ioInstance } from '../../sockets/socketHandler.js';

export function downloadVideo(url, outputDir, videoId) {
  return new Promise((resolve, reject) => {
    let finalPath = null;

    const outputTemplate = path.join(outputDir, '%(title)s.%(ext)s');

    const proc = spawn('yt-dlp', [
      url,
      '-o',
      outputTemplate,
      '--merge-output-format',
      'mp4',
      '--newline' // IMPORTANT: enables progress parsing
    ]);

    proc.stdout.on('data', (data) => {
      const text = data.toString();

      // Example line:
      // [download]  42.3% of 10.00MiB at 1.23MiB/s ETA 00:05
      const progressMatch = text.match(/\[download\]\s+(\d+\.?\d*)%.*at\s+(.+?)\s+ETA\s+(.+)/);

      if (progressMatch) {
        const [, percent, speed, eta] = progressMatch;

        ioInstance?.emit('media:progress', {
          videoId,
          percent: parseFloat(percent),
          speed,
          eta
        });
      }

      // Extract final file path
      const fileMatch = text.match(/Destination: (.+)/);
      if (fileMatch) {
        finalPath = fileMatch[1];
      }
    });

    proc.stderr.on('data', (data) => {
      console.error('[yt-dlp error]', data.toString());
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(finalPath);
      } else {
        reject(new Error(`yt-dlp exited with code ${code}`));
      }
    });
  });
}