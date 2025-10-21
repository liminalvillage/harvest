#!/usr/bin/env python3
"""
WhisperLive Server Runner
Starts the WhisperLive transcription server for podcast recording
"""

import argparse
from whisper_live.server import TranscriptionServer

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="WhisperLive Server")
    parser.add_argument("--port", type=int, default=9090, help="WebSocket port")
    parser.add_argument("--backend", type=str, default="faster_whisper",
                       choices=["faster_whisper", "tensorrt", "openvino"],
                       help="Transcription backend")
    parser.add_argument("--max_clients", type=int, default=4, help="Maximum concurrent clients")

    args = parser.parse_args()

    print(f"Starting WhisperLive Server...")
    print(f"Port: {args.port}")
    print(f"Backend: {args.backend}")
    print(f"Max Clients: {args.max_clients}")
    print(f"Server will be available at: ws://localhost:{args.port}")
    print("Press Ctrl+C to stop\n")

    server = TranscriptionServer()
    server.run(
        host="0.0.0.0",
        port=args.port
    )
