# Live Meeting Translator Extension

This repository contains a **Chrome Extension (Manifest V3)** prototype for real-time meeting translation subtitles.

## Current v1 Features

- Capture audio from the current Chrome tab.
- Keep the tab audio audible by routing captured audio back to speakers.
- Display a floating subtitle box at the bottom-right corner of the current page.

## How to Test

1. Open `chrome://extensions/` in Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.
5. Open YouTube or a web-based meeting page and test the extension popup.

## Next Phase

The next phase will add:

- Speech-to-text transcription.
- Translation API integration for live bilingual subtitles.
