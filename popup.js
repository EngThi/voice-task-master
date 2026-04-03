const STORAGE_KEY = "vtm_tasks_v1";
const CONTEXT_KEY = "vtm_active_context";

const el = (id) => document.getElementById(id);
const tasksEl = el("tasks");
const hintEl = el("hint");
const countEl = el("count");
const taskText = el("taskText");
const btnVoice = el("btnVoice");

let activeProject = null;
let currentFilter = "all";

/* --- DATA LAYER --- */
async function loadTasks() { const data = await chrome.storage.local.get([STORAGE_KEY]); return data[STORAGE_KEY] || []; }
async function saveTasks(tasks) { await chrome.storage.local.set({ [STORAGE_KEY]: tasks }); }

async function checkContext() {
  const data = await chrome.storage.local.get([CONTEXT_KEY]);
  activeProject = data[CONTEXT_KEY] || null;
  if (activeProject) { 
    setHint(`Uplink: ${activeProject.name.substring(0,15)}...`);
    const tagBtn = document.querySelector('[data-tag="project"]');
    if (tagBtn) { tagBtn.textContent = `#${activeProject.id.toUpperCase()}`; tagBtn.style.display = "block"; }
  }
}

/* --- UI ENGINE --- */
function setHint(msg) {
  hintEl.textContent = msg || "";
  hintEl.style.color = activeProject ? "#ffcc00" : "#00ff9d";
  setTimeout(() => { if(hintEl.textContent === msg) hintEl.textContent = "System Ready."; }, 4000);
}

function render(tasks) {
  tasksEl.innerHTML = "";
  const filtered = currentFilter === "all" ? tasks : 
                   currentFilter === "project" ? tasks.filter(t => t.projectId === activeProject?.id) :
                   tasks.filter(t => t.text.toLowerCase().includes(`#${currentFilter}`));

  countEl.textContent = `${filtered.filter(t => !t.done).length} active missions`;

  filtered.forEach(t => {
    const wrap = document.createElement("div");
    wrap.className = `task ${t.done ? "done" : ""} p-${t.priority}`;
    wrap.draggable = true;
    wrap.dataset.id = t.id;

    // Drag Events
    wrap.addEventListener("dragstart", () => wrap.classList.add("dragging"));
    wrap.addEventListener("dragend", () => wrap.classList.remove("dragging"));

    wrap.innerHTML = `
      <input type="checkbox" ${t.done ? "checked" : ""}>
      <div class="main">
        <div class="text">${t.text.replace(activeProject ? `#${activeProject.id}` : '', '').trim()}</div>
        <div class="meta">${t.group} • ${t.projectId ? '#' + t.projectId : 'Global'}</div>
      </div>
      <button class="del">&times;</button>
    `;

    wrap.querySelector('input').onchange = async (e) => {
      const all = await loadTasks();
      const idx = all.findIndex(x => x.id === t.id);
      all[idx].done = e.target.checked;
      await saveTasks(all); render(all);
    };

    wrap.querySelector('.del').onclick = async () => {
      const all = await loadTasks();
      await saveTasks(all.filter(x => x.id !== t.id)); render(await loadTasks());
    };

    tasksEl.appendChild(wrap);
  });
}

/* --- MISSION CONTROL --- */
async function celebrateShip() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) chrome.tabs.sendMessage(tab.id, { type: "CELEBRATE_SHIP" });
  const all = await loadTasks();
  const remaining = all.filter(t => !t.done);
  await saveTasks(remaining);
  render(remaining);
  speak("Ship confirmed. Great work, Chef.");
}

async function generateShipLog() {
  const all = await loadTasks();
  const done = all.filter(t => t.done && (!activeProject || t.projectId === activeProject.id));
  if (done.length === 0) { setHint("No completed tasks found."); return; }
  
  const groups = {};
  done.forEach(t => { groups[t.group] = groups[t.group] || []; groups[t.group].push(t.text); });
  
  let md = `# Ship Log: ${activeProject?.name || 'VTM Session'}\n\n`;
  for (let g in groups) { md += `### ${g}\n- ${groups[g].join('\n- ')}\n\n`; }
  
  await navigator.clipboard.writeText(md);
  setHint("Ship Log copied to clipboard!");
}

function speak(txt) {
  const u = new SpeechSynthesisUtterance(txt);
  u.lang = "en-US"; window.speechSynthesis.speak(u);
}

/* --- CORE ACTIONS --- */
async function addTask(text) {
  let clean = (text || "").trim(); if (!clean) return;
  if (clean.toLowerCase() === "ship it") { celebrateShip(); return; }
  if (clean.toLowerCase().includes("generate log")) { generateShipLog(); return; }

  let group = "Task";
  if (clean.toLowerCase().match(/fix|bug/i)) group = "Bugfix";
  else if (clean.toLowerCase().match(/ui|css|style/i)) group = "UI/UX";
  else if (clean.toLowerCase().match(/devlog|ship/i)) group = "Ship Log";

  const tasks = await loadTasks();
  tasks.unshift({
    id: Math.random().toString(16).slice(2),
    text: activeProject ? `${clean} #${activeProject.id}` : clean,
    priority: clean.toLowerCase().includes("critical") ? "critical" : "backlog",
    group: group,
    projectId: activeProject ? activeProject.id : null,
    done: false,
    createdAt: Date.now()
  });
  await saveTasks(tasks); render(tasks); taskText.value = "";
  taskText.classList.add("flash"); setTimeout(() => taskText.classList.remove("flash"), 400);
}

/* --- DRAG & DROP LOGIC --- */
tasksEl.addEventListener("dragover", (e) => {
  e.preventDefault();
  const dragging = document.querySelector(".dragging");
  const afterElement = getDragAfterElement(tasksEl, e.clientY);
  if (afterElement == null) tasksEl.appendChild(dragging);
  else tasksEl.insertBefore(dragging, afterElement);
});

tasksEl.addEventListener("drop", async () => {
  const newOrderIds = [...document.querySelectorAll(".task")].map(t => t.dataset.id);
  const all = await loadTasks();
  const reordered = newOrderIds.map(id => all.find(t => t.id === id));
  await saveTasks(reordered);
});

function getDragAfterElement(container, y) {
  const elements = [...container.querySelectorAll(".task:not(.dragging)")];
  return elements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
    else return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/* --- VOICE & HOTKEYS --- */
let recognition = null;
async function toggleVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  if (recognition) { recognition.stop(); recognition = null; btnVoice.classList.remove("recording"); return; }
  recognition = new SR(); recognition.lang = "en-US"; btnVoice.classList.add("recording");
  recognition.onresult = (ev) => { addTask(ev.results[0][0].transcript); toggleVoice(); };
  recognition.start();
}

window.setFilter = (f) => {
  currentFilter = f;
  document.querySelectorAll('.tag-btn').forEach(b => b.classList.toggle('active', b.dataset.tag === f));
  loadTasks().then(render);
};

/* --- WIRING --- */
el('btnAdd').onclick = () => addTask(taskText.value);
el('btnVoice').onclick = toggleVoice;
el('btnClearDone').onclick = async () => { const all = await loadTasks(); await saveTasks(all.filter(t => !t.done)); render(await loadTasks()); };
taskText.onkeydown = (e) => { if(e.key === "Enter") addTask(taskText.value); };

// Wow Factor: Hotkey Ctrl+Shift+V for Voice
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'v') { toggleVoice(); }
});

(async function init() { await checkContext(); render(await loadTasks()); taskText.focus(); })();
