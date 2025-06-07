FROM node:18-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    postgresql-client \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy only server files
COPY server.js /app/
COPY package-server.json /app/package.json
COPY init-db.sh /app/init-db.sh

# Copy default profile image and seeding script
COPY docker-entrypoint-initdb.d/25_seed_default_picture.sh /docker-entrypoint-initdb.d/25_seed_default_picture.sh
RUN chmod +x /docker-entrypoint-initdb.d/25_seed_default_picture.sh

# Install dependencies
RUN npm install

# Expose the signaling server port
EXPOSE 3000

# Start the signaling server
CMD ["node", "server.js"]
