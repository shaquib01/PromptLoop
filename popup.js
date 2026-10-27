const $ = (id) => document.getElementById(id);

const defaults = {
  prompt: "Continue.",
  enabled: false,
  autoSend: true,
  maxRounds: 3,
  delay: 3,
  roundsUsed: 0,
  runtimeStatus: ""
};

function readForm() {
  return {
    prompt: $("prompt").value.trim(),
    enabled: $("enabled").checked,
    autoSend: $("autoSend").checked,
    maxRounds: Math.max(1, Math.min(50, Number($("maxRounds").value) || 3)),
    delay: Math.max(1, Math.min(15, Number($("delay").value) || 3))
  };
}

function setStatus(message, kind = "") {
  $("status").textContent = message;
  $("status").className = `status ${kind}`;
}

function isSupportedUrl(url) {
  return /^https:\/\/(.*\.)?(chatgpt\.com|chat\.openai\.com|gemini\.google\.com)(\/|$)/.test(url || "");
}

function getPlatformName(url) {
  if (/gemini\.google\.com/i.test(url || "")) return "Gemini";
  if (/chatgpt\.com|openai\.com/i.test(url || "")) return "ChatGPT";
  return "AI Chat";
}

async function activeChatTab() {
  try {
    let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    let tab = tabs[0];
    if (!tab || !isSupportedUrl(tab.url)) {
      const focusedTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (focusedTabs[0] && isSupportedUrl(focusedTabs[0].url)) {
        tab = focusedTabs[0];
      }
    }
    if (tab && isSupportedUrl(tab.url)) return tab;

    const allActive = await chrome.tabs.query({ active: true });
    const chatTab = allActive.find(t => isSupportedUrl(t.url));
    if (chatTab) return chatTab;
  } catch (err) {
    console.warn("[PromptLoop] Tab query error:", err);
  }
  return null;
}

function normalizeForm() {
  const settings = readForm();
  $("maxRounds").value = settings.maxRounds;
  $("delay").value = settings.delay;
  return settings;
}

async function sendCommand(command, settings = null) {
  const tab = await activeChatTab();
  if (!tab) {
    setStatus("Open ChatGPT or Gemini in active tab first.", "warn");
    return false;
  }
  const platform = getPlatformName(tab.url);

  // 1. Try sending the command directly
  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "PROMPTLOOP_COMMAND", command, settings
    });
    setStatus(response?.message || "Command sent.", response?.ok ? "ok" : "warn");
    return Boolean(response?.ok);
  } catch (initialErr) {
    console.log("[PromptLoop] Direct message failed, attempting auto-injection:", initialErr?.message);
  }

  // 2. Direct message failed (extension was reloaded or content script not yet injected)
  // Auto-inject content.js dynamically into the active AI chat tab
  try {
    if (chrome.scripting) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
      // Wait for content script to initialize its message listener
      await new Promise(r => setTimeout(r, 250));

      const retryResponse = await chrome.tabs.sendMessage(tab.id, {
        type: "PROMPTLOOP_COMMAND", command, settings
      });
      setStatus(retryResponse?.message || "Command sent.", retryResponse?.ok ? "ok" : "warn");
      return Boolean(retryResponse?.ok);
    }
  } catch (injectErr) {
    console.warn("[PromptLoop] Auto-injection failed:", injectErr);
  }

  // 3. If both direct send and programmatic injection failed
  setStatus(`Content script not ready. Reload the ${platform} tab (F5) and try again.`, "warn");
  return false;
}

function renderDiagnostics(saved) {
  const status = saved.runtimeStatus || (saved.enabled ? "Active" : "Not started");
  if ($("runStatus")) $("runStatus").textContent = status;
  if ($("roundsUsed")) $("roundsUsed").textContent = `${saved.roundsUsed || 0} / ${saved.maxRounds || 3}`;

  if ($("progressBar")) {
    const pct = Math.min(100, Math.round(((saved.roundsUsed || 0) / (saved.maxRounds || 3)) * 100));
    $("progressBar").style.width = `${pct}%`;
  }

  if ($("statusDot")) {
    const isError = status.startsWith("Error");
    const isRunning = saved.enabled && !isError;
    $("statusDot").className = `status-pulse-dot ${isRunning ? "active" : ""}`;
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  chrome.storage.local.get(defaults).then(renderDiagnostics).catch(() => {});
});

async function load() {
  const saved = await chrome.storage.local.get(defaults);
  renderDiagnostics(saved);
  $("prompt").value = saved.prompt;
  $("enabled").checked = saved.enabled;
  $("autoSend").checked = saved.autoSend;
  $("maxRounds").value = saved.maxRounds;
  $("delay").value = saved.delay;
  const tab = await activeChatTab();
  if (!tab) setStatus("Open ChatGPT or Gemini in active tab to use PromptLoop.", "warn");
  else if (saved.runtimeStatus) setStatus(saved.runtimeStatus, saved.runtimeStatus.startsWith("Error") ? "warn" : "ok");
  else setStatus(`${getPlatformName(tab.url)} tab detected.`, "ok");
}

$("save").addEventListener("click", async () => {
  const settings = normalizeForm();
  if (!settings.prompt) return setStatus("Enter a custom prompt first.", "warn");
  await chrome.storage.local.set(settings);
  await sendCommand("UPDATE_SETTINGS", settings);
});

$("start").addEventListener("click", async () => {
  const settings = normalizeForm();
  if (!settings.prompt) return setStatus("Enter a custom prompt first.", "warn");
  settings.enabled = true;
  $("enabled").checked = true;
  const ok = await sendCommand("START", settings);
  if (ok) {
    await chrome.storage.local.set(settings);
  } else {
    settings.enabled = false;
    $("enabled").checked = false;
    await chrome.storage.local.set({ enabled: false });
  }
});

$("pause").addEventListener("click", async () => {
  $("enabled").checked = false;
  const settings = normalizeForm();
  settings.enabled = false;
  await chrome.storage.local.set(settings);
  await sendCommand("PAUSE", settings);
});

$("stop").addEventListener("click", async () => {
  $("enabled").checked = false;
  const settings = normalizeForm();
  settings.enabled = false;
  await chrome.storage.local.set({ ...settings, roundsUsed: 0 });
  await sendCommand("STOP", settings);
});

$("enabled").addEventListener("change", async () => {
  const settings = normalizeForm();
  if (settings.enabled) {
    const ok = await sendCommand("START", settings);
    if (ok) {
      await chrome.storage.local.set(settings);
    } else {
      settings.enabled = false;
      $("enabled").checked = false;
      await chrome.storage.local.set({ enabled: false });
    }
  } else {
    await chrome.storage.local.set(settings);
    await sendCommand("PAUSE", settings);
  }
});

// Update when active tab changes in the browser (for Side Panel mode)
if (chrome.tabs && chrome.tabs.onActivated) {
  chrome.tabs.onActivated.addListener(() => {
    load();
  });
}
if (chrome.tabs && chrome.tabs.onUpdated) {
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.status === "complete") {
      load();
    }
  });
}

load();