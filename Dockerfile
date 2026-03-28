FROM node:22-alpine

# Install ffmpeg (required by yt-dlp) and python3 (required by yt-dlp script)
RUN apk add --no-cache ffmpeg python3

# Create /app owned by node before switching — avoids a costly chown after npm install
RUN mkdir -p /app && chown node:node /app
WORKDIR /app
USER node

# Install Node dependencies first (layer cache)
COPY --chown=node:node package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy yt-dlp binary from repo and application source
COPY --chown=node:node bin/ bin/
RUN chmod +x bin/yt-dlp
COPY --chown=node:node src/ src/

EXPOSE 3000

CMD ["node", "src/server/index.js"]
