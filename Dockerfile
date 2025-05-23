FROM node:18-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy only server files
COPY server.js /app/
COPY package-server.json /app/package.json

# Install dependencies
RUN npm install

# Expose the signaling server port
EXPOSE 3000

# Start the signaling server
CMD ["node", "server.js"]
