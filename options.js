const apiKeyInput = document.getElementById('apiKeyInput');
const saveBtn = document.getElementById('saveBtn');
const clearBtn = document.getElementById('clearBtn');
const statusText = document.getElementById('statusText');

function setStatus(text, type = 'idle') {
  statusText.textContent = text;
  statusText.className = `status ${type}`;
}

async function loadSettings() {
  const { openaiApiKey } = await chrome.storage.local.get('openaiApiKey');
  apiKeyInput.value = openaiApiKey || '';
  setStatus('Idle', 'idle');
}

saveBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();

  if (!key) {
    setStatus('Please enter an API Key', 'error');
    return;
  }

  await chrome.storage.local.set({ openaiApiKey: key });
  setStatus('Saved', 'capturing');
});

clearBtn.addEventListener('click', async () => {
  await chrome.storage.local.remove('openaiApiKey');
  apiKeyInput.value = '';
  setStatus('Cleared', 'stopped');
});

loadSettings().catch(() => {
  setStatus('Failed to load settings', 'error');
});
