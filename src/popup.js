const STORAGE_KEY = "vtm_tasks_v1";
const CONTEXT_KEY = "vtm_active_context";
const BUBBLE_COLOR_KEY = "vtm_bubble_color";
const THEME_KEY = "vtm_theme";
const THEMES = {
  neural: { accent: "#10B981", pink: "#F567D7", panel: "#161616", bg: "#0a0a0a" },
  spice: { accent: "#ff9f1c", pink: "#F567D7", panel: "#1b1008", bg: "#0e0905" },
  violet: { accent: "#6603fc", pink: "#00e5ff", panel: "#161020", bg: "#0b0712" },
  ocean: { accent: "#00c2ff", pink: "#10B981", panel: "#07141c", bg: "#041018" }
};
const el = (id) => document.getElementById(id);

function escapeHTML(value) {
  const div = document.createElement("div");
  div.textContent = value || "";
  return div.innerHTML;
}

async function loadTasks() {
  const data = await chrome.storage.local.get([STORAGE_KEY]);
  return data[STORAGE_KEY] || [];
}
async function saveTasks(tasks) {
  await chrome.storage.local.set({ [STORAGE_KEY]: tasks });
}

function classifyTask(text) {
  const value = (text || "").toLowerCase();
  if (/\b(critical|urgent|blocker|broken|crash|fail|error)\b/.test(value)) {
    return { priority: "critical", group: "Bugfix" };
  }
  if (/\b(ship|shipped|launch|deploy|release|demo)\b/.test(value)) {
    return { priority: "ship", group: "Ship" };
  }
  if (/\b(ui|ux|css|style|design|layout|button|color|mobile)\b/.test(value)) {
    return { priority: "ui", group: "UI/UX" };
  }
  if (/\b(fix|bug|issue|regression)\b/.test(value)) {
    return { priority: "bugfix", group: "Bugfix" };
  }
  return { priority: "backlog", group: "Task" };
}

function groupLabel(group) {
  const labels = {
    Bugfix: "Bugfix",
    Ship: "Ship",
    "UI/UX": "UI/UX",
    Task: "Task"
  };
  return labels[group] || group || "Task";
}

function render(tasks) {
  const list = el("tasks");
  if (!list) return;
  list.innerHTML = "";
  tasks.forEach(t => {
    const projectLabel = t.projectName || (t.projectId ? VTM_I18N.projectFallback(t.projectId) : VTM_I18N.globalOrders);
    const priority = t.priority || classifyTask(t.text).priority;
    const group = t.group || classifyTask(t.text).group;
    const wrap = document.createElement("div");
    wrap.className = `task p-${priority} ${t.done ? "done" : ""}`;
    wrap.innerHTML = `
      <label class="task-check" title="${escapeHTML(t.done ? VTM_I18N.canceled : VTM_I18N.orderPlaced)}">
        <input type="checkbox" ${t.done ? "checked" : ""} aria-label="Mark task complete">
        <span></span>
      </label>
      <div class="main">
        <div class="text">${escapeHTML(t.text)}</div>
        <div class="meta">
          <span class="group-tag">${escapeHTML(groupLabel(group))}</span>
          <span class="priority-tag">${escapeHTML(priority)}</span>
          <span class="project-tag">${escapeHTML(projectLabel)}</span>
        </div>
      </div>
      <button class="del" type="button" aria-label="Delete task" title="Delete task">&times;</button>
    `;
    wrap.querySelector("input").addEventListener("change", async (event) => {
      const all = await loadTasks();
      const task = all.find(item => item.id === t.id);
      if (!task) return;
      task.done = event.target.checked;
      await saveTasks(all);
      render(all);
    });
    wrap.querySelector(".del").addEventListener("click", async () => {
      const all = await loadTasks();
      const next = all.filter(item => item.id !== t.id);
      await saveTasks(next);
      render(next);
    });
    list.appendChild(wrap);
  });
  const active = tasks.filter(t => !t.done).length;
  el("count").textContent = VTM_I18N.activeMissions(active);
}

function shouldConfirmProjectContext(context) {
  return context?.projectId && context?.projectName && context.source !== "kitchen";
}

function applyLocale() {
  el("taskText").placeholder = VTM_I18N.placeholder;
  el("btnVoice").textContent = VTM_I18N.btnVoice;
  el("btnAdd").textContent = VTM_I18N.btnAdd;
  el("btnStandup").textContent = VTM_I18N.btnStandup;
  el("btnExport").textContent = VTM_I18N.btnExport;
  el("btnClearDone").textContent = VTM_I18N.btnClearDone;
}

async function applyTheme() {
  const data = await chrome.storage.local.get({ [THEME_KEY]: "violet", [BUBBLE_COLOR_KEY]: "#6603fc" });
  const theme = THEMES[data[THEME_KEY]] || THEMES.violet;
  document.documentElement.style.setProperty("--accent", data[BUBBLE_COLOR_KEY] || theme.accent);
  document.documentElement.style.setProperty("--pink", theme.pink);
  document.documentElement.style.setProperty("--panel", theme.panel);
  document.documentElement.style.setProperty("--bg", theme.bg);
}

