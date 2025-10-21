# WhisperLive Server Setup

## Installation Complete ✅

WhisperLive has been successfully installed in a Python 3.11 virtual environment at `~/whisperlive_env_311/`.

## Starting the Server

### Option 1: Using the convenience script
```bash
./start_whisper_server.sh
```

### Option 2: Manual start
```bash
source ~/whisperlive_env_311/bin/activate
python run_whisper_server.py --port 9090
```

## Server Details

- **URL**: `ws://localhost:9090`
- **Backend**: faster_whisper
- **Max Clients**: 4
- **Python Version**: 3.11.11

## Testing the Integration

1. **Start the WhisperLive server** (see above)
2. **Start the dev server**: `yarn dev`
3. **Open a video call** in your browser
4. **Click the record button** (⏺️) in the video call interface
5. **Speak into the microphone** - you should see real-time transcription appear
6. **Click stop** (⏹️) to end recording and save the podcast

## Troubleshooting

### Server not starting
- Make sure the virtual environment is activated: `source ~/whisperlive_env_311/bin/activate`
- Check if port 9090 is already in use: `lsof -i :9090`

### WebSocket connection errors
- Ensure the WhisperLive server is running before starting a recording
- Check browser console for detailed error messages
- Verify the server URL in `src/components/VideoCall.svelte` is set to `ws://localhost:9090`

### No transcription appearing
- First run may take longer as the Whisper model is downloaded
- Speak clearly and loudly enough for the microphone to detect
- Check server logs for any errors

## Files Created

- `~/whisperlive_env_311/` - Python virtual environment with WhisperLive
- `run_whisper_server.py` - Python script to start the server
- `start_whisper_server.sh` - Bash convenience script
- `PODCAST_INTEGRATION.md` - Complete integration documentation

## Model Information

WhisperLive uses the "base" Whisper model by default. Other available models:
- `tiny` - Fastest, least accurate
- `base` - Good balance (default)
- `small` - Better accuracy, slower
- `medium` - High accuracy, requires more resources
- `large` - Best accuracy, slowest

To change models, modify the `--model` parameter in `run_whisper_server.py`.
