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
let isKitchenMode = false;

/* --- APPLY i18n --- */
function applyLocale() {
  taskText.placeholder = VTM_I18N.placeholder;
  btnVoice.textContent = VTM_I18N.btnVoice;
  el("btnAdd").textContent = VTM_I18N.btnAdd;
  el("btnStandup").textContent = VTM_I18N.btnStandup;
  el("btnExport").textContent = VTM_I18N.btnExport;
  el("btnClearDone").textContent = VTM_I18N.btnClearDone;
  hintEl.textContent = VTM_I18N.hintSync;
}

/* --- DATA LAYER --- */
async function loadTasks() {
  const data = await chrome.storage.local.get([STORAGE_KEY]);
  return data[STORAGE_KEY] || [];
}
async function saveTasks(tasks) {
  await chrome.storage.local.set({ [STORAGE_KEY]: tasks });
}

/* --- CONTEXT + KITCHEN MODE --- */
async function checkContext() {
  const data = await chrome.storage.local.get([CONTEXT_KEY]);
  activeProject = data[CONTEXT_KEY] || null;

  isKitchenMode = !activeProject || !activeProject.id;

  if (isKitchenMode) {
    // Kitchen: global overview mode
    el("headerTitle").textContent = VTM_I18N.kitchenTitle;
    el("headerSubtitle").textContent = VTM_I18N.kitchenSubtitle;
    el("vtm-header").classList.add("kitchen-mode");
    const tagBtn = document.querySelector('[data-tag="project"]');
    if (tagBtn) tagBtn.style.display = "none";
  } else {
    // Project mode
    el("headerTitle").textContent = `${VTM_I18N.projectTitle} v1.4.0`;
    el("headerSubtitle").textContent = `${activeProject.name.toUpperCase()} // ${VTM_I18N.projectSubtitle.split("//")[1].trim()}`;
    el("vtm-header").classList.remove("kitchen-mode");
    const tagBtn = document.querySelector('[data-tag="project"]');
    if (tagBtn) {
      tagBtn.textContent = `#${activeProject.id.toUpperCase()}`;
      tagBtn.style.display = "block";
    }
    setHint(`${VTM_I18N.hintUplink}: ${activeProject.name.substring(0, 18)}`);
  }
}

/* --- UI ENGINE --- */
function setHint(msg) {
  hintEl.textContent = msg || "";
  hintEl.style.color = isKitchenMode ? "#4ecca3" : (activeProject ? "#ffcc00" : "#00ff9d");
  setTimeout(() => { if (hintEl.textContent === msg) hintEl.textContent = VTM_I18N.hintReady; }, 4000);
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

  let filtered;
  if (currentFilter === "all") {
    filtered = isKitchenMode ? tasks : tasks.filter(t => t.projectId === activeProject?.id || !t.projectId);
  } else if (currentFilter === "project") {
    filtered = tasks.filter(t => t.projectId === activeProject?.id);
  } else {
    filtered = tasks.filter(t => t.text.toLowerCase().includes(`#${currentFilter}`));
  }

  const active = filtered.filter(t => !t.done).length;
  countEl.textContent = VTM_I18N.activeMissions(active);

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
      await saveTasks(all);
      render(all);
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
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.id) return;
    chrome.tabs.sendMessage(tabs[0].id, { type: "CELEBRATE_SHIP" }, () => {
      if (chrome.runtime.lastError) { /* tab sem content script — ok */ }
    });
  });
  const all = await loadTasks();
  const remaining = all.filter(t => !t.done);
  await saveTasks(remaining);
  render(remaining);
  speak(VTM_I18N.hintShip);
}

async function generateShipLog() {
  const all = await loadTasks();
  const done = all.filter(t => t.done && (!activeProject || !activeProject.id || t.projectId === activeProject.id));
  if (done.length === 0) { setHint(VTM_I18N.hintNoTasks); return; }

  const groups = {};
  done.forEach(t => { groups[t.group] = groups[t.group] || []; groups[t.group].push(t.text); });

  let md = VTM_I18N.shipLogHeader(activeProject?.name || "VTM Session");
  for (const g in groups) { md += `### ${g}\n- ${groups[g].join("\n- ")}\n\n`; }

  await navigator.clipboard.writeText(md);
  setHint(VTM_I18N.hintCopied);
}

function speak(txt) {
  const u = new SpeechSynthesisUtterance(txt);
  u.lang = VTM_I18N.voiceLang;
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

/* --- VOICE — fixed infinite loop --- */
let recognition = null;
let voiceActive = false;

async function toggleVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { setHint(VTM_I18N.hintNoVoice); return; }

  if (voiceActive) {
    recognition?.stop();
    recognition = null;
    voiceActive = false;
    btnVoice.classList.remove("recording");
    return;
  }

  recognition = new SR();
  recognition.lang = VTM_I18N.voiceLang;
  recognition.interimResults = false;
  recognition.continuous = false;
  voiceActive = true;
  btnVoice.classList.add("recording");

  recognition.onresult = (ev) => {
    addTask(ev.results[0][0].transcript);
    voiceActive = false;
    recognition = null;
    btnVoice.classList.remove("recording");
  };

  recognition.onerror = (ev) => {
    setHint(`${VTM_I18N.hintVoiceError}: ${ev.error}`);
    voiceActive = false;
    recognition = null;
    btnVoice.classList.remove("recording");
  };

  // Fixed: onend no longer calls toggleVoice() — prevents infinite loop
  recognition.onend = () => {
    if (voiceActive) {
      voiceActive = false;
      recognition = null;
      btnVoice.classList.remove("recording");
    }
  };

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
  setHint(VTM_I18N.hintExported);
});

taskText.addEventListener("keydown", (e) => { if (e.key === "Enter") addTask(taskText.value); });

window.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "v") toggleVoice();
  if (e.ctrlKey && e.key.toLowerCase() === "k") { e.preventDefault(); taskText.focus(); }
});

(async function init() {
  applyLocale();
  await checkContext();
  render(await loadTasks());
  taskText.focus();
})();
