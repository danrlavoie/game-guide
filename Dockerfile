FROM node:20-slim

# Install poppler-utils (pdftoppm, pdfinfo), unzip for CBZ, unrar for CBR
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils unzip unrar-free \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy application
COPY server/ ./server/
COPY public/ ./public/

# Create data directory
RUN mkdir -p /data

ENV NODE_ENV=production
ENV PORT=3000
ENV DOCUMENTS_PATH=/documents
ENV DATA_PATH=/data

EXPOSE 3000

CMD ["node", "server/index.js"]
