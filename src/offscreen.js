/* VTM Offscreen v1.6.2 - Pure Recognition */

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.target === "offscreen" && msg.type === "START_VOICE") {
    startVoice(msg.lang || "en-US");
  }
});

let recognition = null;

function startVoice(lang) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;

  if (recognition) { try { recognition.abort(); } catch(e) {} }

  recognition = new SR();
  recognition.lang = lang;
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.onresult = (ev) => {
    const transcript = ev.results[0][0].transcript;
    chrome.runtime.sendMessage({ type: "VOICE_RESULT", transcript });
  };

  recognition.onerror = (ev) => {
    chrome.runtime.sendMessage({ type: "VOICE_ERROR", error: ev.error });
  };

  recognition.onend = () => { recognition = null; };
  recognition.start();
}
