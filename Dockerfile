FROM node:20-alpine

# Install poppler-utils (pdftoppm, pdfinfo) and unzip for CBZ support
RUN apk add --no-cache poppler-utils unzip

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
