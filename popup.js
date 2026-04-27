const statusText = document.getElementById('statusText');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');

function setStatus(status) {
  statusText.textContent = status;
  statusText.classList.remove('idle', 'capturing', 'stopped');

  if (status === 'Capturing') {
    statusText.classList.add('capturing');
  } else if (status === 'Stopped') {
    statusText.classList.add('stopped');
  } else {
    statusText.classList.add('idle');
  }
}

startBtn.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      console.error('No active tab found');
      setStatus('Stopped');
      return;
    }

    chrome.runtime.sendMessage({ type: 'START_CAPTURE', tabId: tab.id }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to send START_CAPTURE:', chrome.runtime.lastError.message);
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
    console.error('Error during start capture:', error);
    setStatus('Stopped');
  }
});

stopBtn.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.runtime.sendMessage({ type: 'STOP_CAPTURE', tabId: tab?.id }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to send STOP_CAPTURE:', chrome.runtime.lastError.message);
        return;
      }

      if (response?.ok) {
        setStatus('Stopped');
      }
    });
  } catch (error) {
    console.error('Error during stop capture:', error);
  }
});
