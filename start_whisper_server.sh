#!/bin/bash

# Script to start WhisperLive server for podcast transcription
# WhisperLive is installed in a Python 3.11 virtual environment

echo "Starting WhisperLive server..."
echo "Server will be available at ws://localhost:9090"
echo "Press Ctrl+C to stop"
echo ""

# Activate virtual environment and start server
source ~/whisperlive_env_311/bin/activate

python /Users/qb83/holons.git/harvest/run_whisper_server.py \
  --port 9090 \
  --backend faster_whisper \
  --max_clients 4
