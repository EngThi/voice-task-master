chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: "permissions.html" });
  }
});

// Recebe Ctrl+Shift+V global e repassa para o content.js da aba ativa
// O content.js já tem startVoice() e sabe lidar com ACTIVATE_VOICE
chrome.commands.onCommand.addListener((command) => {
  if (command === "activate-voice") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) return;
      chrome.tabs.sendMessage(tabs[0].id, { type: "ACTIVATE_VOICE" }, () => {
        if (chrome.runtime.lastError) { /* aba sem content script — ok */ }
      });
    });
  }
});
