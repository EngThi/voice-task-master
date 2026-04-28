/* VTM v1.5.7 - THE FINAL SHIP (Emergency Fix) */
(function() {
  const STORAGE_KEY = "vtm_tasks_v1";
  const CONTEXT_KEY = "vtm_active_context";

  function detectProjectContext() {
    const match = window.location.pathname.match(/\/projects\/([^\/]+)/);
    let newContext = null;
    if (match) {
      const slug = match[1];
      const nameEl = document.querySelector(".project-show-card__title-text");
      const name = nameEl ? nameEl.textContent.trim() : slug;
      newContext = { id: slug, slug, name, url: location.href };
    } else {
      newContext = { id: null, slug: null, name: "Kitchen", url: location.href };
    }
    chrome.storage.local.set({ [CONTEXT_KEY]: newContext });
  }

  detectProjectContext();
  document.addEventListener("turbo:load", detectProjectContext);

  /* --- UI INJECTION --- */
  const badge = document.createElement('div');
  badge.id = 'vtm-ship-hud';
  badge.innerHTML = `
    <div id="vtm-hud-main">
      <div id="vtm-hud-header">
        <span id="vtm-hud-title">VTM // NEURAL UPLINK</span>
      </div>
      <div id="vtm-hud-project-name">Waiting...</div>
      <div id="vtm-hud-tasks"></div>
    </div>
  `;
  document.body.appendChild(badge);

  const style = document.createElement('style');
  style.textContent = `
    #vtm-ship-hud {
      position: fixed !important; top: 15% !important; left: 50% !important;
      transform: translateX(-50%) translateY(-30px) !important; z-index: 2147483647 !important;
      background-color: #0a0a0a !important; border: 1px solid #10B981 !important;
      color: #ffffff !important; padding: 20px !important; width: 450px !important;
      border-radius: 16px !important; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8) !important;
      backdrop-filter: blur(20px) !important; opacity: 0 !important;
      pointer-events: none !important; transition: all 0.3s ease !important;
    }
    #vtm-ship-hud.vtm-active { opacity: 1 !important; transform: translateX(-50%) translateY(0) !important; pointer-events: auto !important; }
    #vtm-hud-header { border-bottom: 1px solid #262626; padding-bottom: 10px; margin-bottom: 10px; }
    #vtm-hud-title { color: #10B981; font-weight: 800; font-size: 11px; text-transform: uppercase; }
    #vtm-hud-project-name { color: #ffffff; font-size: 16px; font-weight: 600; min-height: 24px; }
    .vtm-hud-task { margin-top: 8px; padding: 8px 12px; background: rgba(255,255,255,0.03); border-radius: 6px; border-left: 3px solid #10B981; font-size: 13px; }
  `;
  document.head.appendChild(style);

  /* --- VOICE ENGINE --- */
  let recognition = null;

  async function startVoice() {
    console.log("VTM: Uplink starting...");
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (recognition) { try { recognition.stop(); } catch(e) {} recognition = null; return; }

    recognition = new SR();
    recognition.lang = VTM_I18N.voiceLang;
    recognition.interimResults = true;

    const hud = document.getElementById('vtm-ship-hud');
    const projectNameEl = document.getElementById('vtm-hud-project-name');

    recognition.onstart = () => {
      hud.classList.add('vtm-active');
      projectNameEl.textContent = "Listening...";
    };

    recognition.onresult = async (ev) => {
      let interim = ""; let final = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) final += ev.results[i][0].transcript;
        else interim += ev.results[i][0].transcript;
      }
      if (interim) { projectNameEl.textContent = interim; projectNameEl.style.color = "#F567D7"; }
      if (final) {
        const data = await chrome.storage.local.get([STORAGE_KEY, CONTEXT_KEY]);
        const tasks = data[STORAGE_KEY] || [];
        const info = data[CONTEXT_KEY];
        tasks.unshift({
          id: Math.random().toString(16).slice(2),
          text: info?.id ? `${final} #${info.id}` : final,
          priority: final.toLowerCase().includes("critical") ? "critical" : "backlog",
          group: "Voice",
          projectId: info?.id || null, done: false, createdAt: Date.now()
        });
        await chrome.storage.local.set({ [STORAGE_KEY]: tasks });
        projectNameEl.textContent = "Order Placed!";
        projectNameEl.style.color = "#10B981";
        setTimeout(() => { hud.classList.remove('vtm-active'); recognition = null; }, 1200);
      }
    };

    recognition.onerror = (e) => {
      console.error("VTM Error:", e.error);
      projectNameEl.textContent = "Error: " + e.error;
      setTimeout(() => { hud.classList.remove('vtm-active'); recognition = null; }, 2000);
    };

    recognition.onend = () => { recognition = null; };
    recognition.start();
  }

  /* --- REDUNDANT LISTENERS --- */
  window.addEventListener('keydown', (e) => {
    const isV = e.key.toLowerCase() === 'v';
    if (e.altKey && e.shiftKey && isV) {
      e.preventDefault();
      startVoice();
    }
    if (e.ctrlKey && e.shiftKey && isV) {
      e.preventDefault();
      startVoice();
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "ACTIVATE_VOICE") startVoice();
  });
})();
