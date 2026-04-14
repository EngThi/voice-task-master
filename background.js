chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: "permissions.html" });
  }
});

// ── VOICE GLOBAL SHORTCUT ──
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "activate-voice") {
    await ensureOffscreen();
    const data = await chrome.storage.local.get(["vtm_voice_lang"]);
    const lang = data.vtm_voice_lang || "en-US";
    chrome.runtime.sendMessage({ type: "START_VOICE", lang });
  }
});

async function ensureOffscreen() {
  const existing = await chrome.offscreen.hasDocument();
  if (!existing) {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["USER_MEDIA"],
      justification: "SpeechRecognition via Ctrl+Shift+V fora do popup"
    });
  }
}

// Recebe resultado do offscreen e salva para o popup consumir
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "VOICE_RESULT" && msg.transcript) {
    chrome.storage.local.set({ vtm_voice_pending: msg.transcript });
  }
  if (msg.type === "VOICE_ERROR") {
    chrome.storage.local.set({ vtm_voice_pending: null });
  }
});
