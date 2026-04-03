/* VTM Ship Mode - Real-time Synchronizer for Flavortown */
(function() {
  const STORAGE_KEY = "vtm_tasks_v1";

  const badge = document.createElement('div');
  badge.id = 'vtm-ship-hud';
  badge.innerHTML = `
    <div style="font-weight:bold; border-bottom:1px solid #00ff9d; margin-bottom:8px; padding-bottom:4px; display:flex; justify-content:space-between;">
      <span>VTM // SHIP MODE</span>
      <span id="vtm-timer-display" style="color:#fff">00:00</span>
    </div>
    <div id="vtm-project-info" style="font-size:10px; color:#ffcc00; margin-bottom:8px; font-style:italic;">Detecting project...</div>
    <div id="vtm-task-overlay" style="max-height: 200px; overflow-y: auto; font-size: 10px;">
      <div style="opacity:0.5">Syncing neural grid...</div>
    </div>
  `;
  
  Object.assign(badge.style, {
    position: 'fixed', bottom: '30px', right: '30px', zIndex: '2147483647',
    backgroundColor: 'rgba(10, 14, 20, 0.95)', border: '1px solid #00ff9d',
    color: '#00ff9d', padding: '15px', fontFamily: 'monospace', width: '220px',
    borderRadius: '4px', boxShadow: '0 0 25px rgba(0, 255, 157, 0.3)',
    backdropFilter: 'blur(4px)'
  });

  document.body.appendChild(badge);

  // Function to refresh tasks on the page
  const refreshHUD = async () => {
    const data = await chrome.storage.local.get([STORAGE_KEY]);
    const tasks = data[STORAGE_KEY] || [];
    const openTasks = tasks.filter(t => !t.done).slice(0, 5);
    
    const taskOverlay = document.getElementById('vtm-task-overlay');
    if (!taskOverlay) return;

    if (openTasks.length === 0) {
      taskOverlay.innerHTML = '<div style="opacity:0.5; color:#4ecca3">No active tasks in grid.</div>';
    } else {
      taskOverlay.innerHTML = openTasks.map(t => `
        <div style="margin-bottom:6px; padding-left:8px; border-left:2px solid ${t.priority === 'critical' ? '#ff003c' : '#00ff9d'}">
          ${t.text}
        </div>
      `).join('');
    }

    // Detect Project Title from Flavortown H1
    const projectTitle = document.querySelector('h1')?.textContent?.trim() || "Dashboard";
    const infoEl = document.getElementById('vtm-project-info');
    if (infoEl) infoEl.textContent = `TARGET: ${projectTitle.substring(0, 20)}...`;
  };

  // Initial load
  refreshHUD();

  // Listen for changes in the extension storage (Real-time Sync)
  chrome.storage.onChanged.addListener((changes) => {
    if (changes[STORAGE_KEY]) {
      refreshHUD();
    }
  });

  // Simple Session Timer
  let seconds = 0;
  setInterval(() => {
    seconds++;
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    const timerEl = document.getElementById('vtm-timer-display');
    if (timerEl) timerEl.textContent = `${m}:${s}`;
  }, 1000);

})();
