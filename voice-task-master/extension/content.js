/* VTM v1.2 - Chef's Companion Content Script */
(function() {
  const STORAGE_KEY = "vtm_tasks_v1";
  const CONTEXT_KEY = "vtm_active_context";

  // HUD UI Creation
  const badge = document.createElement('div');
  badge.id = 'vtm-ship-hud';
  badge.innerHTML = `
    <div id="vtm-hud-header">
      <span id="vtm-hud-title">VTM // SHIP MODE</span>
      <span id="vtm-hud-timer">00:00</span>
    </div>
    <div id="vtm-hud-project-name">Detecting...</div>
    <div id="vtm-hud-tasks"></div>
    <div id="vtm-hud-footer">Ready to Ship</div>
  `;
  
  Object.assign(badge.style, {
    position: 'fixed', bottom: '20px', right: '20px', zIndex: '2147483647',
    backgroundColor: 'rgba(5, 7, 10, 0.9)', border: '1px solid #00ff9d',
    color: '#00ff9d', padding: '12px', fontFamily: 'monospace', width: '260px',
    borderRadius: '2px', boxShadow: '0 0 20px rgba(0, 255, 157, 0.2)',
    backdropFilter: 'blur(8px)', fontSize: '11px'
  });

  document.body.appendChild(badge);

  // Injected Styles for HUD
  const style = document.createElement('style');
  style.textContent = `
    #vtm-hud-header { display: flex; justify-content: space-between; border-bottom: 1px solid #00ff9d33; padding-bottom: 5px; margin-bottom: 8px; font-weight: bold; }
    #vtm-hud-project-name { color: #ffcc00; font-size: 10px; margin-bottom: 10px; text-transform: uppercase; }
    .vtm-hud-task { margin-bottom: 5px; padding-left: 8px; border-left: 2px solid #00ff9d; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .vtm-hud-task.critical { border-left-color: #ff003c; animation: vtm-pulse 2s infinite; }
    @keyframes vtm-pulse { 0% { opacity: 1; } 50% { opacity: 0.6; } 100% { opacity: 1; } }
  `;
  document.head.appendChild(style);

  const getProjectInfo = () => {
    if (window.location.href.includes('/projects/')) {
      const id = window.location.pathname.split('/').pop();
      const name = document.querySelector('h1')?.textContent?.trim() || "Project " + id;
      return { id, name };
    }
    return null;
  };

  const updateContext = async () => {
    const info = getProjectInfo();
    if (info) {
      await chrome.storage.local.set({ [CONTEXT_KEY]: info });
      const nameEl = document.getElementById('vtm-hud-project-name');
      if (nameEl) nameEl.textContent = `SHIP: ${info.name}`;
    }
  };

  const refreshHUD = async () => {
    const data = await chrome.storage.local.get([STORAGE_KEY]);
    const info = getProjectInfo();
    const tasks = data[STORAGE_KEY] || [];
    
    const container = document.getElementById('vtm-hud-tasks');
    if (!container) return;

    const filtered = info 
      ? tasks.filter(t => !t.done && t.projectId === info.id)
      : tasks.filter(t => !t.done).slice(0, 5);

    container.innerHTML = filtered.length 
      ? filtered.map(t => `<div class="vtm-hud-task ${t.priority}">${t.text}</div>`).join('')
      : '<div style="opacity:0.5">No tasks for this grid.</div>';
  };

  // Listeners
  updateContext();
  refreshHUD();
  chrome.storage.onChanged.addListener((changes) => {
    if (changes[STORAGE_KEY]) refreshHUD();
  });

  // Timer
  let sec = 0;
  setInterval(() => {
    sec++;
    const m = Math.floor(sec/60).toString().padStart(2,'0');
    const s = (sec%60).toString().padStart(2,'0');
    document.getElementById('vtm-hud-timer').textContent = `${m}:${s}`;
  }, 1000);

})();
