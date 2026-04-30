/* VTM Background - Pure Relay */
chrome.commands.onCommand.addListener((command) => {
  if (command === "activate-voice" || command === "quick-save-context") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: command === "activate-voice" ? "ACTIVATE_VOICE" : "QUICK_SAVE_CONTEXT"
        });
      }
    });
  }
});
