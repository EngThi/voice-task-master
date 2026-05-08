/* VTM Permissions - The Gateway */

document.getElementById('grant').addEventListener('click', async () => {
  const status = document.getElementById('status');
  status.textContent = "Requesting microphone access...";
  
  try {
    // Esse comando FORÇA o Chrome a abrir o popup de "Permitir"
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Se deu certo, para o microfone e avisa o usuário
    stream.getTracks().forEach(track => track.stop());
    
    status.textContent = "SUCCESS: ACCESS GRANTED. You can close this tab.";
    status.style.color = "#10B981";
    
    // Pequeno delay para o Chrome salvar a permissão antes de fechar
    setTimeout(() => {
      window.close();
    }, 2000);
    
  } catch (err) {
    console.error("Mic access denied:", err);
    status.textContent = "ERROR: " + err.message + ". Check the lock icon in the URL bar.";
    status.style.color = "#ff003c";
  }
});
