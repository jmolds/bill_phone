#!/bin/bash

if [ -f package.json ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Starting Expo server with modern CLI in LAN mode..."
npx expo start --lan
