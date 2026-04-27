let audioStream = null;
let audioContext = null;
let sourceNode = null;
let destinationNode = null;
let mediaRecorder = null;
let recorderTimer = null;
let currentTabId = null;
let mockPhraseIndex = 0;

const MOCK_PHRASES = ['hello', 'test', 'welcome', 'this is a live subtitle demo'];

function stopAudioCapture() {
  if (recorderTimer) {
    clearInterval(recorderTimer);
    recorderTimer = null;
  }

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try {
      mediaRecorder.stop();
    } catch (error) {
      console.error('[background] Failed to stop MediaRecorder:', error);
    }
  }
  mediaRecorder = null;

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
      console.error('[background] Failed to close AudioContext:', error);
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
    console.error('[background] Failed to inject content script:', error);
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unexpected FileReader result type'));
        return;
      }
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

function mockSpeechToText(base64Audio) {
  const phrase = MOCK_PHRASES[mockPhraseIndex % MOCK_PHRASES.length];
  mockPhraseIndex += 1;
  console.log('[background] mockSpeechToText done, base64 length:', base64Audio.length, 'text:', phrase);
  return phrase;
}

function mockTranslateToChinese(englishText) {
  const dictionary = {
    hello: '你好',
    test: '測試',
    welcome: '歡迎',
    'this is a live subtitle demo': '這是一個即時字幕示範'
  };
  return dictionary[englishText.toLowerCase()] || `（翻譯）${englishText}`;
}

function notifyPopup(status) {
  chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', status }).catch(() => {
    // popup may not be open
  });
}

async function processAudioChunk(blob) {
  if (!blob || blob.size === 0 || typeof currentTabId !== 'number') {
    return;
  }

  try {
    console.log('[background] Processing audio chunk, size:', blob.size);
    notifyPopup('Capturing / Translating');

    const base64 = await blobToBase64(blob);
    const englishText = mockSpeechToText(base64);
    const chineseText = mockTranslateToChinese(englishText);

    console.log('[background] Subtitle update:', { englishText, chineseText });
    chrome.tabs.sendMessage(currentTabId, {
      type: 'UPDATE_SUBTITLE',
      english: englishText,
      chinese: chineseText
    });

    notifyPopup('Capturing');
  } catch (error) {
    console.error('[background] Failed to process audio chunk:', error);
  }
}

function startMediaRecorder(stream) {
  mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

  mediaRecorder.ondataavailable = async (event) => {
    await processAudioChunk(event.data);
  };

  mediaRecorder.onerror = (event) => {
    console.error('[background] MediaRecorder error:', event.error);
  };

  mediaRecorder.onstart = () => {
    console.log('[background] MediaRecorder started');
  };

  mediaRecorder.start();
  recorderTimer = setInterval(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.requestData();
      console.log('[background] Requested 3-second audio chunk');
    }
  }, 3000);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_CAPTURE') {
    const tabId = message.tabId ?? sender?.tab?.id;

    chrome.tabCapture.capture({ audio: true, video: false }, async (stream) => {
      if (chrome.runtime.lastError || !stream) {
        console.error('[background] Failed to start audio capture:', chrome.runtime.lastError?.message || 'Unknown error');
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

        startMediaRecorder(audioStream);

        console.log('[background] Audio capture started');
        notifyPopup('Capturing');

        if (typeof tabId === 'number') {
          await ensureContentScript(tabId);

          chrome.tabs.sendMessage(tabId, {
            type: 'UPDATE_SUBTITLE',
            english: 'Listening...',
            chinese: '正在聆聽...'
          });
        }

        sendResponse({ ok: true });
      } catch (error) {
        console.error('[background] Error while preparing audio pipeline:', error);
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
          english: 'Stopped',
          chinese: '已停止'
        });
      }

      notifyPopup('Stopped');
      currentTabId = null;
      sendResponse({ ok: true });
    } catch (error) {
      console.error('[background] Failed to stop audio capture:', error);
      sendResponse({ ok: false });
    }

    return true;
  }

  return false;
});
