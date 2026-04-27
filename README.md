# Live Meeting Translator Extension v2

This project is a Chrome Extension (Manifest V3) for real-time bilingual subtitles in web meetings.

## Current Features

- Chrome tab audio capture (current active tab).
- Offscreen audio processing pipeline.
- OpenAI transcription API integration (`gpt-4o-mini-transcribe`).
- English to Traditional Chinese translation (`gpt-4o-mini`).
- Floating bilingual subtitles (English + Traditional Chinese) at the bottom center of the webpage.
- Persistent capture architecture with MV3 service worker + offscreen document + content script (capture keeps running even if popup closes).

## Usage

1. Open `chrome://extensions/` in Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository folder.
5. Open extension **Options** and input your OpenAI API key.
6. Open a YouTube, Google Meet, or Teams web tab.
7. Click **Start Translation** in the popup.

## Architecture

- `background.js`: Capture lifecycle orchestration and message routing.
- `offscreen.js`: Audio stream capture, chunk recording, transcription, and translation API calls.
- `content.js`: Floating subtitle UI renderer.
- `popup.*`: Control panel (start/stop/status/settings shortcut).
- `options.*`: Secure local storage of OpenAI API key.

## Limitations

- Can only capture Chrome tab audio.
- Cannot capture desktop Teams native app audio.
- API key is stored in local `chrome.storage.local`; before production release, use your own proxy server.
- This is currently a development/test build.
