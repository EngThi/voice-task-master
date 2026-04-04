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
  if (activeProject && activeProject.name) {
    setHint(`Uplink: ${activeProject.name.substring(0,15)}`);
    const tagBtn = document.querySelector('[data-tag="project"]');
    if (tagBtn) {
      const label = activeProject.id ? `#${activeProject.id.toUpperCase()}` : "#Kitchen";
      tagBtn.textContent = label;
      tagBtn.style.display = "block";
    }
  }
}

/* --- UI ENGINE --- */
function setHint(msg) {
  hintEl.textContent = msg || "";
  hintEl.style.color = activeProject ? "#ffcc00" : "#00ff9d";
  setTimeout(() => { if (hintEl.textContent === msg) hintEl.textContent = "System Ready."; }, 4000);
}

const GROUP_LABELS = {
  Bugfix: "🐛 Bugfix",
  "UI/UX": "🎨 UI/UX",
  "Ship Log": "🚀 Ship Log",
  Task: "📋 Task",
};

const PRIORITY_LABELS = {
  critical: "🔴 CRITICAL",
  backlog: "⬜ Backlog",
};

function render(tasks) {
  tasksEl.innerHTML = "";
  const filtered =
    currentFilter === "all" ? tasks :
    currentFilter === "project" ? tasks.filter(t => t.projectId === activeProject?.id) :
    tasks.filter(t => t.text.toLowerCase().includes(`#${currentFilter}`));

  const active = filtered.filter(t => !t.done).length;
  countEl.textContent = `${active} active missions`;

  filtered.forEach(t => {
    const wrap = document.createElement("div");
    wrap.className = `task ${t.done ? "done" : ""} p-${t.priority}`;
    wrap.draggable = true;
    wrap.dataset.id = t.id;

    wrap.addEventListener("dragstart", () => wrap.classList.add("dragging"));
    wrap.addEventListener("dragend", () => wrap.classList.remove("dragging"));

    const groupLabel = GROUP_LABELS[t.group] || t.group || "📋 Task";
    const priorityLabel = PRIORITY_LABELS[t.priority] || t.priority || "⬜ Backlog";
    const displayText = (activeProject && activeProject.id)
      ? t.text.replace(`#${activeProject.id}`, "").trim()
      : t.text;

    wrap.innerHTML = `
      <input type="checkbox" ${t.done ? "checked" : ""}>
      <div class="main">
        <div class="text">${displayText}</div>
        <div class="meta">
          <span class="group-tag">${groupLabel}</span>
          <span class="priority-tag">${priorityLabel}</span>
          <span class="project-tag">${t.projectId ? "#" + t.projectId : "Global"}</span>
        </div>
      </div>
      <button class="del">&times;</button>
    `;

    wrap.querySelector("input").onchange = async (e) => {
      const all = await loadTasks();
      const idx = all.findIndex(x => x.id === t.id);
      if (idx !== -1) all[idx].done = e.target.checked;
      await saveTasks(all); render(all);
    };

    wrap.querySelector(".del").onclick = async () => {
      const all = await loadTasks();
      await saveTasks(all.filter(x => x.id !== t.id));
      render(await loadTasks());
    };

    tasksEl.appendChild(wrap);
  });
}

/* --- MISSION CONTROL --- */
async function celebrateShip() {
  // Guard against connection error when tab has no content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.id) return;
    chrome.tabs.sendMessage(tabs[0].id, { type: "CELEBRATE_SHIP" }, () => {
      if (chrome.runtime.lastError) {
        // Tab doesn't have content script — ignore silently
      }
    });
  });
  const all = await loadTasks();
  const remaining = all.filter(t => !t.done);
  await saveTasks(remaining);
  render(remaining);
  speak("Ship confirmed. Great work, Chef.");
}

