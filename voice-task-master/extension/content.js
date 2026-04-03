/* VTM Ship Mode - Universal Project Bridge */
(function() {
  const STORAGE_KEY = "vtm_tasks_v1";

  const badge = document.createElement('div');
  badge.id = 'vtm-ship-hud';
  badge.innerHTML = `
    <div style="font-weight:bold; border-bottom:1px solid #00ff9d; margin-bottom:8px; padding-bottom:4px; display:flex; justify-content:space-between;">
      <span>VTM // SHIP MODE</span>
      <span id="vtm-timer-display" style="color:#fff">00:00</span>
    </div>
    <div id="vtm-project-info" style="font-size:10px; color:#ffcc00; margin-bottom:8px; font-style:italic;">Detecting context...</div>
    <div id="vtm-task-overlay" style="max-height: 200px; overflow-y: auto; font-size: 10px;"></div>
  `;
  
  Object.assign(badge.style, {
    position: 'fixed', bottom: '30px', right: '30px', zIndex: '2147483647',
    backgroundColor: 'rgba(10, 14, 20, 0.95)', border: '1px solid #00ff9d',
    color: '#00ff9d', padding: '15px', fontFamily: 'monospace', width: '240px',
    borderRadius: '4px', boxShadow: '0 0 25px rgba(0, 255, 157, 0.3)',
    backdropFilter: 'blur(4px)'
  });

  document.body.appendChild(badge);

  const getProjectTag = () => {
    if (window.location.href.includes('/projects/')) {
      return window.location.pathname.split('/').pop();
    }
    return null;
  };

  const refreshHUD = async () => {
    const data = await chrome.storage.local.get([STORAGE_KEY]);
    const tasks = data[STORAGE_KEY] || [];
    const currentTag = getProjectTag();
    
    // Mostra apenas tarefas do projeto atual se estiver em uma página de projeto
    const filtered = currentTag 
      ? tasks.filter(t => !t.done && t.text.toLowerCase().includes(`#${currentTag}`))
      : tasks.filter(t => !t.done).slice(0, 5);

    const taskOverlay = document.getElementById('vtm-task-overlay');
    if (!taskOverlay) return;

    if (filtered.length === 0) {
      taskOverlay.innerHTML = `<div style="opacity:0.5; color:#4ecca3">${currentTag ? 'No tasks for this ship.' : 'System idle.'}</div>`;
    } else {
      taskOverlay.innerHTML = filtered.map(t => `
        <div style="margin-bottom:6px; padding-left:8px; border-left:2px solid ${t.priority === 'critical' ? '#ff003c' : '#00ff9d'}">
          ${t.text.replace(`#${currentTag}`, '').trim()}
        </div>
      `).join('');
    }

    const projectTitle = document.querySelector('h1')?.textContent?.trim() || "Dashboard";
    const infoEl = document.getElementById('vtm-project-info');
    if (infoEl) infoEl.textContent = currentTag ? `SHIP: ${projectTitle.substring(0, 15)}...` : "GLOBAL BACKLOG";
  };

  refreshHUD();
  chrome.storage.onChanged.addListener((changes) => { if (changes[STORAGE_KEY]) refreshHUD(); });

  let seconds = 0;
  setInterval(() => {
    seconds++;
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    const timerEl = document.getElementById('vtm-timer-display');
    if (timerEl) timerEl.textContent = `${m}:${s}`;
  }, 1000);
})();
