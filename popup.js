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

function render(tasks) {
  const list = el("tasks");
  if (!list) return;
  list.innerHTML = "";
  tasks.forEach(t => {
    const projectLabel = t.projectName || (t.projectId ? VTM_I18N.projectFallback(t.projectId) : VTM_I18N.globalOrders);
    const wrap = document.createElement("div");
    wrap.className = `task ${t.done ? "done" : ""}`;
    wrap.innerHTML = `
      <div class="main">
        <div class="text">${escapeHTML(t.text)}</div>
        <div class="meta"><span class="project-tag">${escapeHTML(projectLabel)}</span></div>
      </div>
    `;
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

el("btnVoice").addEventListener("click", activateVoiceAndClose);
el("btnAdd").addEventListener("click", async () => {
  const text = el("taskText").value;
  if (!text) return;
  await checkContext();
  const data = await chrome.storage.local.get([STORAGE_KEY, CONTEXT_KEY]);
  const tasks = data[STORAGE_KEY] || [];
  const context = data[CONTEXT_KEY] || {};
  const useProject = !shouldConfirmProjectContext(context) || confirm(VTM_I18N.confirmSaveProject(context.projectName || context.name));
  tasks.unshift({
    id: Math.random().toString(16).slice(2),
    text,
    done: false,
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
