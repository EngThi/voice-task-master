/* VTM Background - Simple Relay (No Offscreen) */
chrome.runtime.onInstalled.addListener(() => {
  // Não abrimos mais páginas de permissão chatas
  console.log("VTM Installed");
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "activate-voice") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "ACTIVATE_VOICE" });
      }
    });
  }
});
