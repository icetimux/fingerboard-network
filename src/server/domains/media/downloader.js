import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { ioInstance } from '../../sockets/socketHandler.js';

const DOWNLOAD_TIMEOUT = 60 * 60 * 1000; // 1 hour timeout

export async function downloadVideo(url, outputDir, videoId) {
  // Validate inputs
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid URL provided');
  }
  if (!outputDir || typeof outputDir !== 'string') {
    throw new Error('Invalid output directory');
  }
  if (!videoId || typeof videoId !== 'number') {
    throw new Error('Invalid video ID');
  }

  // Ensure output directory exists
  try {
    await fs.mkdir(outputDir, { recursive: true });
  } catch (err) {
    throw new Error(`Failed to create output directory: ${err.message}`);
  }

  return new Promise((resolve, reject) => {
    let finalPath = null;
    let stderrOutput = '';
    let timeoutHandle = null;

    const outputTemplate = path.join(outputDir, '%(title)s.%(ext)s');

    // Set timeout
    timeoutHandle = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('Download timeout exceeded'));
    }, DOWNLOAD_TIMEOUT);

    const proc = spawn('yt-dlp', [
      url,
      '-o',
      outputTemplate,
      '--merge-output-format',
      'mp4',
      '--newline' // IMPORTANT: enables progress parsing
    ]);

    proc.stdout.on('data', (data) => {
      try {
        const text = data.toString();

        // Example line:
        // [download]  42.3% of 10.00MiB at 1.23MiB/s ETA 00:05
        const progressMatch = text.match(/\[download\]\s+(\d+\.?\d*)%.*at\s+(.+?)\s+ETA\s+(.+)/);

        if (progressMatch) {
          const [, percent, speed, eta] = progressMatch;

          try {
            ioInstance?.emit('media:progress', {
              videoId,
              percent: parseFloat(percent),
              speed,
              eta
            });
          } catch (emitErr) {
            console.error('Failed to emit progress:', emitErr);
          }
        }

        // Extract final file path
        const fileMatch = text.match(/Destination: (.+)/);
        if (fileMatch) {
          finalPath = fileMatch[1].trim();
        }
      } catch (err) {
        console.error('Error processing stdout:', err);
      }
    });

    proc.stderr.on('data', (data) => {
      stderrOutput += data.toString();
      console.error('[yt-dlp stderr]', data.toString());
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutHandle);
      reject(new Error(`Failed to spawn yt-dlp process: ${err.message}`));
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutHandle);

      if (code === 0) {
        // Validate that we got a file path
        if (!finalPath) {
          reject(new Error('Download completed but output file path not found'));
        } else {
          resolve(finalPath);
        }
      } else {
        const errorMsg = stderrOutput || `yt-dlp exited with code ${code}`;
        reject(new Error(`Download failed: ${errorMsg}`));
      }
    });
  });
}