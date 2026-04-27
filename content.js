(() => {
  const CONTAINER_ID = 'live-translator-subtitle-box';
  const EN_TEXT_ID = 'live-translator-subtitle-en';
  const ZH_TEXT_ID = 'live-translator-subtitle-zh';

  function injectSubtitleBox() {
    if (document.getElementById(CONTAINER_ID)) {
      return;
    }

    const container = document.createElement('section');
    container.id = CONTAINER_ID;
    container.style.position = 'fixed';
    container.style.left = '50%';
    container.style.bottom = '32px';
    container.style.transform = 'translateX(-50%)';
    container.style.zIndex = '2147483647';
    container.style.width = 'min(900px, calc(100vw - 48px))';
    container.style.background = 'rgba(0, 0, 0, 0.65)';
    container.style.borderRadius = '12px';
    container.style.padding = '16px 18px';
    container.style.color = '#ffffff';
    container.style.fontFamily = "'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    container.style.textAlign = 'center';
    container.style.pointerEvents = 'none';

    const enText = document.createElement('p');
    enText.id = EN_TEXT_ID;
    enText.textContent = 'Listening...';
    enText.style.margin = '0 0 8px';
    enText.style.fontSize = '30px';
    enText.style.fontWeight = '700';
    enText.style.lineHeight = '1.25';

    const zhText = document.createElement('p');
    zhText.id = ZH_TEXT_ID;
    zhText.textContent = '正在聆聽...';
    zhText.style.margin = '0';
    zhText.style.fontSize = '28px';
    zhText.style.fontWeight = '600';
    zhText.style.lineHeight = '1.25';
    zhText.style.color = '#d5e8ff';

    container.appendChild(enText);
    container.appendChild(zhText);
    document.body.appendChild(container);

    console.log('[content] Subtitle box injected');
  }

  function updateSubtitle(english, chinese) {
    injectSubtitleBox();

    const englishElement = document.getElementById(EN_TEXT_ID);
    const chineseElement = document.getElementById(ZH_TEXT_ID);

    if (englishElement) {
      englishElement.textContent = english || 'Listening...';
    }

    if (chineseElement) {
      chineseElement.textContent = chinese || '正在聆聽...';
    }

    console.log('[content] Subtitle updated:', { english, chinese });
  }

  injectSubtitleBox();

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'UPDATE_SUBTITLE') {
      updateSubtitle(message.english, message.chinese);
    }
  });
})();
