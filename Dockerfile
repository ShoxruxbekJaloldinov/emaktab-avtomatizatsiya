# Use the official Puppeteer image which comes with Chromium and all dependencies
FROM ghcr.io/puppeteer/puppeteer:latest

# Switch to root to copy files and install
USER root
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Set necessary environment variables for Puppeteer in Docker
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Switch back to the non-root user for security
USER pptruser

# Expose port (Render sets PORT automatically, but default to 3000)
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
