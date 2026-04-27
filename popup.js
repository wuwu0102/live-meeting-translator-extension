const statusText = document.getElementById('statusText');
const errorText = document.getElementById('errorText');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const settingsBtn = document.getElementById('settingsBtn');

function setStatus(status, errorMessage = '') {
  statusText.textContent = status;
  statusText.className = 'status';
  errorText.hidden = true;
  errorText.textContent = '';

  if (status === 'Capturing') {
    statusText.classList.add('capturing');
  } else if (status === 'Translating') {
    statusText.classList.add('translating');
  } else if (status === 'Error') {
    statusText.classList.add('error');
    if (errorMessage) {
      errorText.hidden = false;
      errorText.textContent = errorMessage;
    }
  } else if (status === 'Stopped') {
    statusText.classList.add('stopped');
  } else {
    statusText.classList.add('idle');
  }
}

async function refreshStatus() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
  if (!response?.ok) {
    setStatus('Idle');
    return;
  }

  setStatus(response.status || 'Idle');
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'STATUS_UPDATE') {
    setStatus(message.status || 'Idle', message.error || '');
  }
});

startBtn.addEventListener('click', async () => {
  setStatus('Capturing');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      setStatus('Error', 'No active tab found');
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: 'START_CAPTURE',
      tabId: tab.id
    });

    if (!response?.ok) {
      setStatus('Error', response?.error || 'Failed to start capture');
      return;
    }

    setStatus('Capturing');
  } catch (error) {
    setStatus('Error', error.message || 'Failed to start capture');
  }
});

stopBtn.addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' });
    if (response?.ok) {
      setStatus('Stopped');
      return;
    }

    setStatus('Error', response?.error || 'Failed to stop capture');
  } catch (error) {
    setStatus('Error', error.message || 'Failed to stop capture');
  }
});

settingsBtn.addEventListener('click', async () => {
  await chrome.runtime.openOptionsPage();
});

refreshStatus().catch(() => {
  setStatus('Idle');
});