async function generateShipLog() {
  const all = await loadTasks();
  const done = all.filter(t => t.done && (!activeProject || !activeProject.id || t.projectId === activeProject.id));
  if (done.length === 0) { setHint("No completed tasks found."); return; }

  const groups = {};
  done.forEach(t => { groups[t.group] = groups[t.group] || []; groups[t.group].push(t.text); });

  let md = `# Ship Log: ${activeProject?.name || "VTM Session"}\n\n`;
  for (const g in groups) { md += `### ${g}\n- ${groups[g].join("\n- ")}\n\n`; }

  await navigator.clipboard.writeText(md);
  setHint("Ship Log copied to clipboard!");
}

function speak(txt) {
  const u = new SpeechSynthesisUtterance(txt);
  u.lang = "en-US";
  window.speechSynthesis.speak(u);
}

/* --- CORE ACTIONS --- */
async function addTask(text) {
  const clean = (text || "").trim();
  if (!clean) return;
  if (clean.toLowerCase() === "ship it") { celebrateShip(); return; }
  if (clean.toLowerCase().includes("generate log")) { generateShipLog(); return; }

  let group = "Task";
  if (/fix|bug/i.test(clean)) group = "Bugfix";
  else if (/ui|css|style/i.test(clean)) group = "UI/UX";
  else if (/devlog|ship/i.test(clean)) group = "Ship Log";

  const priority = /critical/i.test(clean) ? "critical" : "backlog";

  const tasks = await loadTasks();
  tasks.unshift({
    id: Math.random().toString(16).slice(2),
    text: (activeProject && activeProject.id) ? `${clean} #${activeProject.id}` : clean,
    priority,
    group,
    projectId: (activeProject && activeProject.id) ? activeProject.id : null,
    done: false,
    createdAt: Date.now(),
  });
  await saveTasks(tasks);
  render(tasks);
  taskText.value = "";
  taskText.classList.add("flash");
  setTimeout(() => taskText.classList.remove("flash"), 400);
}

/* --- DRAG & DROP --- */
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
  const reordered = newOrderIds.map(id => all.find(t => t.id === id)).filter(Boolean);
  await saveTasks(reordered);
});

function getDragAfterElement(container, y) {
  const elements = [...container.querySelectorAll(".task:not(.dragging)")];
  return elements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/* --- VOICE --- */
let recognition = null;
async function toggleVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { setHint("Voice not supported in this browser."); return; }
  if (recognition) {
    recognition.stop();
    recognition = null;
    btnVoice.classList.remove("recording");
    return;
  }
  recognition = new SR();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  btnVoice.classList.add("recording");
  recognition.onresult = (ev) => { addTask(ev.results[0][0].transcript); toggleVoice(); };
  recognition.onerror = (ev) => { setHint(`Voice error: ${ev.error}`); toggleVoice(); };
  recognition.onend = () => { if (recognition) toggleVoice(); };
  recognition.start();
}

/* --- FILTER --- */
window.setFilter = (f) => {
  currentFilter = f;
  document.querySelectorAll(".tag-btn").forEach(b => b.classList.toggle("active", b.dataset.tag === f));
  loadTasks().then(render);
};

document.getElementById("filterBar").addEventListener("click", (e) => {
  const btn = e.target.closest(".tag-btn");
  if (btn) window.setFilter(btn.dataset.tag);
});

/* --- WIRING --- */
el("btnAdd").addEventListener("click", () => addTask(taskText.value));
el("btnVoice").addEventListener("click", toggleVoice);
el("btnClearDone").addEventListener("click", async () => {
  const all = await loadTasks();
  await saveTasks(all.filter(t => !t.done));
  render(await loadTasks());
});
el("btnStandup").addEventListener("click", generateShipLog);
el("btnExport").addEventListener("click", async () => {
  const all = await loadTasks();
  const json = JSON.stringify(all, null, 2);
  await navigator.clipboard.writeText(json);
  setHint("Tasks exported to clipboard (JSON).");
});

taskText.addEventListener("keydown", (e) => { if (e.key === "Enter") addTask(taskText.value); });

window.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "v") toggleVoice();
  if (e.ctrlKey && e.key.toLowerCase() === "k") { e.preventDefault(); taskText.focus(); }
});

(async function init() { await checkContext(); render(await loadTasks()); taskText.focus(); })();
