(() => {
  const CONTAINER_ID = 'live-meeting-translator-v2-subtitle';
  const ENGLISH_ID = 'live-meeting-translator-v2-english';
  const CHINESE_ID = 'live-meeting-translator-v2-chinese';

  function createSubtitleBox() {
    if (document.getElementById(CONTAINER_ID)) {
      return;
    }

    const container = document.createElement('div');
    container.id = CONTAINER_ID;
    container.style.position = 'fixed';
    container.style.bottom = '64px';
    container.style.left = '50%';
    container.style.transform = 'translateX(-50%)';
    container.style.width = 'min(900px, 90vw)';
    container.style.background = 'rgba(0,0,0,0.78)';
    container.style.color = 'white';
    container.style.borderRadius = '16px';
    container.style.padding = '16px 22px';
    container.style.zIndex = '2147483647';
    container.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    container.style.boxShadow = '0 14px 36px rgba(0,0,0,0.45)';
    container.style.pointerEvents = 'none';
    container.style.textAlign = 'center';
    container.style.display = 'none';

    const english = document.createElement('div');
    english.id = ENGLISH_ID;
    english.style.fontSize = '16px';
    english.style.opacity = '0.85';
    english.style.marginBottom = '8px';
    english.style.lineHeight = '1.4';

    const chinese = document.createElement('div');
    chinese.id = CHINESE_ID;
    chinese.style.fontSize = '28px';
    chinese.style.fontWeight = '700';
    chinese.style.lineHeight = '1.35';

    container.appendChild(english);
    container.appendChild(chinese);
    document.documentElement.appendChild(container);
  }

  function getElements() {
    createSubtitleBox();

    return {
      container: document.getElementById(CONTAINER_ID),
      english: document.getElementById(ENGLISH_ID),
      chinese: document.getElementById(CHINESE_ID)
    };
  }

  function updateSubtitle(englishText, chineseText) {
    const { container, english, chinese } = getElements();
    if (!container || !english || !chinese) {
      return;
    }

    english.textContent = englishText || '';
    chinese.textContent = chineseText || '';
    container.style.display = 'block';
  }

  function showError(message) {
    updateSubtitle('Error', message || 'Translation error');
  }

  function clearSubtitle() {
    const { container, english, chinese } = getElements();
    if (!container || !english || !chinese) {
      return;
    }

    english.textContent = '';
    chinese.textContent = '';
    container.style.display = 'none';
  }

  createSubtitleBox();

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'INIT_SUBTITLE') {
      createSubtitleBox();
      return;
    }

    if (message.type === 'UPDATE_SUBTITLE') {
      updateSubtitle(message.english, message.chinese);
      return;
    }

    if (message.type === 'ERROR_SUBTITLE') {
      showError(message.error);
      return;
    }

    if (message.type === 'CLEAR_SUBTITLE') {
      clearSubtitle();
    }
  });
})();
