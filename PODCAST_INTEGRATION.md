# Podcast Integration with WhisperLive

## Overview
This document describes the podcast recording and transcription feature integrated into the video chat system using WhisperLive for real-time speech-to-text.

## What's Been Implemented

### 1. Podcast Schema (`podcasts_schema-v0.1.0.json`)
Located in: `src/components/schemas/`

Defines the data structure for storing podcast recordings:
- **Basic Info**: id, holonId, title, description
- **Participants**: Array of participants with roles (host/guest/participant)
- **Timing**: startTime, endTime, date, duration
- **Transcript**: Structured segments with timestamps, speaker identification, and confidence scores
- **Media**: audioUrl, videoUrl for recordings
- **Metadata**: status, tags, relatedQuests, creation info

### 2. WhisperLive WebSocket Client (`src/lib/whisperLiveClient.ts`)
A complete TypeScript client for connecting to WhisperLive server:

**Features:**
- WebSocket connection to WhisperLive server (default: ws://localhost:9090)
- Real-time audio streaming from MediaStream
- Audio processing pipeline (AudioContext → ScriptProcessor → WebSocket)
- Converts Float32 audio to Int16 PCM format (16kHz, mono)
- Receives and parses transcription segments
- Callback system for transcription, errors, and status updates

**Usage:**
```typescript
import { WhisperLiveClient } from '$lib/whisperLiveClient';

const client = new WhisperLiveClient({
  serverUrl: 'ws://localhost:9090',
  language: 'en',
  model: 'base',
  useVAD: true
});

// Set up callbacks
client.onTranscriptionSegment((segment) => {
  console.log(segment.text);
});

// Connect with audio stream
await client.connect(mediaStream);

// Get full transcript
const transcript = client.getTranscript();

// Disconnect
client.disconnect();
```

### 3. Video Call Record Button (`src/components/VideoCall.svelte`)
Added podcast recording capability to video chat:

**UI Changes:**
- New record button (⏺️/⏹️) in controls
- Pulsing red animation when recording
- Status updates in connection status display

**Functions:**
- `toggleRecording()` - Start/stop recording
- `startRecording()` - Initialize recording session
- `stopRecording()` - End recording and calculate duration

**TODOs in code:**
- Initialize WhisperLive WebSocket connection
- Stream audio to WhisperLive server
- Receive and display real-time transcription
- Save podcast data to holosphere

## WhisperLive Server Setup

### Installation

#### Option 1: Python (Local Development)
```bash
# Install dependencies
bash scripts/setup.sh

# Install WhisperLive
pip install whisper-live

# Run server
python3 run_server.py --port 9090 \
                      --backend faster_whisper \
                      --max_clients 4
```

#### Option 2: Docker (Recommended for Production)
```bash
# Pull WhisperLive Docker image
docker pull ghcr.io/collabora/whisperlive-gpu:latest

# Run container
docker run -d \
  -p 9090:9090 \
  --gpus all \
  ghcr.io/collabora/whisperlive-gpu:latest
```

### Server Configuration
- **Port**: 9090 (WebSocket)
- **Backend Options**: faster_whisper, tensorrt, openvino
- **Model Sizes**: tiny, base, small, medium, large
- **Features**: Voice Activity Detection (VAD), multilingual, translation

## Protocol Details

### WebSocket Messages

**Client → Server (on connection):**
```json
{
  "uid": "client_unique_id",
  "language": "en",
  "task": "transcribe",
  "model": "base",
  "use_vad": true
}
```

**Client → Server (audio data):**
- Binary WebSocket messages
- Int16 PCM audio data
- 16kHz sample rate, mono
- Sent in chunks (4096 samples each)

**Server → Client (transcription):**
```json
{
  "segments": [
    {
      "start": 0.0,
      "end": 2.5,
      "text": "Hello, this is a test.",
      "confidence": 0.95
    }
  ]
}
```

## Integration Complete! ✅

All core functionality has been implemented:

1. **✅ WhisperLive Client Integration**
   - Imported `WhisperLiveClient` into VideoCall component (src/components/VideoCall.svelte:5)
   - Client initialized in `startRecording()` with config: ws://localhost:9090, language: en, model: base, VAD enabled
   - Audio stream passed to client via `client.connect(localStream)`
   - Real-time transcription segments captured via callback

2. **✅ Podcast Storage to Holosphere**
   - `savePodcastToHolosphere()` function saves podcasts to Gun (src/components/VideoCall.svelte:479-523)
   - Uses `podcasts` collection in Gun database
   - Stores complete podcast data following podcast schema v0.1.0
   - Includes participants, timestamps, duration, and full transcript

3. **✅ Real-time Transcription Display**
   - Transcription panel appears in top-right corner when recording (src/components/VideoCall.svelte:942-960, 1022-1040)
   - Shows live transcript segments as they arrive from WhisperLive
   - Displays timestamp, text, and confidence score for each segment
   - Responsive design: mobile shows panel at bottom, desktop at top-right
   - Auto-scrolling content area for long transcriptions

## Testing the Integration

### Prerequisites

**Important:** You'll need to run a WhisperLive server for the integration to work. The client code is complete and ready - it just needs a server to connect to.

### Server Setup Options

**Option 1: Docker (Easiest - Recommended)**
```bash
# Install Docker Desktop from https://www.docker.com/products/docker-desktop
# Then run:
docker run -d -p 9090:9090 --name whisperlive ghcr.io/collabora/whisperlive-gpu:latest
```

**Option 2: Python with Virtual Environment**
```bash
# Install system dependencies first
brew install pkg-config ffmpeg portaudio

# Create virtual environment
python3 -m venv ~/whisperlive_env
source ~/whisperlive_env/bin/activate

# Install WhisperLive
pip install whisper-live

# Run server
python3 -m whisper_live.server --port 9090
```

**Option 3: Use Remote Server**
If you have access to a WhisperLive server running elsewhere, update the server URL in:
`src/components/VideoCall.svelte:388` - change `ws://localhost:9090` to your server's URL

### Test Steps

**IMPORTANT: WhisperLive Server Setup Complete! ✅**

The WhisperLive server is now installed and configured with Python 3.11 in a virtual environment.

**To start the WhisperLive server:**
```bash
source ~/whisperlive_env_311/bin/activate
python /Users/qb83/holons.git/harvest/run_whisper_server.py --port 9090
```

Or use the convenience script:
```bash
./start_whisper_server.sh
```

**Once the server is running, test the integration:**
1. Ensure dev server is running: `yarn dev`
2. Navigate to a video call page
3. Allow camera/microphone access
4. Click the red record button (⏺️)
5. Speak into the microphone
6. Watch transcription appear in real-time in the panel (top-right on desktop, bottom on mobile)
7. Click stop button (⏹️) to end recording
8. Verify podcast saved to holosphere (check console logs for "Saved podcast...")

**Server Status:**
- Server is currently running on port 9090
- Ready to accept WebSocket connections from the video call interface

### Future Enhancements

- **Speaker Diarization**: Identify which participant is speaking
- **Podcast Playback**: Create UI to view/play saved podcasts
- **Podcast Browser**: List all podcasts for a holon
- **Edit Transcripts**: Allow manual correction of transcriptions
- **Export**: Download podcasts with transcripts (SRT, VTT formats)
- **Search**: Full-text search across podcast transcripts
- **AI Summary**: Generate podcast summaries using LLM
- **Multi-language**: Support transcription in multiple languages

## Files Modified/Created

### Created:
- `src/components/schemas/podcasts_schema-v0.1.0.json`
- `src/lib/whisperLiveClient.ts`
- `PODCAST_INTEGRATION.md`

### Modified:
- `src/lib/schemas.ts` (added podcast schema to registry)
- `src/components/VideoCall.svelte` (added record button and recording functions)

## Resources

- [WhisperLive GitHub](https://github.com/collabora/WhisperLive)
- [OpenAI Whisper](https://github.com/openai/whisper)
- [WebRTC MediaStream API](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
