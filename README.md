# Live Meeting Translator Extension v2

This project is a Chrome Extension (Manifest V3) for real-time bilingual subtitles in web meetings.

## Current Features

- Chrome tab audio capture (current active tab).
- Offscreen audio processing pipeline.
- Google Speech-to-Text API integration for English speech recognition.
- Google Translate API integration for English to Traditional Chinese translation.
- Floating bilingual subtitles (English + Traditional Chinese) at the bottom center of the webpage.
- Persistent capture architecture with MV3 service worker + offscreen document + content script (capture keeps running even if popup closes).

## Usage

1. Open `chrome://extensions/` in Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository folder.
5. Open extension **Options** and input your Google Cloud API key.
6. In Google Cloud, enable:
   - **Cloud Speech-to-Text API**
   - **Cloud Translation API**
7. Open a YouTube, Google Meet, or Teams web tab.
8. Click **Start Translation** in the popup.

## Architecture

- `background.js`: Capture lifecycle orchestration and message routing.
- `offscreen.js`: Audio stream capture, chunk recording, Google Speech-to-Text, and Google Translate API calls.
- `content.js`: Floating subtitle UI renderer.
- `popup.*`: Control panel (start/stop/status/settings shortcut).
- `options.*`: Local storage of Google API key.

## Limitations

- Can only capture Chrome tab audio.
- Cannot capture desktop Teams native app audio.
- API key is temporarily stored in `chrome.storage.local`.
- Before publishing to Chrome Web Store, use a proxy server so the API key is not exposed directly on the client.
- This is currently a development/test build.
