const STORAGE_KEY = "vtm_tasks_v1";

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

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function loadTasks() {
  const data = await chrome.storage.local.get([STORAGE_KEY]);
  return data[STORAGE_KEY] || [];
}

async function saveTasks(tasks) {
  await chrome.storage.local.set({ [STORAGE_KEY]: tasks });
}

function setHint(msg) {
  hintEl.textContent = msg || "";
}

function render(tasks) {
  tasksEl.innerHTML = "";
  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;
  countEl.textContent = `${total - done}/${total} open`;

  if (tasks.length === 0) {
    tasksEl.innerHTML = `<div class="hint">No tasks yet. Try voice → “add buy milk”.</div>`;
    return;
  }

  for (const t of tasks) {
    const wrap = document.createElement("div");
    wrap.className = `task ${t.done ? "done" : ""}`;

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
    const due = t.due ? `Due: ${t.due}` : "No due date";
    meta.textContent = `${due} • Created: ${new Date(t.createdAt).toLocaleString()}`;

    main.appendChild(text);
    main.appendChild(meta);

    const del = document.createElement("button");
    del.className = "del";
    del.textContent = "×";
    del.title = "Delete task";
    del.addEventListener("click", async () => {
      const all = await loadTasks();
      const next = all.filter(x => x.id !== t.id);
      await saveTasks(next);
      render(next);
    });

    wrap.appendChild(cb);
    wrap.appendChild(main);
    wrap.appendChild(del);
    tasksEl.appendChild(wrap);
  }
}

async function addTask(text, due) {
  const clean = (text || "").trim();
  if (!clean) return;

  const tasks = await loadTasks();
  tasks.unshift({
    id: uid(),
    text: clean,
    due: due || "",
    done: false,
    createdAt: Date.now()
  });
  await saveTasks(tasks);
  render(tasks);

  taskText.value = "";
  taskDue.value = "";
  setHint("Added.");
}

async function clearDone() {
  const tasks = await loadTasks();
  const next = tasks.filter(t => !t.done);
  await saveTasks(next);
  render(next);
  setHint("Cleared done tasks.");
}

async function exportJSON() {
  const tasks = await loadTasks();
  const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "voice-task-master-tasks.json";
  a.click();

  URL.revokeObjectURL(url);
  setHint("Exported JSON.");
}

function makeStandup(tasks) {
  const iso = todayISO();
  const open = tasks.filter(t => !t.done);
  const dueToday = open.filter(t => t.due === iso);
  const overdue = open.filter(t => t.due && t.due < iso);

  const parts = [];
  parts.push(`You have ${open.length} open task${open.length === 1 ? "" : "s"}.`);
  if (dueToday.length) parts.push(`${dueToday.length} due today.`);
  if (overdue.length) parts.push(`${overdue.length} overdue.`);
  if (open.length) parts.push(`Next up: ${open[0].text}.`);
  return parts.join(" ");
}

function speak(text) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 1.02;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch (_) {}
}

/* Voice Recognition (Web Speech API) */
let recognition = null;
let listening = false;

function getRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang = "en-US";
  r.interimResults = false;
  r.maxAlternatives = 1;
  return r;
}

async function parseVoiceCommand(raw) {
  const t = (raw || "").trim().toLowerCase();
  
  if (t.includes("clear all") || t.includes("burn everything")) {
    await saveTasks([]);
    render([]);
    speak("System purged. All tasks destroyed.");
    setHint("System Purged 🔥");
    return { text: null };
  }

  if (t.startsWith("remove ") || t.startsWith("delete ")) {
    const term = t.replace(/^(remove|delete)\s+/i, "").trim();
    const all = await loadTasks();
    const next = all.filter(x => !x.text.toLowerCase().includes(term));
    await saveTasks(next);
    render(next);
    speak(`Task ${term} deleted from database.`);
    setHint(`Deleted: "${term}"`);
    return { text: null };
  }

  if (t.includes("status report") || t.includes("daily briefing")) {
    const tasks = await loadTasks();
    const briefing = makeStandup(tasks);
    speak(briefing);
    setHint("Reporting Status...");
    return { text: null };
  }

  const m = t.match(/^add\s+/i);
  const body = m ? t.replace(/^add\s+/i, "") : t;

  const dueMatch = body.match(/\bdue\s+(\d{4}-\d{2}-\d{2})\b/i);
  const due = dueMatch ? dueMatch[1] : "";
  const text = dueMatch ? body.replace(dueMatch[0], "").trim() : body.trim();

  return { text, due };
}

async function toggleVoice() {
  if (listening) {
    listening = false;
    btnVoice.classList.remove("recording");
    btnVoice.textContent = "🎙️ Initialize Voice";
    setHint("Input Disconnected.");
    try { recognition?.stop(); } catch (_) {}
    return;
  }

  recognition = getRecognition();
  if (!recognition) {
    setHint("Voice Engine offline.");
    return;
  }

  listening = true;
  btnVoice.classList.add("recording");
  btnVoice.textContent = "🛑 Uplink Active...";
  setHint("Try: 'add build the next unicorn'");

  recognition.onresult = async (ev) => {
    const spoken = ev?.results?.[0]?.[0]?.transcript || "";
    setHint(`Uplink: "${spoken}"`);
    const { text, due } = await parseVoiceCommand(spoken);
    if (text) {
      await addTask(text, due);
      speak(`Task added to the grid: ${text}`);
    }
    
    btnVoice.classList.remove("recording");
    btnVoice.textContent = "🎙️ Initialize Voice";
    listening = false;
  };

  recognition.onerror = (e) => {
    listening = false;
    btnVoice.classList.remove("recording");
    btnVoice.textContent = "🎙️ Initialize Voice";
    
    if (e.error === 'not-allowed') {
      setHint("Access Denied. Opening config tab...");
      setTimeout(() => {
        window.open(window.location.href + "?auth=1");
      }, 1000);
    } else {
      setHint(`Uplink Error: ${e.error}`);
    }
  };

  recognition.onend = () => {
    if (listening) {
      listening = false;
      btnVoice.classList.remove("recording");
      btnVoice.textContent = "🎙️ Initialize Voice";
    }
  };

  try {
    recognition.start();
  } catch (e) {
    listening = false;
    btnVoice.classList.remove("recording");
    btnVoice.textContent = "🎙️ Initialize Voice";
    setHint("Permission required.");
  }
}

/* Wiring */
btnAdd.addEventListener("click", () => addTask(taskText.value, taskDue.value));
btnClearDone.addEventListener("click", clearDone);
btnExport.addEventListener("click", exportJSON);
btnVoice.addEventListener("click", toggleVoice);

btnStandup.addEventListener("click", async () => {
  const tasks = await loadTasks();
  const text = makeStandup(tasks);
  setHint(text);
  speak(text);
});

taskText.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addTask(taskText.value, taskDue.value);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    taskText.focus();
  }
});

/* Init */
(async function init() {
  const tasks = await loadTasks();
  render(tasks);
  taskText.focus();
})();
