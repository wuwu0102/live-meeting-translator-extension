let activeTabId = null;
let currentStream = null;
let audioContext = null;
let sourceNode = null;
let mediaRecorder = null;
let isProcessing = false;
let currentApiKey = null;

function logStage(stage, payload) {
  if (payload !== undefined) {
    console.log(`[offscreen] ${stage}`, payload);
  } else {
    console.log(`[offscreen] ${stage}`);
  }
}

async function reportError(error, tabId = activeTabId) {
  const message = typeof error === 'string' ? error : error?.message || 'Unknown capture error';
  console.error('[offscreen] error:', error);
  await chrome.runtime.sendMessage({
    type: 'CAPTURE_ERROR',
    tabId,
    error: message
  });
}


function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      try {
        const dataUrl = String(reader.result || '');
        const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
        resolve(base64);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(reader.error || new Error('Failed to read audio blob'));
    };

    reader.readAsDataURL(blob);
  });
}

async function transcribeWithGoogle(base64Audio) {
  if (!currentApiKey) {
    throw new Error('Missing Google API Key in offscreen');
  }
  const response = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${encodeURIComponent(currentApiKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      config: {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        languageCode: 'en-US',
        enableAutomaticPunctuation: true,
        model: 'latest_long'
      },
      audio: {
        content: base64Audio
      }
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.error) {
    const errorMessage = data?.error?.message || `Speech-to-Text failed (${response.status})`;
    throw new Error(errorMessage);
  }

  const transcript = data?.results?.[0]?.alternatives?.[0]?.transcript || '';
  return transcript.trim();
}

function decodeHtmlEntities(text) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

async function translateWithGoogle(text) {
  if (!currentApiKey) {
    throw new Error('Missing Google API Key in offscreen');
  }
  const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(currentApiKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      q: text,
      source: 'en',
      target: 'zh-TW',
      format: 'text'
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.error) {
    const errorMessage = data?.error?.message || `Translation failed (${response.status})`;
    throw new Error(errorMessage);
  }

  const translatedText = data?.data?.translations?.[0]?.translatedText || '';
  return decodeHtmlEntities(translatedText).trim();
}

async function processChunk(blob) {
  if (!blob || blob.size < 1500) {
    return;
  }

  if (isProcessing) {
    logStage('skip blob (previous chunk still processing)');
    return;
  }

  isProcessing = true;
  logStage('blob recorded', { size: blob.size, type: blob.type });

  try {
    await chrome.runtime.sendMessage({ type: 'OFFSCREEN_STATUS', status: 'Translating' });

    const base64Audio = await blobToBase64(blob);
    const transcript = await transcribeWithGoogle(base64Audio);
    logStage('transcribed', transcript);

    if (!transcript) {
      return;
    }

    const translatedText = await translateWithGoogle(transcript);
    logStage('translated', translatedText);

    await chrome.runtime.sendMessage({
      type: 'TRANSCRIPTION_RESULT',
      tabId: activeTabId,
      english: transcript,
      chinese: translatedText
    });
  } catch (error) {
    await reportError(error);
  } finally {
    isProcessing = false;
  }
}

function getRecorderOptions() {
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
    return { mimeType: 'audio/webm;codecs=opus' };
  }

  if (MediaRecorder.isTypeSupported('audio/webm')) {
    return { mimeType: 'audio/webm' };
  }

  return undefined;
}

async function stopCapture() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  mediaRecorder = null;

  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }

  if (audioContext) {
    await audioContext.close();
    audioContext = null;
  }

  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
    currentStream = null;
  }

  activeTabId = null;
  currentApiKey = null;
  isProcessing = false;
  logStage('capture stopped');
}

async function startCapture(streamId, tabId, apiKey) {
  if (!apiKey) {
    throw new Error('Missing Google API Key in offscreen');
  }

  await stopCapture();
  activeTabId = tabId;
  currentApiKey = apiKey;

  currentStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    },
    video: false
  });

  audioContext = new AudioContext();
  sourceNode = audioContext.createMediaStreamSource(currentStream);
  sourceNode.connect(audioContext.destination);

  const options = getRecorderOptions();
  mediaRecorder = new MediaRecorder(currentStream, options);

  mediaRecorder.ondataavailable = async (event) => {
    try {
      await processChunk(event.data);
    } catch (error) {
      await reportError(error);
    }
  };

  mediaRecorder.onerror = async (event) => {
    await reportError(event.error || new Error('MediaRecorder error'));
  };

  mediaRecorder.start(4000);
  logStage('capture started', { tabId, mimeType: mediaRecorder.mimeType || 'default' });

  await chrome.runtime.sendMessage({ type: 'OFFSCREEN_STATUS', status: 'Capturing' });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_OFFSCREEN_CAPTURE') {
    startCapture(message.streamId, message.tabId, message.apiKey)
      .then(() => sendResponse({ ok: true }))
      .catch(async (error) => {
        await reportError(error, message.tabId);
        sendResponse({ ok: false, error: error.message || 'Failed to start offscreen capture' });
      });

    return true;
  }

  if (message.type === 'STOP_OFFSCREEN_CAPTURE') {
    stopCapture()
      .then(() => sendResponse({ ok: true }))
      .catch(async (error) => {
        await reportError(error);
        sendResponse({ ok: false, error: error.message || 'Failed to stop offscreen capture' });
      });

    return true;
  }

  return false;
});
