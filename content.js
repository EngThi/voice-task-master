/* VTM v1.5.2 - Command Palette Edition (FIXED) */
(function() {
  const STORAGE_KEY = "vtm_tasks_v1";
  const CONTEXT_KEY = "vtm_active_context";

  /* --- PROJECT CONTEXT DETECTION --- */
  function detectProjectContext() {
    const match = window.location.pathname.match(/\/projects\/([^\/]+)/);
    if (match) {
      const slug = match[1];
      const nameEl = document.querySelector(".project-show-card__title-text");
      const name = nameEl ? nameEl.textContent.trim() : slug;
      chrome.storage.local.set({ [CONTEXT_KEY]: { id: slug, slug, name, url: location.href } });
    } else if (window.location.pathname === "/kitchen" || window.location.pathname === "/") {
      chrome.storage.local.set({ [CONTEXT_KEY]: { id: null, slug: null, name: "Kitchen", url: location.href } });
    } else {
      chrome.storage.local.remove(CONTEXT_KEY);
    }
  }

  detectProjectContext();

  /* --- HUD (Command Palette Style) --- */
  const badge = document.createElement('div');
  badge.id = 'vtm-ship-hud';
  badge.innerHTML = `
    <div id="vtm-hud-main">
      <div id="vtm-hud-header">
        <span id="vtm-hud-title">VTM // NEURAL UPLINK</span>
        <div id="vtm-voice-visualizer">
          <div class="vtm-bar"></div>
          <div class="vtm-bar"></div>
          <div class="vtm-bar"></div>
        </div>
      </div>
      <div id="vtm-hud-project-name">Waiting for Command...</div>
      <div id="vtm-hud-tasks"></div>
    </div>
  `;
  document.body.appendChild(badge);

  const style = document.createElement('style');
  style.textContent = `
    #vtm-ship-hud {
      position: fixed !important;
      top: 15% !important;
      left: 50% !important;
      transform: translateX(-50%) translateY(-30px) !important;
      z-index: 2147483647 !important;
      background-color: #0a0a0a !important;
      border: 1px solid #10B981 !important;
      color: #ffffff !important;
      padding: 20px !important;
      font-family: system-ui, -apple-system, sans-serif !important;
      width: 450px !important;
      border-radius: 16px !important;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(16, 185, 129, 0.1) !important;
      backdrop-filter: blur(20px) !important;
      font-size: 14px !important;
      opacity: 0 !important;
      pointer-events: none !important;
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1) !important;
      display: block !important;
    }

    #vtm-ship-hud.vtm-active {
      opacity: 1 !important;
      transform: translateX(-50%) translateY(0) !important;
      pointer-events: auto !important;
    }

    #vtm-hud-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #262626; padding-bottom: 12px; margin-bottom: 15px; }
    #vtm-hud-title { color: #10B981; font-weight: 800; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; }
    #vtm-hud-project-name { color: #ffffff; font-size: 16px; margin-bottom: 15px; font-weight: 600; min-height: 24px; }
    .vtm-hud-task { margin-bottom: 8px; padding: 10px 14px; background: rgba(255,255,255,0.03); border-radius: 8px; border-left: 3px solid #10B981; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; font-size: 13px; }
    
    #vtm-voice-visualizer { display: none; gap: 4px; align-items: center; height: 16px; }
    .vtm-bar { width: 4px; height: 100%; background: #F567D7; border-radius: 2px; animation: vtm-bounce 0.6s infinite ease-in-out; }
    .vtm-bar:nth-child(2) { animation-delay: 0.1s; }
    .vtm-bar:nth-child(3) { animation-delay: 0.2s; }
    @keyframes vtm-bounce { 0%, 100% { height: 6px; } 50% { height: 16px; } }
    
    @keyframes vtm-ship-flash { 0% { background: rgba(16,185,145,0); } 50% { background: rgba(16,185,145,0.15); } 100% { background: rgba(16,185,145,0); } }
    .vtm-celebration { position:fixed; top:0; left:0; width:100%; height:100%; z-index:999998; pointer-events:none; animation: vtm-ship-flash 0.8s ease-in-out; }
  `;
  document.head.appendChild(style);

  /* --- VOICE RECOGNITION --- */
  let recognition = null;
  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (recognition) { recognition.stop(); return; }

    recognition = new SR();
    recognition.lang = VTM_I18N.voiceLang;
    recognition.interimResults = true;
    
    const hud = document.getElementById('vtm-ship-hud');
    const visualizer = document.getElementById('vtm-voice-visualizer');
    const projectNameEl = document.getElementById('vtm-hud-project-name');
    
    recognition.onstart = () => { 
      hud.classList.add('vtm-active');
      visualizer.style.display = 'flex';
      projectNameEl.textContent = "Listening for Command...";
      projectNameEl.style.color = "#848484";
    };
    
    recognition.onresult = async (ev) => {
      let interim = "";
      let final = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) final += ev.results[i][0].transcript;
        else interim += ev.results[i][0].transcript;
      }

      if (interim) {
        projectNameEl.textContent = interim;
        projectNameEl.style.color = "#F567D7";
      }

      if (final) {
        const data = await chrome.storage.local.get([STORAGE_KEY, CONTEXT_KEY]);
        const tasks = data[STORAGE_KEY] || [];
        const info = data[CONTEXT_KEY];
        
        tasks.unshift({
          id: Math.random().toString(16).slice(2),
          text: info?.id ? `${final} #${info.id}` : final,
          priority: final.toLowerCase().includes("critical") ? "critical" : "backlog",
          group: "Voice",
          projectId: info?.id || null,
          done: false,
          createdAt: Date.now()
        });
        await chrome.storage.local.set({ [STORAGE_KEY]: tasks });
        projectNameEl.textContent = "Order Placed!";
        projectNameEl.style.color = "#10B981";
        setTimeout(() => { hud.classList.remove('vtm-active'); }, 1200);
      }
    };
    
    recognition.onend = () => { 
      visualizer.style.display = 'none';
      recognition = null; 
    };
    
    recognition.onerror = (e) => { 
      visualizer.style.display = 'none';
      recognition = null; 
      projectNameEl.textContent = "Voice Error: " + e.error;
      setTimeout(() => { hud.classList.remove('vtm-active'); }, 1500);
    };
    
    recognition.start();
  }

  /* --- MESSAGES --- */
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "CELEBRATE_SHIP") {
      const flash = document.createElement('div');
      flash.className = 'vtm-celebration';
      document.body.appendChild(flash);
      setTimeout(() => flash.remove(), 1000);
    }
    if (msg.type === "ACTIVATE_VOICE") {
      startVoice();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'v') {
      startVoice();
    }
  });

  /* --- HUD REFRESH --- */
  const refreshHUD = async () => {
    const data = await chrome.storage.local.get([STORAGE_KEY, CONTEXT_KEY]);
    const info = data[CONTEXT_KEY];
    const tasks = data[STORAGE_KEY] || [];
    const container = document.getElementById('vtm-hud-tasks');
    const filtered = (info && info.id)
      ? tasks.filter(t => !t.done && t.projectId === info.id)
      : tasks.filter(t => !t.done).slice(0, 3);
    container.innerHTML = filtered.map(t => `<div class="vtm-hud-task">${t.text}</div>`).join('') || '<div style="opacity:0.3; font-size:11px; text-align:center; padding: 10px;">The Kitchen is clear.</div>';
  };

  refreshHUD();
  chrome.storage.onChanged.addListener(refreshHUD);
})();
