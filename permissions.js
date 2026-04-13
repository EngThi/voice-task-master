document.getElementById('grant').addEventListener('click', async () => {
  const status = document.getElementById('status');
  status.textContent = "Requesting access...";
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    status.textContent = "SUCCESS: ACCESS GRANTED. You can close this tab.";
    status.style.color = "#00ff9d";
    setTimeout(() => window.close(), 2000);
  } catch (err) {
    status.textContent = "ERROR: " + err.message;
    status.style.color = "#ff003c";
  }
});
