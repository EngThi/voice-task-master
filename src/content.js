/* VTM v1.6.9 - Final Polish & Feedback */
(function() {
  const STORAGE_KEY = "vtm_tasks_v1";
  const CONTEXT_KEY = "vtm_active_context";
  const EXTENSION_PROJECT_ID = "4322";
  const USAGE_PING_KEY = "vtm_extension_usage_pinged_at";
  const BUBBLE_COLOR_KEY = "vtm_bubble_color";
  const PANEL_OPEN_KEY = "vtm_panel_open";
  const THEME_KEY = "vtm_theme";
  const DEFAULT_BUBBLE_COLOR = "#6603fc";
  const THEMES = {
    neural: { name: "Green", accent: "#10B981", secondary: "#F567D7", panel: "rgba(10, 10, 10, 0.94)", text: "#ffffff", glow: "rgba(16,185,129,.36)" },
    spice: { name: "Spice", accent: "#ff9f1c", secondary: "#F567D7", panel: "rgba(22, 12, 6, 0.94)", text: "#fff7ed", glow: "rgba(255,159,28,.34)" },
    violet: { name: "Violet", accent: "#6603fc", secondary: "#00e5ff", panel: "rgba(13, 8, 24, 0.94)", text: "#ffffff", glow: "rgba(102,3,252,.42)" },
    ocean: { name: "Ocean", accent: "#00c2ff", secondary: "#10B981", panel: "rgba(4, 16, 24, 0.94)", text: "#f0fbff", glow: "rgba(0,194,255,.34)" }
  };
  let lastExploreContext = null;

  const t = (key, fallback) => VTM_I18N?.[key] || fallback;

  function applyThemeVars(target, themeName, bubbleColor) {
    const theme = THEMES[themeName] || THEMES.neural;
    target.style.setProperty("--vtm-accent", bubbleColor || theme.accent);
    target.style.setProperty("--vtm-secondary", theme.secondary);
    target.style.setProperty("--vtm-panel", theme.panel);
    target.style.setProperty("--vtm-text", theme.text);
    target.style.setProperty("--vtm-glow", theme.glow);
    target.style.setProperty("--vtm-bubble-color", bubbleColor || theme.accent);
  }

  function textFrom(selector, root = document) {
    return root.querySelector(selector)?.textContent?.trim() || "";
  }

  function hrefFrom(selector, root = document) {
    const href = root.querySelector(selector)?.href || "";
    return href ? new URL(href, location.href).href : "";
  }

  function linkInfoFrom(selector, root = document) {
    const link = root.querySelector(selector);
    if (!link) return { name: "", url: "" };
    return {
      name: link.textContent?.trim() || "",
      url: new URL(link.getAttribute("href"), location.href).href
    };
  }

  function projectIdFromUrl(url) {
    const path = new URL(url || location.href, location.href).pathname;
    return path.match(/\/projects\/([^\/]+)/)?.[1] || null;
  }

  function detectProjectContext() {
    const match = location.pathname.match(/\/projects\/([^\/]+)/);
    let newContext = null;
    if (match) {
      const id = match[1];
      const name = textFrom(".project-show-card__title-text") || VTM_I18N.projectFallback(id);
      const byline = textFrom(".project-show-card__byline");
      const user = linkInfoFrom('.project-show-card__byline a[href^="/users/"], .project-show-card__byline a[href*="/users/"]');
      const statsText = textFrom(".project-show-card__stats");
      const demoUrl = hrefFrom(".project-show-card__actions a[href]:has(svg), .project-show-card__actions a[href]");
      newContext = {
        id,
        projectId: id,
        slug: id,
        name,
        projectName: name,
        byline,
        userName: user.name,
        userUrl: user.url,
        isShipped: /shipped|approved|certified/i.test(statsText) || !!demoUrl,
        demoUrl,
        url: location.href,
        source: "project"
      };
    } else if (location.pathname.startsWith("/explore") && lastExploreContext) {
      newContext = { ...lastExploreContext, source: "explore" };
    } else {
      newContext = { id: null, projectId: null, slug: null, name: VTM_I18N.kitchenTitle, projectName: VTM_I18N.kitchenTitle, url: location.href, source: "kitchen" };
    }
    chrome.storage.local.set({ [CONTEXT_KEY]: newContext });
    return newContext;
  }

  detectProjectContext();
  document.addEventListener("turbo:load", detectProjectContext);
  document.addEventListener("mouseover", (event) => {
    if (!location.pathname.startsWith("/explore")) return;
    const card = event.target.closest(".project-card, .post");
    if (!card) return;

    const projectLink = card.querySelector('a[href^="/projects/"], a[href*="/projects/"]');
    if (!projectLink) return;

    const projectUrl = new URL(projectLink.getAttribute("href"), location.href).href;
    const projectId = projectIdFromUrl(projectUrl);
    const projectName = projectLink.textContent?.trim() || textFrom(".project-card__title-link", card) || VTM_I18N.projectFallback(projectId);
    const user = linkInfoFrom('.post__author a[href^="/users/"], .post__author a[href*="/users/"]', card);
    lastExploreContext = {
      id: projectId,
      projectId,
      slug: projectId,
      name: projectName,
      projectName,
      byline: textFrom(".post__author", card),
      userName: user.name,
      userUrl: user.url,
      isShipped: !!card.querySelector(".post__ship-title"),
      url: projectUrl,
      source: "explore"
    };
    chrome.storage.local.set({ [CONTEXT_KEY]: lastExploreContext });
  }, true);

  function escapeHTML(value) {
    const div = document.createElement('div');
    div.textContent = value || "";
    return div.innerHTML;
  }

  function getApiKey() {
    const apiKeyEl = document.querySelector(".api-key-display");
    const key = apiKeyEl?.dataset?.apiKey || apiKeyEl?.textContent?.trim() || "";
    return key.startsWith("ft_sk_") ? key : "";
  }

  async function pingExtensionUsage() {
    const apiKey = getApiKey();
    const status = document.getElementById('vtm-install-status');
    if (status) {
      status.textContent = apiKey ? t("apiConnected", "API connected") : t("apiMissing", "Generate an API key in Settings");
      status.style.color = apiKey ? "#10B981" : "#F567D7";
    }
    if (!apiKey) return;

    const data = await chrome.storage.local.get([USAGE_PING_KEY]);
    const lastPing = data[USAGE_PING_KEY] || 0;
    if (Date.now() - lastPing < 6 * 60 * 60 * 1000) return;

    try {
      const response = await fetch(`https://flavortown.hackclub.com/api/v1/projects/${EXTENSION_PROJECT_ID}`, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          [`X-Flavortown-Ext-${EXTENSION_PROJECT_ID}`]: "true"
        }
      });
      if (response.ok) {
        await chrome.storage.local.set({ [USAGE_PING_KEY]: Date.now() });
      }
    } catch (_) {
      if (status) {
        status.textContent = t("apiPending", "API sync pending");
        status.style.color = "#ffcc00";
      }
    }
  }

  function buildTask(text, context, forceGlobal = false) {
    const useProject = !forceGlobal && context?.projectId;
    return {
      id: Math.random().toString(16).slice(2),
      text,
      done: false,
      projectId: useProject ? context.projectId : null,
      projectName: useProject ? context.projectName : null,
      projectUrl: useProject ? context.url : null,
      userName: useProject ? context.userName : null,
      userUrl: useProject ? context.userUrl : null,
      isShipped: useProject ? !!context.isShipped : false,
      contextSource: useProject ? context.source : "global",
      createdAt: Date.now()
    };
  }

  async function saveTask(task) {
    const data = await chrome.storage.local.get([STORAGE_KEY]);
    const tasks = data[STORAGE_KEY] || [];
    tasks.unshift(task);
    await chrome.storage.local.set({ [STORAGE_KEY]: tasks });
    return task;
  }

  function contextNeedsConfirmation(context) {
    return context?.projectId && context?.projectName && context.source !== "kitchen";
  }

  function showContextConfirm(text, context) {
    return new Promise((resolve) => {
      document.getElementById("vtm-context-confirm")?.remove();
      const modal = document.createElement("div");
      modal.id = "vtm-context-confirm";
      chrome.storage.local.get({ [BUBBLE_COLOR_KEY]: DEFAULT_BUBBLE_COLOR, [THEME_KEY]: "violet" }, (data) => {
        applyThemeVars(modal, data[THEME_KEY], data[BUBBLE_COLOR_KEY]);
      });
      const owner = context.userName ? `<a href="${escapeHTML(context.userUrl)}" target="_blank" rel="noopener">${escapeHTML(context.userName)}</a>` : escapeHTML(t("otherUser", "another user"));
      const shipped = context.isShipped ? `<span>${escapeHTML(t("shipped", "Shipped/testable"))}</span>` : `<span>${escapeHTML(t("projectDevlog", "Project/devlog"))}</span>`;
      modal.innerHTML = `
        <div class="vtm-confirm-card">
          <div class="vtm-confirm-eyebrow">${escapeHTML(t("saveInsight", "Save insight?"))}</div>
          <div class="vtm-confirm-title">${escapeHTML(context.projectName)}</div>
          <div class="vtm-confirm-meta">${owner} ${shipped}</div>
          <div class="vtm-confirm-text">${escapeHTML(text)}</div>
          <div class="vtm-confirm-actions">
            <button type="button" data-choice="project">${escapeHTML(t("saveProject", "Save to project"))}</button>
            <button type="button" data-choice="global">${escapeHTML(t("saveGlobal", "Global"))}</button>
            <button type="button" data-choice="cancel">${escapeHTML(t("cancel", "Cancel"))}</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-choice]");
        if (!button) return;
        modal.remove();
        resolve(button.dataset.choice);
      });
    });
  }

  async function proposeTask(text, context, options = {}) {
    const forceDirect = options.direct === true || !contextNeedsConfirmation(context);
    if (forceDirect) {
      return saveTask(buildTask(text, context, false));
    }

    const choice = await showContextConfirm(text, context);
    if (choice === "cancel") return null;
    return saveTask(buildTask(text, context, choice === "global"));
  }

  /* --- UI --- */
  function ensureUI() {
    if (document.getElementById('vtm-ship-hud')) return;
    const badge = document.createElement('div');
    badge.id = 'vtm-ship-hud';
    badge.innerHTML = `
      <div id="vtm-hud-main">
        <div id="vtm-hud-header">
          <span id="vtm-hud-title">VTM // VOICE CAPTURE</span>
          <div id="vtm-voice-waves" aria-hidden="true">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
        </div>
        <div id="vtm-hud-project-name">${escapeHTML(t("hintReady", "Ready..."))}</div>
        <div id="vtm-hud-tasks"></div>
      </div>
    `;
    document.body.appendChild(badge);
    const style = document.createElement('style');
    style.textContent = `
      #vtm-ship-hud {
        position: fixed !important; top: 15% !important; left: 50% !important;
        transform: translateX(-50%) translateY(-30px) !important; z-index: 2147483647 !important;
        background-color: var(--vtm-panel, #0a0a0a) !important; border: 1px solid var(--vtm-accent, #10B981) !important;
        color: #ffffff !important; padding: 20px !important; width: 450px !important;
        border-radius: 16px !important; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8), 0 0 34px var(--vtm-glow, rgba(16,185,129,.24)) !important;
        backdrop-filter: blur(20px) !important; opacity: 0 !important;
        pointer-events: none !important; transition: all 0.3s ease !important; display: block !important;
      }
      #vtm-ship-hud.vtm-active { opacity: 1 !important; transform: translateX(-50%) translateY(0) !important; pointer-events: auto !important; }
      #vtm-hud-header { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 14px !important; margin-bottom: 10px !important; }
      #vtm-hud-title { color: var(--vtm-accent, #10B981) !important; font-size: 11px !important; font-weight: 800 !important; letter-spacing: .08em !important; }
      #vtm-hud-project-name { color: #ffffff; font-size: 16px; font-weight: 600; min-height: 24px; margin-bottom: 10px; transition: color 0.2s; }
      #vtm-voice-waves { display: flex !important; align-items: center !important; gap: 4px !important; height: 22px !important; }
      #vtm-voice-waves span {
        width: 4px !important; height: 8px !important; border-radius: 999px !important;
        background: linear-gradient(180deg, var(--vtm-secondary, #F567D7), var(--vtm-accent, #10B981)) !important;
        animation: vtm-wave 0.72s ease-in-out infinite !important;
      }
      #vtm-voice-waves span:nth-child(2) { animation-delay: .08s !important; }
      #vtm-voice-waves span:nth-child(3) { animation-delay: .16s !important; }
      #vtm-voice-waves span:nth-child(4) { animation-delay: .24s !important; }
      #vtm-voice-waves span:nth-child(5) { animation-delay: .32s !important; }
      @keyframes vtm-wave { 0%, 100% { height: 7px; opacity: .55; } 50% { height: 22px; opacity: 1; } }
      .vtm-hud-task { margin-top: 8px; padding: 8px 12px; background: rgba(255,255,255,0.03); border-radius: 6px; border-left: 3px solid var(--vtm-accent, #10B981); font-size: 13px; color: #fff; }
    `;
    document.head.appendChild(style);
  }

  function ensureInstallBadge() {
    if (document.getElementById('vtm-install-badge')) return;

    const badge = document.createElement('div');
    badge.id = 'vtm-install-badge';
    badge.innerHTML = `
      <button id="vtm-bubble" type="button" title="Voice Task Master"></button>
      <div id="vtm-install-header">
        <span id="vtm-install-title">${escapeHTML(t("panelTitle", "VTM // Mission Control"))}</span>
        <div id="vtm-install-actions">
          <select id="vtm-theme-select" title="${escapeHTML(t("themeLabel", "Theme"))}">
            ${Object.entries(THEMES).map(([key, theme]) => `<option value="${key}">${theme.name}</option>`).join("")}
          </select>
          <label id="vtm-color-wrap" title="${escapeHTML(t("colorLabel", "Color"))}">
            <span></span>
            <input id="vtm-bubble-color" type="color" value="${DEFAULT_BUBBLE_COLOR}">
          </label>
          <button id="vtm-panel-pin" type="button" title="${escapeHTML(t("pinLabel", "Pin"))}">${escapeHTML(t("pinLabel", "Pin"))}</button>
          <button id="vtm-panel-collapse" type="button" title="${escapeHTML(t("closeLabel", "Collapse"))}">-</button>
        </div>
      </div>
      <div id="vtm-install-context">${escapeHTML(t("hintReady", "Extension online"))}</div>
      <div id="vtm-install-status">${escapeHTML(t("apiChecking", "Checking API"))}</div>
      <div id="vtm-install-hints">
        <span>${escapeHTML(t("voiceHotkey", "Voice: Ctrl+Shift+V"))}</span>
        <span>${escapeHTML(t("quickSaveHotkey", "Quick save: Ctrl+Shift+S"))}</span>
      </div>
      <div id="vtm-install-tasks"></div>
    `;
    document.body.appendChild(badge);

    const style = document.createElement('style');
    style.textContent = `
      #vtm-install-badge {
        position: fixed !important; right: 24px !important; bottom: 24px !important;
        z-index: 2147483646 !important; width: 280px !important; max-width: calc(100vw - 48px) !important;
        box-sizing: border-box !important; padding: 14px !important; color: #ffffff !important;
        background: var(--vtm-panel, rgba(10, 10, 10, 0.92)) !important; border: 1px solid rgba(255,255,255,.12) !important;
        border-radius: 14px !important; box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 32px var(--vtm-glow, rgba(16,185,129,.18)) !important;
        backdrop-filter: blur(10px) !important; font-family: system-ui, -apple-system, sans-serif !important;
        font-size: 12px !important; line-height: 1.35 !important; pointer-events: auto !important;
        transform-origin: bottom right !important; transition: opacity .18s ease, transform .18s ease, width .18s ease, padding .18s ease !important;
      }
      #vtm-install-badge.vtm-collapsed {
        width: 52px !important; height: 52px !important; padding: 0 !important; border-radius: 999px !important;
        background: transparent !important; border-color: transparent !important; box-shadow: none !important;
      }
      #vtm-install-badge.vtm-collapsed:hover, #vtm-install-badge.vtm-pinned {
        width: 280px !important; height: auto !important; padding: 14px !important; border-radius: 12px !important;
        background: var(--vtm-panel, rgba(10, 10, 10, 0.92)) !important; border-color: rgba(255,255,255,.12) !important;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 32px var(--vtm-glow, rgba(16,185,129,.18)) !important;
      }
      #vtm-bubble {
        position: absolute !important; right: 0 !important; bottom: 0 !important; width: 52px !important; height: 52px !important;
        border-radius: 999px !important; border: 2px solid rgba(255,255,255,.9) !important;
        background: radial-gradient(circle at 32% 28%, rgba(255,255,255,.95), var(--vtm-bubble-color, ${DEFAULT_BUBBLE_COLOR}) 34%, #090909 120%) !important;
        box-shadow: 0 8px 24px rgba(0,0,0,.35), 0 0 0 0 var(--vtm-glow, rgba(102,3,252,.35)) !important;
        cursor: pointer !important; animation: vtm-bubble-pulse 2.4s ease-in-out infinite !important;
      }
      #vtm-bubble::before, #vtm-bubble::after {
        content: "" !important; position: absolute !important; inset: -8px !important; border-radius: inherit !important;
        border: 1px solid var(--vtm-bubble-color, ${DEFAULT_BUBBLE_COLOR}) !important; opacity: .35 !important; animation: vtm-bubble-ring 2.4s ease-out infinite !important;
      }
      #vtm-bubble::after { animation-delay: .8s !important; }
      @keyframes vtm-bubble-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
      @keyframes vtm-bubble-ring { 0% { transform: scale(.7); opacity: .5; } 100% { transform: scale(1.45); opacity: 0; } }
      #vtm-install-badge:not(.vtm-collapsed) #vtm-bubble,
      #vtm-install-badge.vtm-collapsed:hover #vtm-bubble,
      #vtm-install-badge.vtm-pinned #vtm-bubble { display: none !important; }
      #vtm-install-badge.vtm-collapsed:not(:hover):not(.vtm-pinned) > :not(#vtm-bubble) { display: none !important; }
      #vtm-install-header {
        display: flex !important; align-items: center !important; justify-content: space-between !important;
        gap: 10px !important; padding-bottom: 8px !important; margin-bottom: 10px !important;
        border-bottom: 1px solid #262626 !important;
      }
      #vtm-install-title { color: var(--vtm-accent, #10B981) !important; font-weight: 800 !important; font-size: 11px !important; text-transform: uppercase !important; }
      #vtm-install-actions { display: flex !important; gap: 6px !important; align-items: center !important; }
      #vtm-theme-select {
        max-width: 72px !important; height: 26px !important; color: var(--vtm-text, #fff) !important; background: rgba(255,255,255,.06) !important;
        border: 1px solid rgba(255,255,255,.14) !important; border-radius: 7px !important; font-size: 10px !important; outline: none !important;
        color-scheme: dark !important;
      }
      #vtm-theme-select option {
        color: #ffffff !important;
        background-color: #111111 !important;
      }
      #vtm-theme-select:focus {
        border-color: var(--vtm-accent, #10B981) !important;
        box-shadow: 0 0 0 2px var(--vtm-glow, rgba(16,185,129,.22)) !important;
      }
      #vtm-color-wrap {
        width: 26px !important; height: 26px !important; display: grid !important; place-items: center !important;
        border-radius: 999px !important; border: 1px solid rgba(255,255,255,.18) !important; background: rgba(255,255,255,.06) !important; cursor: pointer !important;
      }
      #vtm-color-wrap span { width: 14px !important; height: 14px !important; border-radius: 999px !important; background: var(--vtm-bubble-color, ${DEFAULT_BUBBLE_COLOR}) !important; box-shadow: 0 0 14px var(--vtm-glow, rgba(102,3,252,.35)) !important; }
      #vtm-bubble-color { opacity: 0 !important; position: absolute !important; width: 1px !important; height: 1px !important; }
      #vtm-panel-pin, #vtm-panel-collapse, .vtm-confirm-actions button {
        border: 1px solid #333 !important; background: #161616 !important; color: #fff !important; border-radius: 6px !important;
        padding: 4px 8px !important; font: inherit !important; cursor: pointer !important;
      }
      #vtm-install-context { color: var(--vtm-secondary, #ffcc00) !important; font-size: 11px !important; font-weight: 700 !important; text-transform: uppercase !important; margin-bottom: 6px !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
      #vtm-install-status { color: var(--vtm-secondary, #F567D7) !important; font-size: 10px !important; font-weight: 700 !important; margin-bottom: 8px !important; }
      #vtm-install-hints { display: flex !important; flex-direction: column !important; gap: 2px !important; color: #aaa !important; font-size: 10px !important; margin-bottom: 8px !important; }
      .vtm-install-section { color: var(--vtm-accent, #10B981) !important; font-size: 10px !important; font-weight: 800 !important; margin: 8px 0 4px !important; text-transform: uppercase !important; }
      .vtm-install-task { display: block !important; color: #fff !important; text-decoration: none !important; margin-bottom: 6px !important; padding: 6px 10px !important; background: rgba(255,255,255,0.04) !important; border-radius: 7px !important; border-left: 3px solid var(--vtm-accent, #10B981) !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; font-weight: 500 !important; }
      .vtm-install-empty { color: #848484 !important; font-size: 10px !important; opacity: 0.75 !important; }
      #vtm-context-confirm {
        position: fixed !important; inset: 0 !important; z-index: 2147483647 !important; display: grid !important;
        place-items: center !important; background: rgba(0,0,0,.35) !important; font-family: system-ui, -apple-system, sans-serif !important;
      }
      .vtm-confirm-card {
        width: min(420px, calc(100vw - 32px)) !important; background: var(--vtm-panel, #0a0a0a) !important; color: #fff !important;
        border: 1px solid var(--vtm-accent, #10B981) !important; border-radius: 14px !important; padding: 18px !important; box-shadow: 0 20px 60px rgba(0,0,0,.65), 0 0 34px var(--vtm-glow, rgba(16,185,129,.2)) !important;
      }
      .vtm-confirm-eyebrow { color: var(--vtm-accent, #10B981) !important; font-size: 11px !important; font-weight: 800 !important; text-transform: uppercase !important; margin-bottom: 6px !important; }
      .vtm-confirm-title { font-size: 18px !important; font-weight: 800 !important; margin-bottom: 4px !important; }
      .vtm-confirm-meta, .vtm-confirm-meta a { color: var(--vtm-secondary, #ffcc00) !important; font-size: 12px !important; margin-bottom: 12px !important; }
      .vtm-confirm-text { padding: 10px !important; background: rgba(255,255,255,.04) !important; border-radius: 8px !important; margin-bottom: 12px !important; }
      .vtm-confirm-actions { display: flex !important; gap: 8px !important; flex-wrap: wrap !important; }
    `;
    document.head.appendChild(style);

    chrome.storage.local.get({ [BUBBLE_COLOR_KEY]: DEFAULT_BUBBLE_COLOR, [PANEL_OPEN_KEY]: true, [THEME_KEY]: "violet" }, (data) => {
      const color = data[BUBBLE_COLOR_KEY] || DEFAULT_BUBBLE_COLOR;
      const themeName = data[THEME_KEY] || "violet";
      applyThemeVars(badge, themeName, color);
      const hud = document.getElementById("vtm-ship-hud");
      if (hud) applyThemeVars(hud, themeName, color);
      document.getElementById("vtm-bubble-color").value = color;
      document.getElementById("vtm-theme-select").value = themeName;
      badge.classList.toggle("vtm-collapsed", !data[PANEL_OPEN_KEY]);
      badge.classList.toggle("vtm-pinned", !!data[PANEL_OPEN_KEY]);
    });

    document.getElementById("vtm-bubble").addEventListener("click", () => {
      badge.classList.remove("vtm-collapsed");
      badge.classList.add("vtm-pinned");
      chrome.storage.local.set({ [PANEL_OPEN_KEY]: true });
    });
    document.getElementById("vtm-panel-collapse").addEventListener("click", () => {
      badge.classList.add("vtm-collapsed");
      badge.classList.remove("vtm-pinned");
      chrome.storage.local.set({ [PANEL_OPEN_KEY]: false });
    });
    document.getElementById("vtm-panel-pin").addEventListener("click", () => {
      const pinned = !badge.classList.contains("vtm-pinned");
      badge.classList.toggle("vtm-pinned", pinned);
      badge.classList.toggle("vtm-collapsed", !pinned);
      chrome.storage.local.set({ [PANEL_OPEN_KEY]: pinned });
    });
    document.getElementById("vtm-bubble-color").addEventListener("input", (event) => {
      const color = event.target.value;
      const themeName = document.getElementById("vtm-theme-select").value;
      applyThemeVars(badge, themeName, color);
      const hud = document.getElementById("vtm-ship-hud");
      if (hud) applyThemeVars(hud, themeName, color);
      chrome.storage.local.set({ [BUBBLE_COLOR_KEY]: color });
    });
    document.getElementById("vtm-theme-select").addEventListener("change", (event) => {
      const themeName = event.target.value;
      const color = THEMES[themeName]?.accent || DEFAULT_BUBBLE_COLOR;
      document.getElementById("vtm-bubble-color").value = color;
      applyThemeVars(badge, themeName, color);
      const hud = document.getElementById("vtm-ship-hud");
      if (hud) applyThemeVars(hud, themeName, color);
      chrome.storage.local.set({ [THEME_KEY]: themeName, [BUBBLE_COLOR_KEY]: color });
    });
  }

  ensureUI();
  ensureInstallBadge();
  pingExtensionUsage();
  setInterval(pingExtensionUsage, 60 * 1000);

  /* --- VOICE --- */
  let recognition = null;
  let isProcessing = false;
  let lastVoiceActivationAt = 0;
  let voiceSilenceTimer = null;

  async function startVoice() {
    const now = Date.now();
    if (now - lastVoiceActivationAt < 700) return;
    lastVoiceActivationAt = now;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (recognition) { recognition.stop(); recognition = null; return; }

    recognition = new SR();
    recognition.lang = VTM_I18N.voiceLang;
    recognition.interimResults = true;
    isProcessing = false;

    const hud = document.getElementById('vtm-ship-hud');
    const nameEl = document.getElementById('vtm-hud-project-name');
    const stopSilenceTimer = () => {
      if (voiceSilenceTimer) clearTimeout(voiceSilenceTimer);
      voiceSilenceTimer = null;
    };
    const resetSilenceTimer = () => {
      stopSilenceTimer();
      voiceSilenceTimer = setTimeout(() => {
        if (!isProcessing) closeVoiceHud();
      }, 4000);
    };
    const closeVoiceHud = () => {
      stopSilenceTimer();
      hud.classList.remove('vtm-active');
      try { recognition?.stop(); } catch (_) {}
      recognition = null;
    };

    recognition.onstart = () => {
      hud.classList.add('vtm-active');
      nameEl.textContent = t("listening", "Listening...");
      nameEl.style.color = "#ffffff";
      resetSilenceTimer();
    };

    recognition.onresult = async (ev) => {
      let interim = ""; let final = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) final += ev.results[i][0].transcript;
        else interim += ev.results[i][0].transcript;
      }

      // MOSTRAR O TEXTO ENQUANTO FALA (Feedback Rosa)
      if (interim) {
        resetSilenceTimer();
        nameEl.textContent = interim;
        nameEl.style.color = "#F567D7";
      }

      if (final) {
        stopSilenceTimer();
        isProcessing = true;
        const data = await chrome.storage.local.get([CONTEXT_KEY]);
        const context = data[CONTEXT_KEY] || detectProjectContext();
        const saved = await proposeTask(final, context);
        nameEl.textContent = saved ? t("orderPlaced", "Order Placed!") : t("canceled", "Canceled");
        nameEl.style.color = saved ? "#10B981" : "#ffcc00";
        setTimeout(() => { hud.classList.remove('vtm-active'); recognition = null; }, 1200);
      }
    };

    recognition.onerror = () => { closeVoiceHud(); };
    recognition.onend = () => { 
      stopSilenceTimer();
      setTimeout(() => { if (!isProcessing) hud.classList.remove('vtm-active'); recognition = null; }, 500);
    };
    recognition.start();
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "ACTIVATE_VOICE") startVoice();
    if (msg.type === "QUICK_SAVE_CONTEXT") {
      const context = detectProjectContext();
      const selected = window.getSelection()?.toString()?.trim();
      const text = selected || (context?.projectName ? VTM_I18N.reviewProject(context.projectName) : t("quickNote", "Quick note"));
      saveTask(buildTask(text, context, false)).then((task) => {
        sendResponse({ ok: true, task });
        const status = document.getElementById("vtm-install-status");
        if (status) {
          status.textContent = t("directSaved", "Saved directly");
          status.style.color = "#10B981";
          setTimeout(pingExtensionUsage, 1200);
        }
      });
      return true;
    }
    if (msg.type === "GET_CONTEXT") {
      sendResponse(detectProjectContext());
      return true;
    }
  });

  const refreshHUD = async () => {
    const data = await chrome.storage.local.get([STORAGE_KEY, CONTEXT_KEY]);
    const info = data[CONTEXT_KEY];
    const allTasks = (data[STORAGE_KEY] || []).filter(t => !t.done);
    const projectTasks = allTasks.filter(t => info?.id && t.projectId === info.id).slice(0, 3);
    const globalTasks = allTasks.filter(t => !t.projectId).slice(0, 3);
    const tasks = projectTasks.length ? projectTasks : globalTasks;
    const container = document.getElementById('vtm-hud-tasks');
    if (container) {
      container.innerHTML = tasks.map(t => `<div class="vtm-hud-task">${escapeHTML(t.text)}</div>`).join('') || `<div style="opacity:0.3; font-size:11px; text-align:center; padding: 10px;">${escapeHTML(VTM_I18N.gridClear)}</div>`;
    }

    const installContext = document.getElementById('vtm-install-context');
    const installTasks = document.getElementById('vtm-install-tasks');
    if (installContext) {
      installContext.textContent = info?.id ? `Ship: ${info.name || info.id}` : t("kitchenMode", "Kitchen mode");
    }
    if (installTasks) {
      const renderTask = (task) => {
        const href = task.projectUrl || "#";
        const tag = task.projectUrl ? "a" : "div";
        const attrs = task.projectUrl ? ` href="${escapeHTML(href)}" target="_blank" rel="noopener"` : "";
        const label = task.projectName ? `${task.text} - ${task.projectName}` : task.text;
        return `<${tag} class="vtm-install-task"${attrs}>${escapeHTML(label)}</${tag}>`;
      };
      installTasks.innerHTML = `
        <div class="vtm-install-section">${escapeHTML(t("currentProject", "Current project"))}</div>
        ${projectTasks.map(renderTask).join('') || `<div class="vtm-install-empty">${escapeHTML(t("emptyProject", "Nothing for this project."))}</div>`}
        <div class="vtm-install-section">${escapeHTML(t("globalOrders", "Global"))}</div>
        ${globalTasks.map(renderTask).join('') || `<div class="vtm-install-empty">${escapeHTML(t("emptyGlobal", "No global orders."))}</div>`}
      `;
    }
  };
  refreshHUD();
  chrome.storage.onChanged.addListener(refreshHUD);

  let sec = 0;
  setInterval(() => {
    sec++;
    const timer = document.getElementById('vtm-install-timer');
    if (timer) {
      timer.textContent = `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;
    }
  }, 1000);
})();
