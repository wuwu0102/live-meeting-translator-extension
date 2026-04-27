const statusText = document.getElementById('statusText');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');

function setStatus(status) {
  statusText.textContent = status;
  statusText.classList.remove('idle', 'capturing', 'stopped', 'translating');

  if (status === 'Capturing') {
    statusText.classList.add('capturing');
  } else if (status === 'Capturing / Translating') {
    statusText.classList.add('translating');
  } else if (status === 'Stopped') {
    statusText.classList.add('stopped');
  } else {
    statusText.classList.add('idle');
  }

  console.log('[popup] Status:', status);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'STATUS_UPDATE') {
    setStatus(message.status || 'Idle');
  }
});

startBtn.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      console.error('[popup] No active tab found');
      setStatus('Stopped');
      return;
    }

    chrome.runtime.sendMessage({ type: 'START_CAPTURE', tabId: tab.id }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[popup] Failed to send START_CAPTURE:', chrome.runtime.lastError.message);
        setStatus('Stopped');
        return;
      }

      if (response?.ok) {
        setStatus('Capturing');
      } else {
        setStatus('Stopped');
      }
    });
  } catch (error) {
    console.error('[popup] Error during start capture:', error);
    setStatus('Stopped');
  }
});

stopBtn.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.runtime.sendMessage({ type: 'STOP_CAPTURE', tabId: tab?.id }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[popup] Failed to send STOP_CAPTURE:', chrome.runtime.lastError.message);
        return;
      }

      if (response?.ok) {
        setStatus('Stopped');
      }
    });
  } catch (error) {
    console.error('[popup] Error during stop capture:', error);
  }
});
