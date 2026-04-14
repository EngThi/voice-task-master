/* VTM Offscreen — SpeechRecognition isolado fora do popup */
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "START_VOICE") {
    startVoice(msg.lang || "en-US");
  }
});

function startVoice(lang) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    chrome.runtime.sendMessage({ type: "VOICE_ERROR", error: "not_supported" });
    return;
  }

  const r = new SR();
  r.lang = lang;
  r.interimResults = false;
  r.continuous = false;

  r.onresult = (ev) => {
    const transcript = ev.results[0][0].transcript;
    chrome.runtime.sendMessage({ type: "VOICE_RESULT", transcript });
  };

  r.onerror = (ev) => {
    chrome.runtime.sendMessage({ type: "VOICE_ERROR", error: ev.error });
  };

  r.onend = () => {
    // noop — resultado já foi enviado pelo onresult
  };

  r.start();
}
