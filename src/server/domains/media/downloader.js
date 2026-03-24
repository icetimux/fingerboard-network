import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { ioInstance } from '../../sockets/socketHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const YT_DLP = path.resolve(__dirname, '../../../../bin/yt-dlp');

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

  // Pre-flight: fetch duration metadata only (no download)
  const duration = await fetchDuration(url);

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

    const proc = spawn(YT_DLP, [
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

        // Track intermediate destination and final merged path
        const mergerMatch = text.match(/\[Merger\] Merging formats into "(.+)"/);
        if (mergerMatch) {
          finalPath = mergerMatch[1].trim();
        } else {
          const destMatch = text.match(/Destination: (.+)/);
          if (destMatch) {
            finalPath = destMatch[1].trim();
          }
        }
      } catch (err) {
        console.error('Error processing stdout:', err);
      }
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      stderrOutput += text;
      // yt-dlp sometimes writes merger info to stderr
      const mergerMatch = text.match(/\[Merger\] Merging formats into "(.+)"/);
      if (mergerMatch) {
        finalPath = mergerMatch[1].trim();
      }
      console.error('[yt-dlp stderr]', text);
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutHandle);
      reject(new Error(`Failed to spawn yt-dlp process: ${err.message}`));
    });

    proc.on('close', async (code) => {
      clearTimeout(timeoutHandle);

      if (code === 0) {
        // Validate that we got a file path
        if (!finalPath) {
          reject(new Error('Download completed but output file path not found'));
        } else {
          const dir = path.dirname(finalPath);
          const normalizedName = path.basename(finalPath)
            .replace(/ /g, '_')
            .toLowerCase();
          const normalizedPath = path.join(dir, normalizedName);
          try {
            await fs.rename(finalPath, normalizedPath);
          } catch (renameErr) {
            reject(new Error(`Failed to normalize filename: ${renameErr.message}`));
            return;
          }
          resolve({ filePath: normalizedPath, duration });
        }
      } else {
        const errorMsg = stderrOutput || `yt-dlp exited with code ${code}`;
        reject(new Error(`Download failed: ${errorMsg}`));
      }
    });
  });
}

function fetchDuration(url) {
  return new Promise((resolve) => {
    let output = '';
    const proc = spawn(YT_DLP, ['--skip-download', '--print', '%(duration)s', url]);
    proc.stdout.on('data', (d) => { output += d.toString(); });
    proc.on('close', () => {
      const secs = parseFloat(output.trim());
      resolve(Number.isFinite(secs) ? Math.round(secs) : null);
    });
    proc.on('error', () => resolve(null));
  });
}