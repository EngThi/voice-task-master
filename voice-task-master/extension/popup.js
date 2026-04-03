const STORAGE_KEY = "vtm_tasks_v1";
const CONTEXT_KEY = "vtm_active_context";

const el = (id) => document.getElementById(id);
const tasksEl = el("tasks");
const hintEl = el("hint");
const countEl = el("count");
const taskText = el("taskText");
const btnVoice = el("btnVoice");

let activeProject = null; // {id, name}
let currentFilter = "all";

async function loadTasks() {
  const data = await chrome.storage.local.get([STORAGE_KEY]);
  return data[STORAGE_KEY] || [];
}

async function saveTasks(tasks) {
  await chrome.storage.local.set({ [STORAGE_KEY]: tasks });
}

async function checkContext() {
  const data = await chrome.storage.local.get([CONTEXT_KEY]);
  activeProject = data[CONTEXT_KEY] || null;
  
  if (activeProject) {
    el('hint').textContent = `Linking to: ${activeProject.name}`;
    el('hint').style.color = "#ffcc00";
  }
}

function render(tasks) {
  tasksEl.innerHTML = "";
  
  const filtered = currentFilter === "all" 
    ? tasks 
    : tasks.filter(t => t.projectId === activeProject?.id);

  countEl.textContent = `${filtered.filter(t => !t.done).length}/${filtered.length} in view`;

  filtered.forEach(t => {
    const wrap = document.createElement("div");
    wrap.className = `task ${t.done ? "done" : ""} p-${t.priority}`;
    
    const html = `
      <input type="checkbox" ${t.done ? "checked" : ""}>
      <div class="main">
        <div class="text">${t.text}</div>
        <div class="meta">${t.group || 'General'} • ${t.projectId ? '#' + t.projectId : 'No Ship'}</div>
      </div>
      <button class="del">&times;</button>
    `;
    wrap.innerHTML = html;

    wrap.querySelector('input').onchange = async (e) => {
      const all = await loadTasks();
      const idx = all.findIndex(x => x.id === t.id);
      all[idx].done = e.target.checked;
      await saveTasks(all);
      render(all);
    };

    wrap.querySelector('.del').onclick = async () => {
      const all = await loadTasks();
      await saveTasks(all.filter(x => x.id !== t.id));
      render(await loadTasks());
    };

    tasksEl.appendChild(wrap);
  });
}

async function addTask(text, priority = "backlog", group = "Task") {
  let clean = (text || "").trim();
  if (!clean) return;

  // Auto-grouping based on keywords
  if (clean.toLowerCase().includes("fix") || clean.toLowerCase().includes("bug")) group = "Bugfix";
  if (clean.toLowerCase().includes("ui") || clean.toLowerCase().includes("css")) group = "Frontend";
  if (clean.toLowerCase().includes("devlog") || clean.toLowerCase().includes("ship")) group = "Ship Log";

  const tasks = await loadTasks();
  tasks.unshift({
    id: Math.random().toString(16).slice(2),
    text: clean,
    priority: clean.toLowerCase().includes("critical") ? "critical" : priority,
    group: group,
    projectId: activeProject ? activeProject.id : null,
    done: false,
    createdAt: Date.now()
  });

  await saveTasks(tasks);
  render(tasks);
  taskText.value = "";
  
  // Feedback
  taskText.classList.add("flash");
  setTimeout(() => taskText.classList.remove("flash"), 400);
}

/* Voice Implementation */
let recognition = null;
async function toggleVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  
  if (recognition) { recognition.stop(); recognition = null; btnVoice.classList.remove("recording"); return; }

  recognition = new SR();
  recognition.lang = "en-US";
  btnVoice.classList.add("recording");

  recognition.onresult = (ev) => {
    const spoken = ev.results[0][0].transcript;
    addTask(spoken);
    toggleVoice();
  };
  recognition.start();
}

/* Wiring */
el('btnAdd').onclick = () => addTask(taskText.value);
el('btnVoice').onclick = toggleVoice;
el('btnClearDone').onclick = async () => {
  const all = await loadTasks();
  await saveTasks(all.filter(t => !t.done));
  render(await loadTasks());
};

taskText.onkeydown = (e) => { if(e.key === "Enter") addTask(taskText.value); };

// Initialization
(async function init() {
  await checkContext();
  render(await loadTasks());
  taskText.focus();
})();