async function checkContext() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "GET_CONTEXT" });
    } catch (_) {}
  }

  const data = await chrome.storage.local.get([CONTEXT_KEY]);
  const activeProject = data[CONTEXT_KEY] || null;
  if (!activeProject || !activeProject.id) {
    el("headerTitle").textContent = VTM_I18N.kitchenTitle;
    el("vtm-header").classList.add("kitchen-mode");
  } else {
    el("headerTitle").textContent = "VTM v1.6.9";
    el("headerSubtitle").textContent = activeProject.name.toUpperCase();
    el("vtm-header").classList.remove("kitchen-mode");
  }
}

let voiceActivationInFlight = false;

async function activateVoiceAndClose() {
  if (voiceActivationInFlight) return;
  voiceActivationInFlight = true;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "ACTIVATE_VOICE" }, () => {
      window.close();
    });
    return;
  }

  window.close();
}

async function quickSaveAndClose() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "QUICK_SAVE_CONTEXT" }, () => {
      window.close();
    });
    return;
  }
  window.close();
}

function setHint(message) {
  const hint = el("hint");
  if (hint) hint.textContent = message;
}

function taskProjectLabel(task) {
  return task.projectName || (task.projectId ? VTM_I18N.projectFallback(task.projectId) : VTM_I18N.globalOrders);
}

function buildExportPayload(tasks, context) {
  return {
    app: "VOICE-TASK-MASTER",
    version: "1.6.9",
    exportedAt: new Date().toISOString(),
    activeContext: context || null,
    tasks
  };
}

function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportData() {
  const data = await chrome.storage.local.get([STORAGE_KEY, CONTEXT_KEY]);
  const tasks = data[STORAGE_KEY] || [];
  const payload = buildExportPayload(tasks, data[CONTEXT_KEY] || null);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  downloadJSON(`voice-task-master-${stamp}.json`, payload);
  setHint(VTM_I18N.hintExported);
}

function buildShipLog(tasks) {
  const today = new Date().toLocaleDateString();
  const done = tasks.filter(task => task.done);
  const active = tasks.filter(task => !task.done);
  const lines = [VTM_I18N.shipLogHeader(today).trim(), ""];

  if (done.length) {
    lines.push("## Finished");
    done.forEach(task => lines.push(`- [x] ${task.text} (${taskProjectLabel(task)})`));
    lines.push("");
  }

  if (active.length) {
    lines.push("## Still cooking");
    active.forEach(task => lines.push(`- [ ] ${task.text} (${taskProjectLabel(task)})`));
    lines.push("");
  }

  if (!tasks.length) lines.push(VTM_I18N.hintNoTasks);
  return lines.join("\n").trim() + "\n";
}

async function copyStandup() {
  const tasks = await loadTasks();
  const log = buildShipLog(tasks);
  await navigator.clipboard.writeText(log);
  setHint(VTM_I18N.hintCopied);
}

async function clearDone() {
  const tasks = await loadTasks();
  const next = tasks.filter(task => !task.done);
  if (next.length === tasks.length) {
    setHint(VTM_I18N.hintNoTasks);
    return;
  }
  await saveTasks(next);
  render(next);
  setHint(VTM_I18N.gridClear);
}

async function addTextTask() {
  const text = el("taskText").value;
  if (!text) return;
  await checkContext();
  const data = await chrome.storage.local.get([STORAGE_KEY, CONTEXT_KEY]);
  const tasks = data[STORAGE_KEY] || [];
  const context = data[CONTEXT_KEY] || {};
  const useProject = !!(context.projectId || context.id);
  const classification = classifyTask(text);
  tasks.unshift({
    id: Math.random().toString(16).slice(2),
    text,
    done: false,
    priority: classification.priority,
    group: classification.group,
    projectId: useProject ? (context.projectId || context.id || null) : null,
    projectName: useProject ? (context.projectName || context.name || null) : null,
    projectUrl: useProject ? (context.url || null) : null,
    userName: useProject ? (context.userName || null) : null,
    userUrl: useProject ? (context.userUrl || null) : null,
    contextSource: useProject ? (context.source || null) : "global",
    createdAt: Date.now()
  });
  await saveTasks(tasks);
  el("taskText").value = "";
  render(tasks);
  setHint(VTM_I18N.hintShip);
}

el("btnVoice").addEventListener("click", activateVoiceAndClose);
el("btnAdd").addEventListener("click", addTextTask);
el("btnExport").addEventListener("click", exportData);
el("btnStandup").addEventListener("click", copyStandup);
el("btnClearDone").addEventListener("click", clearDone);
el("taskText").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addTextTask();
  }
});

window.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "v") {
    e.preventDefault();
    e.stopPropagation();
    activateVoiceAndClose();
    return;
  }
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "s") {
    e.preventDefault();
    e.stopPropagation();
    quickSaveAndClose();
    return;
  }
  if (e.ctrlKey && e.key.toLowerCase() === "k") { e.preventDefault(); el("taskText").focus(); }
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes[STORAGE_KEY]) render(changes[STORAGE_KEY].newValue || []);
});

(async () => {
  applyLocale();
  await applyTheme();
  await checkContext();
  render(await loadTasks());
})();
