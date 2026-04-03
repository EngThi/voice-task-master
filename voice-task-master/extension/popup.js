const STORAGE_KEY = "vtm_tasks_v1";
const BACKUP_KEY = "vtm_backup_v1";

const el = (id) => document.getElementById(id);
const tasksEl = el("tasks");
const hintEl = el("hint");
const countEl = el("count");
const taskText = el("taskText");
const taskDue = el("taskDue");
const btnAdd = el("btnAdd");
const btnVoice = el("btnVoice");
const btnClearDone = el("btnClearDone");
const btnExport = el("btnExport");
const btnStandup = el("btnStandup");

let currentFilter = "all";

async function loadTasks() {
  const data = await chrome.storage.local.get([STORAGE_KEY]);
  return data[STORAGE_KEY] || [];
}

async function saveTasks(tasks) {
  await chrome.storage.local.set({ [STORAGE_KEY]: tasks });
  const snap = { ts: Date.now(), data: tasks.slice(0, 5) };
  await chrome.storage.local.set({ [BACKUP_KEY]: snap });
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

let hintTimer = null;
function setHint(msg) {
  hintEl.textContent = msg || "";
  clearTimeout(hintTimer);
  if (msg) hintTimer = setTimeout(() => hintEl.textContent = "", 3000);
}

function render(tasks) {
  tasksEl.innerHTML = "";
  const filtered = currentFilter === "all" ? tasks : tasks.filter(t => t.text.toLowerCase().includes(`#${currentFilter}`));
  countEl.textContent = `${filtered.filter(t => !t.done).length}/${filtered.length} open`;

  filtered.forEach((t) => {
    const wrap = document.createElement("div");
    wrap.className = `task ${t.done ? "done" : ""} p-${t.priority || "backlog"}`;
    wrap.draggable = true;
    wrap.dataset.id = t.id;

    wrap.addEventListener("dragstart", () => wrap.classList.add("dragging"));
    wrap.addEventListener("dragend", () => wrap.classList.remove("dragging"));

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!t.done;
    cb.addEventListener("change", async () => {
      const all = await loadTasks();
      const idx = all.findIndex(x => x.id === t.id);
      if (idx >= 0) {
        all[idx].done = cb.checked;
        await saveTasks(all);
        render(all);
      }
    });

    const main = document.createElement("div");
    main.className = "main";
    const text = document.createElement("div");
    text.className = "text";
    text.textContent = t.text;
    
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = t.due ? `Due: ${t.due}` : "No due date";

    main.appendChild(text);
    main.appendChild(meta);

    const del = document.createElement("button");
    del.className = "del";
    del.innerHTML = "&times;";
    del.onclick = async () => {
      const all = await loadTasks();
      await saveTasks(all.filter(x => x.id !== t.id));
      render(await loadTasks());
    };

    wrap.appendChild(cb);
    wrap.appendChild(main);
    wrap.appendChild(del);
    tasksEl.appendChild(wrap);
  });
}

// Drag & Drop Logic
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

async function addTask(text, due, priority = "backlog") {
  const clean = (text || "").trim();
  if (!clean) {
    setHint("⚠️ Type something first.");
    taskText.classList.add("flash");
    setTimeout(() => taskText.classList.remove("flash"), 400);
    return;
  }

  if (clean.toLowerCase().includes("critical") || clean.toLowerCase().includes("urgent")) priority = "critical";
  else if (clean.toLowerCase().includes("ship") || clean.toLowerCase().includes("launch")) priority = "ship";

  const tasks = await loadTasks();
  tasks.unshift({ id: uid(), text: clean, due: due || "", priority, done: false, createdAt: Date.now() });
  await saveTasks(tasks);
  render(await loadTasks());
  taskText.value = "";
  setHint("Data Injected.");
  taskText.classList.add("flash");
  setTimeout(() => taskText.classList.remove("flash"), 400);
}

// Control Functions
window.setFilter = (tag) => {
  currentFilter = tag;
  document.querySelectorAll('.tag-btn').forEach(b => b.classList.toggle('active', b.dataset.tag === tag));
  loadTasks().then(render);
};

window.toggleImport = () => {
  const area = el('importArea');
  const btn = el('btnDoImport');
  const display = area.style.display === 'none' ? 'block' : 'none';
  area.style.display = display;
  btn.style.display = display;
};

async function parseVoiceCommand(raw) {
  const t = (raw || "").trim().toLowerCase();
  if (t.includes("clear all") || t.includes("purge")) {
    await saveTasks([]);
    render([]);
    return { text: null };
  }
  const m = t.match(/^add\s+/i);
  const body = m ? t.replace(/^add\s+/i, "") : t;
  return { text: body };
}

/* Voice & Wiring */
let recognition = null;
let listening = false;

function getRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang = "en-US";
  return r;
}

async function toggleVoice() {
  if (listening) {
    listening = false;
    btnVoice.classList.remove("recording");
    btnVoice.textContent = "🎙️ Initialize Voice";
    recognition?.stop();
    return;
  }
  recognition = getRecognition();
  if (!recognition) return;
  listening = true;
  btnVoice.classList.add("recording");
  btnVoice.textContent = "🛑 Uplink Active...";

  recognition.onresult = async (ev) => {
    const spoken = ev?.results?.[0]?.[0]?.transcript || "";
    setHint(`Uplink: "${spoken}"`);
    const { text } = await parseVoiceCommand(spoken);
    if (text) addTask(text, "");
    btnVoice.classList.remove("recording");
    btnVoice.textContent = "🎙️ Initialize Voice";
    listening = false;
  };
  recognition.onerror = () => {
    listening = false;
    btnVoice.classList.remove("recording");
    btnVoice.textContent = "🎙️ Initialize Voice";
    window.open(window.location.href + "?auth=1");
  };
  recognition.start();
}

btnAdd.onclick = () => addTask(taskText.value, taskDue.value);
btnClearDone.onclick = async () => {
  const all = await loadTasks();
  await saveTasks(all.filter(t => !t.done));
  render(await loadTasks());
};
btnVoice.onclick = toggleVoice;
btnStandup.onclick = async () => {
  const tasks = await loadTasks();
  const open = tasks.filter(t => !t.done);
  const msg = `Grid Status: ${open.length} tasks open.`;
  setHint(msg);
  const u = new SpeechSynthesisUtterance(msg);
  u.lang = "en-US";
  speechSynthesis.speak(u);
};
taskText.onkeydown = (e) => { e.key === "Enter" && addTask(taskText.value, taskDue.value); };

el('btnDoImport').onclick = async () => {
  const lines = el('importArea').value.split('\n').filter(l => l.trim());
  for (const line of lines) await addTask(line, "");
  el('importArea').value = "";
  window.toggleImport();
};

(async function init() {
  render(await loadTasks());
  taskText.focus();
})();
