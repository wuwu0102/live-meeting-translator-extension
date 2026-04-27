let activeTabId = null;
let currentStream = null;
let audioContext = null;
let sourceNode = null;
let mediaRecorder = null;
let isProcessing = false;

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

async function fetchApiKey() {
  const { openaiApiKey } = await chrome.storage.local.get('openaiApiKey');
  if (!openaiApiKey) {
    throw new Error('Missing OpenAI API Key');
  }
  return openaiApiKey;
}

async function transcribeAudio(blob, apiKey) {
  const formData = new FormData();
  formData.append('model', 'gpt-4o-mini-transcribe');
  formData.append('file', new File([blob], 'audio.webm', { type: blob.type || 'audio/webm' }));
  formData.append('response_format', 'json');
  formData.append('language', 'en');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: formData
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Transcription failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return (data.text || '').trim();
}

async function translateToTraditionalChinese(english, apiKey) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a professional real-time meeting interpreter. Translate English into natural Traditional Chinese. Only output the translation.'
        },
        {
          role: 'user',
          content: english
        }
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Translation failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return (data.choices?.[0]?.message?.content || '').trim();
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

    const apiKey = await fetchApiKey();
    const english = await transcribeAudio(blob, apiKey);
    logStage('transcribed', english);

    if (!english) {
      return;
    }

    const chinese = await translateToTraditionalChinese(english, apiKey);
    logStage('translated', chinese);

    await chrome.runtime.sendMessage({
      type: 'TRANSCRIPTION_RESULT',
      tabId: activeTabId,
      english,
      chinese
    });
  } catch (error) {
    await reportError(error);
  } finally {
    isProcessing = false;
  }
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
  isProcessing = false;
  logStage('capture stopped');
}

async function startCapture(streamId, tabId) {
  await stopCapture();
  activeTabId = tabId;

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

  const options = MediaRecorder.isTypeSupported('audio/webm') ? { mimeType: 'audio/webm' } : undefined;
  mediaRecorder = new MediaRecorder(currentStream, options);

  mediaRecorder.ondataavailable = async (event) => {
    await processChunk(event.data);
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
    startCapture(message.streamId, message.tabId)
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
