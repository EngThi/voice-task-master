/* VTM v1.5.1 - Chef's Edition (Hack Club Native) */
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

  /* --- HUD --- */
  const badge = document.createElement('div');
  badge.id = 'vtm-ship-hud';
  badge.innerHTML = `
    <div id="vtm-hud-header">
      <span id="vtm-hud-title">VTM // MISSION CONTROL</span>
      <span id="vtm-hud-timer">00:00</span>
    </div>
    <div id="vtm-hud-project-name">Ready...</div>
    <div id="vtm-hud-status" style="font-size: 10px; margin-bottom: 8px; color: #F567D7; font-weight: bold; display: none;">● UPLINK ACTIVE</div>
    <div id="vtm-hud-tasks"></div>
  `;
  
  Object.assign(badge.style, {
    position: 'fixed', bottom: '24px', right: '24px', zIndex: '2147483647',
    backgroundColor: '#0a0a0a', border: '1px solid #262626',
    color: '#ffffff', padding: '16px', fontFamily: 'system-ui, -apple-system, sans-serif', width: '280px',
    borderRadius: '12px', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(10px)', fontSize: '12px'
  });
  document.body.appendChild(badge);

  const style = document.createElement('style');
  style.textContent = `
    #vtm-hud-header { display: flex; justify-content: space-between; border-bottom: 1px solid #262626; padding-bottom: 8px; margin-bottom: 10px; }
    #vtm-hud-title { color: #10B981; font-weight: 800; font-size: 11px; letter-spacing: 0.05em; }
    #vtm-hud-timer { font-family: monospace; color: #848484; font-size: 11px; }
    #vtm-hud-project-name { color: #ffcc00; font-size: 11px; margin-bottom: 12px; font-weight: 700; text-transform: uppercase; }
    .vtm-hud-task { margin-bottom: 6px; padding: 6px 10px; background: rgba(255,255,255,0.03); border-radius: 6px; border-left: 3px solid #10B981; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
    @keyframes vtm-ship-flash { 0% { background: rgba(16,185,145,0); } 50% { background: rgba(16,185,145,0.2); } 100% { background: rgba(16,185,145,0); } }
    .vtm-celebration { position:fixed; top:0; left:0; width:100%; height:100%; z-index:999998; pointer-events:none; animation: vtm-ship-flash 0.8s ease-in-out; }
  `;
  document.head.appendChild(style);

  /* --- VOICE RECOGNITION (Direct in Page) --- */
  let recognition = null;
  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (recognition) { recognition.stop(); return; }

    recognition = new SR();
    recognition.lang = VTM_I18N.voiceLang;
    recognition.interimResults = true;
    const statusEl = document.getElementById('vtm-hud-status');
    const projectNameEl = document.getElementById('vtm-hud-project-name');
    const originalProjectName = projectNameEl.textContent;
    
    recognition.onstart = () => { statusEl.style.display = 'block'; };
    recognition.onresult = async (ev) => {
      let interim = "";
      let final = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) final += ev.results[i][0].transcript;
        else interim += ev.results[i][0].transcript;
      }

      if (interim) {
        projectNameEl.textContent = `🎙️ ${interim}`;
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
        projectNameEl.textContent = originalProjectName;
        projectNameEl.style.color = "#ffcc00";
      }
    };
    recognition.onend = () => { 
      statusEl.style.display = 'none'; 
      recognition = null; 
      setTimeout(() => { projectNameEl.textContent = originalProjectName; }, 1000);
    };
    recognition.onerror = () => { 
      statusEl.style.display = 'none'; 
      recognition = null; 
      projectNameEl.textContent = "Voice Error";
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

  // Hotkey inside the page
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
      : tasks.filter(t => !t.done).slice(0, 5);
    container.innerHTML = filtered.map(t => `<div class="vtm-hud-task">${t.text}</div>`).join('') || '<div style="opacity:0.5; font-size:10px; color:#848484">Grid Clear.</div>';
    if (info && info.name) document.getElementById('vtm-hud-project-name').textContent = `SHIP: ${info.name.toUpperCase()}`;
  };

  refreshHUD();
  chrome.storage.onChanged.addListener(refreshHUD);
  let sec = 0;
  setInterval(() => {
    sec++;
    document.getElementById('vtm-hud-timer').textContent =
      `${Math.floor(sec/60).toString().padStart(2,'0')}:${(sec%60).toString().padStart(2,'0')}`;
  }, 1000);
})();
