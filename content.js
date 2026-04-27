(() => {
  const CONTAINER_ID = 'live-translator-subtitle-box';
  const TEXT_ID = 'live-translator-subtitle-text';

  function injectSubtitleBox() {
    if (document.getElementById(CONTAINER_ID)) {
      return;
    }

    const container = document.createElement('section');
    container.id = CONTAINER_ID;
    container.style.position = 'fixed';
    container.style.right = '20px';
    container.style.bottom = '20px';
    container.style.zIndex = '2147483647';
    container.style.width = 'min(420px, calc(100vw - 40px))';
    container.style.background = 'rgba(15, 18, 28, 0.82)';
    container.style.backdropFilter = 'blur(8px)';
    container.style.border = '1px solid rgba(255, 255, 255, 0.12)';
    container.style.borderRadius = '12px';
    container.style.boxShadow = '0 14px 28px rgba(0, 0, 0, 0.35)';
    container.style.color = '#f5f7ff';
    container.style.fontFamily = "'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    container.style.padding = '12px 14px';

    const title = document.createElement('h2');
    title.textContent = 'Live Translator';
    title.style.margin = '0 0 8px';
    title.style.fontSize = '14px';
    title.style.fontWeight = '700';
    title.style.color = '#d6dcff';

    const text = document.createElement('p');
    text.id = TEXT_ID;
    text.textContent = 'Waiting for translation...';
    text.style.margin = '0';
    text.style.fontSize = '14px';
    text.style.lineHeight = '1.5';
    text.style.color = '#ffffff';

    container.appendChild(title);
    container.appendChild(text);
    document.body.appendChild(container);
  }

  function updateSubtitle(newText) {
    injectSubtitleBox();
    const textElement = document.getElementById(TEXT_ID);
    if (textElement) {
      textElement.textContent = newText;
    }
  }

  injectSubtitleBox();

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'UPDATE_SUBTITLE') {
      updateSubtitle(message.text || 'Waiting for translation...');
    }
  });
})();
