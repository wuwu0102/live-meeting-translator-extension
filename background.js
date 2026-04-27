let currentTabId = null;
let isCapturing = false;
let streamId = null;

const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

function sendStatusUpdate(status, error) {
  chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', status, error }).catch(() => {
    // Popup can be closed; ignore delivery errors.
  });
}

async function ensureContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  });

  await chrome.tabs.sendMessage(tabId, { type: 'INIT_SUBTITLE' }).catch(() => {
    // If navigation changes quickly, content script may not be ready yet.
  });
}

async function hasOffscreenDocument() {
  if (typeof chrome.offscreen.hasDocument === 'function') {
    return chrome.offscreen.hasDocument();
  }

  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)]
  });

  return contexts.length > 0;
}

async function ensureOffscreenDocument() {
  const exists = await hasOffscreenDocument();
  if (exists) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: ['USER_MEDIA'],
    justification: 'Capture tab audio and process speech transcription.'
  });
}

async function startCapture(tabId) {
  const { googleApiKey } = await chrome.storage.local.get(['googleApiKey']);
  if (!googleApiKey) {
    throw new Error('Missing Google API Key');
  }

  await ensureContentScript(tabId);

  streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
  await ensureOffscreenDocument();

  await chrome.runtime.sendMessage({
    type: 'START_OFFSCREEN_CAPTURE',
    streamId,
    tabId,
    apiKey: googleApiKey
  });

  currentTabId = tabId;
  isCapturing = true;
  sendStatusUpdate('Capturing');
}

async function stopCapture() {
  try {
    await chrome.runtime.sendMessage({ type: 'STOP_OFFSCREEN_CAPTURE' });
  } catch (error) {
    console.warn('[background] Failed to notify offscreen to stop:', error);
  }

  if (typeof currentTabId === 'number') {
    await chrome.tabs.sendMessage(currentTabId, { type: 'CLEAR_SUBTITLE' }).catch(() => {
      // Ignore when tab is unavailable.
    });
  }

  currentTabId = null;
  isCapturing = false;
  streamId = null;
  sendStatusUpdate('Idle');
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_CAPTURE') {
    const tabId = message.tabId;

    if (typeof tabId !== 'number') {
      sendResponse({ ok: false, error: 'Missing active tab id' });
      return false;
    }

    startCapture(tabId)
      .then(() => {
        sendResponse({ ok: true, status: 'Capturing' });
      })
      .catch((error) => {
        console.error('[background] START_CAPTURE failed:', error);
        isCapturing = false;
        streamId = null;
        sendStatusUpdate('Error', error.message || 'Start capture failed');

        chrome.tabs.sendMessage(tabId, {
          type: 'ERROR_SUBTITLE',
          error: error.message || 'Start capture failed'
        }).catch(() => {
          // Ignore when content script is not ready.
        });

        sendResponse({ ok: false, error: error.message || 'Start capture failed' });
      });

    return true;
  }

  if (message.type === 'STOP_CAPTURE') {
    stopCapture()
      .then(() => sendResponse({ ok: true, status: 'Idle' }))
      .catch((error) => {
        console.error('[background] STOP_CAPTURE failed:', error);
        sendStatusUpdate('Error', error.message || 'Stop capture failed');
        sendResponse({ ok: false, error: error.message || 'Stop capture failed' });
      });

    return true;
  }

  if (message.type === 'OFFSCREEN_STATUS') {
    const status = message.status || 'Idle';
    sendStatusUpdate(status, message.error);
    return false;
  }

  if (message.type === 'TRANSCRIPTION_RESULT') {
    const tabId = message.tabId ?? currentTabId;
    if (typeof tabId === 'number') {
      chrome.tabs.sendMessage(tabId, {
        type: 'UPDATE_SUBTITLE',
        english: message.english || '',
        chinese: message.chinese || ''
      }).catch(() => {
        // Ignore when page is closed.
      });
    }

    sendStatusUpdate('Capturing');
    return false;
  }

  if (message.type === 'CAPTURE_ERROR') {
    const tabId = message.tabId ?? currentTabId;

    if (typeof tabId === 'number') {
      chrome.tabs.sendMessage(tabId, {
        type: 'ERROR_SUBTITLE',
        error: message.error || 'Capture error'
      }).catch(() => {
        // Ignore when page is closed.
      });
    }

    sendStatusUpdate('Error', message.error || 'Capture error');
    return false;
  }

  if (message.type === 'GET_STATUS') {
    sendResponse({
      ok: true,
      status: isCapturing ? 'Capturing' : 'Idle',
      isCapturing,
      currentTabId
    });
    return false;
  }

  return false;
});
