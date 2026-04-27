let audioStream = null;
let audioContext = null;
let sourceNode = null;
let destinationNode = null;
let currentTabId = null;

function stopAudioCapture() {
  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }

  if (destinationNode) {
    destinationNode.disconnect();
    destinationNode = null;
  }

  if (audioContext) {
    audioContext.close().catch((error) => {
      console.error('Failed to close AudioContext:', error);
    });
    audioContext = null;
  }

  if (audioStream) {
    audioStream.getTracks().forEach((track) => track.stop());
    audioStream = null;
  }
}

async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  } catch (error) {
    console.error('Failed to inject content script:', error);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_CAPTURE') {
    const tabId = message.tabId ?? sender?.tab?.id;

    chrome.tabCapture.capture({ audio: true, video: false }, async (stream) => {
      if (chrome.runtime.lastError || !stream) {
        console.error('Failed to start audio capture:', chrome.runtime.lastError?.message || 'Unknown error');
        sendResponse({ ok: false });
        return;
      }

      try {
        stopAudioCapture();

        audioStream = stream;
        currentTabId = tabId;
        audioContext = new AudioContext();
        sourceNode = audioContext.createMediaStreamSource(audioStream);
        destinationNode = audioContext.destination;
        sourceNode.connect(destinationNode);

        console.log('Audio capture started');

        if (typeof tabId === 'number') {
          await ensureContentScript(tabId);

          chrome.tabs.sendMessage(tabId, {
            type: 'UPDATE_SUBTITLE',
            text: 'Test subtitle: live translation pipeline initialized.'
          });
        }

        sendResponse({ ok: true });
      } catch (error) {
        console.error('Error while preparing audio playback or subtitle injection:', error);
        sendResponse({ ok: false });
      }
    });

    return true;
  }

  if (message.type === 'STOP_CAPTURE') {
    try {
      stopAudioCapture();

      if (typeof currentTabId === 'number') {
        chrome.tabs.sendMessage(currentTabId, {
          type: 'UPDATE_SUBTITLE',
          text: 'Stopped. Waiting for translation...'
        });
      }

      currentTabId = null;
      sendResponse({ ok: true });
    } catch (error) {
      console.error('Failed to stop audio capture:', error);
      sendResponse({ ok: false });
    }

    return true;
  }

  return false;
});
