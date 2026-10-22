(() => {
  if (window.__promptLoopCleanup) {
    try { window.__promptLoopCleanup(); } catch (_) {}
  }
  window.__promptLoopLoaded = true;

  const DEFAULTS = {
    prompt: "Continue.",
    enabled: false,
    autoSend: true,
    maxRounds: 3,
    delay: 3,
    roundsUsed: 0
  };

  let settings = { ...DEFAULTS };
  let observer = null;
  let completionTimer = null;
  let running = false;
  let paused = true;
  let previousAssistantText = "";
  let handledResponseKey = "";
  let lastError = "";
  let operationId = 0;
  let responseMonitorId = 0;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function findComposer() {
    return document.querySelector('#prompt-textarea')
      || document.querySelector('div[contenteditable="true"].ProseMirror')
      || document.querySelector('[contenteditable="true"][data-placeholder]')
      || document.querySelector('[contenteditable="true"][role="textbox"]')
      || document.querySelector('textarea[placeholder]');
  }

  function getComposerText(composer) {
    if (!composer) return "";
    if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
      return composer.value.trim();
    }
    // Check ProseMirror empty state classes
    if (composer.classList.contains("is-empty") || composer.classList.contains("is-editor-empty")) {
      return "";
    }
    // Clone and strip placeholder elements so placeholder text is never mistaken for user input
    const clone = composer.cloneNode(true);
    clone.querySelectorAll('.placeholder, [data-placeholder], [aria-hidden="true"]').forEach(el => el.remove());
    return (clone.innerText || clone.textContent || "").replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  }

  function findSendButton() {
    const selectors = [
      'button[data-testid="send-button"]',
      'button[data-testid*="send" i]',
      'button[aria-label*="Send" i]',
      'button[title*="Send" i]'
    ];
    const candidates = selectors.flatMap(selector => Array.from(document.querySelectorAll(selector)));
    for (const button of [...new Set(candidates)]) {
      if (!button.disabled && button.getAttribute("aria-disabled") !== "true") return button;
    }
    const composer = findComposer();
    const scope = composer?.closest('form') || composer?.parentElement?.parentElement?.parentElement;
    if (scope) {
      for (const button of scope.querySelectorAll('button')) {
        const label = `${button.getAttribute("aria-label") || ""} ${button.getAttribute("title") || ""} ${button.getAttribute("data-testid") || ""}`;
        if (/send|submit/i.test(label) && !button.disabled && button.getAttribute("aria-disabled") !== "true") return button;
      }
    }
    return null;
  }

  async function waitForSendButton(maxWaitMs = 1500) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const button = findSendButton();
      if (button) return button;
      await sleep(100);
    }
    return null;
  }

  async function submitComposer(composer) {
    // Wait briefly for React / ProseMirror to enable the send button after text insertion
    const button = await waitForSendButton(1500);
    if (button) {
      button.click();
      return "button";
    }

    // Attempt form submit if present
    const form = composer.closest('form');
    if (form && typeof form.requestSubmit === "function") {
      try {
        form.requestSubmit();
        await sleep(500);
        if (isGenerating() || !getComposerText(composer)) return "form";
      } catch (_) {}
    }

    // Keyboard Enter fallback
    composer.focus();
    composer.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter", code: "Enter", keyCode: 13, which: 13,
      bubbles: true, cancelable: true
    }));
    composer.dispatchEvent(new KeyboardEvent("keypress", {
      key: "Enter", code: "Enter", keyCode: 13, which: 13,
      bubbles: true, cancelable: true
    }));
    composer.dispatchEvent(new KeyboardEvent("keyup", {
      key: "Enter", code: "Enter", keyCode: 13, which: 13,
      bubbles: true, cancelable: true
    }));
    await sleep(600);
    if (isGenerating() || !getComposerText(composer)) return "keyboard";
    throw new Error("Prompt was inserted, but ChatGPT did not accept Send. Check the page and try again.");
  }

  function isGenerating() {
    // 1. Specific Stop button selectors
    const selectors = [
      'button[data-testid="stop-button"]',
      'button[data-testid="stop-generating-button"]',
      'button[data-testid="fruitjuice-stop-button"]',
      'button[data-testid*="stop" i]',
      'button[aria-label="Stop generating" i]',
      'button[aria-label="Stop streaming" i]',
      'button[aria-label="Stop output" i]',
      'button[aria-label="Stop" i]',
      'button[title="Stop generating" i]',
      'button[title="Stop streaming" i]',
      'button[title="Stop" i]'
    ];
    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (button && !button.disabled && button.getAttribute("aria-disabled") !== "true") return true;
    }

    // 2. Active streaming classes
    if (document.querySelector('.result-streaming, [class*="result-streaming"]')) {
      return true;
    }

    // 3. Buttons inside the composer explicitly labeled Stop
    const composer = findComposer();
    const scope = composer?.closest('form') || composer?.parentElement?.parentElement?.parentElement;
    if (scope) {
      for (const btn of scope.querySelectorAll('button')) {
        if (btn.disabled || btn.getAttribute("aria-disabled") === "true") continue;
        const label = `${btn.getAttribute("aria-label") || ""} ${btn.getAttribute("title") || ""} ${btn.innerText || ""}`.trim();
        if (/^stop(\s+(generating|streaming|output))?$/i.test(label)) return true;
      }
    }

    return false;
  }

  function getAssistantMessages() {
    // Priority 1: Markdown containers in the conversation (standard ChatGPT assistant output)
    const markdowns = Array.from(document.querySelectorAll('.markdown, [class*="markdown"], .prose, [class*="prose"]')).filter(el => {
      return !el.closest('#prompt-textarea') && !el.closest('form');
    });
    if (markdowns.length > 0) return markdowns;

    // Priority 2: Message elements by role or turn attribute
    const roleNodes = Array.from(document.querySelectorAll('[data-message-author-role="assistant"], [data-turn="assistant"]'));
    if (roleNodes.length > 0) return roleNodes;

    // Priority 3: Conversation turns
    const turns = Array.from(document.querySelectorAll('[data-testid^="conversation-turn-"]'));
    if (turns.length > 0) {
      const assistantTurns = turns.filter(turn => {
        const isUser = turn.querySelector('[data-message-author-role="user"]') ||
                       turn.getAttribute('data-message-author-role') === 'user' ||
                       turn.querySelector('button[aria-label*="Edit" i]') ||
                       turn.querySelector('img[alt*="User" i]');
        return !isUser;
      });
      if (assistantTurns.length > 0) return assistantTurns;
    }

    // Priority 4: Assistant turns identified by Copy buttons
    const copyBtns = Array.from(document.querySelectorAll('button[aria-label*="Copy" i]'));
    if (copyBtns.length > 0) {
      const parents = copyBtns.map(b => b.closest('[data-testid^="conversation-turn-"]') || b.closest('article') || b.parentElement?.parentElement).filter(Boolean);
      if (parents.length > 0) return [...new Set(parents)];
    }

    return [];
  }

  function getLatestAssistantText() {
    const messages = getAssistantMessages();
    if (!messages.length) return "";
    const latest = messages[messages.length - 1];
    const target = latest.querySelector?.('.markdown, [class*="markdown"], .prose, [class*="prose"]') || latest;
    const clone = target.cloneNode(true);
    clone.querySelectorAll('button, svg, [role="button"]').forEach(el => el.remove());
    return (clone.innerText || clone.textContent || "").trim();
  }

  function responseKey(text) {
    return `${text.length}:${text.slice(0, 100)}:${text.slice(-180)}`;
  }

  function setStatus(status, extra = {}) {
    chrome.storage.local.set({
      runtimeStatus: status,
      runtimeStatusAt: Date.now(),
      ...extra
    }).catch(() => {});
  }

  async function insertPrompt(text) {
    const composer = findComposer();
    if (!composer) throw new Error("ChatGPT message input was not found. Reload the tab and try again.");

    composer.focus();
    if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
      const proto = composer instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) setter.call(composer, text);
      else composer.value = text;
      composer.dispatchEvent(new InputEvent("input", {
        bubbles: true, inputType: "insertText", data: text
      }));
      composer.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      composer.focus();
      const targetP = composer.querySelector('p') || composer;
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(targetP);
      selection.removeAllRanges();
      selection.addRange(range);

      let inserted = false;
      try {
        inserted = document.execCommand("insertText", false, text);
      } catch (_) {}

      // If execCommand failed or didn't populate text, try ClipboardEvent paste
      if (!inserted || getComposerText(composer) !== text.trim()) {
        try {
          const dt = new DataTransfer();
          dt.setData("text/plain", text);
          composer.dispatchEvent(new ClipboardEvent("paste", {
            bubbles: true,
            cancelable: true,
            clipboardData: dt
          }));
        } catch (_) {}
      }

      // If still not matching, update the paragraph node and dispatch beforeinput/input
      if (getComposerText(composer) !== text.trim()) {
        if (composer.querySelector('p')) {
          composer.querySelector('p').textContent = text;
        } else {
          composer.innerHTML = `<p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
        }
        composer.dispatchEvent(new InputEvent("beforeinput", {
          bubbles: true, cancelable: true, inputType: "insertText", data: text
        }));
        composer.dispatchEvent(new InputEvent("input", {
          bubbles: true, inputType: "insertText", data: text
        }));
      }
    }

    // Give React / ProseMirror time to reconcile and update internal state
    await sleep(350);
    const actual = getComposerText(composer);
    if (actual !== text.trim()) {
      throw new Error("Could not verify the inserted prompt. Nothing was auto-sent.");
    }
  }

  async function monitorNextResponse(thisOperation, baselineText, baselineCount, isInitial = false) {
    const monitorId = ++responseMonitorId;
    let sawActivity = isInitial;
    let lastText = baselineText;
    let lastCount = baselineCount;
    let stableSince = 0;
    const startedAt = Date.now();
    const timeoutAt = Date.now() + 30 * 60 * 1000;

    while (Date.now() < timeoutAt) {
      await sleep(400);
      if (monitorId !== responseMonitorId || thisOperation !== operationId || !settings.enabled || paused) return;

      const generating = isGenerating();
      const messages = getAssistantMessages();
      const text = getLatestAssistantText();
      const newAssistantTurn = messages.length > baselineCount;
      const textChanged = !!text && text !== baselineText;

      // If we see generating, a new message turn, or changing text, we saw activity
      if (generating || newAssistantTurn || textChanged) {
        sawActivity = true;
      }

      if (generating) {
        stableSince = 0;
        lastText = text;
        lastCount = messages.length;
        setStatus(`ChatGPT is responding (${settings.roundsUsed}/${settings.maxRounds})…`);
        continue;
      }

      // If after 2.5 seconds we haven't seen a Stop button, but prompt was sent and response exists:
      if (!sawActivity) {
        if (Date.now() - startedAt > 2500 && (textChanged || newAssistantTurn || text)) {
          sawActivity = true;
        } else {
          continue;
        }
      }

      // Detect actively streaming text
      if (text !== lastText || messages.length !== lastCount) {
        lastText = text;
        lastCount = messages.length;
        stableSince = 0;
        setStatus(`Waiting for response to finish…`);
        continue;
      }

      // Response text has settled
      if (!stableSince) stableSince = Date.now();
      const quietMs = Math.max(1500, (Number(settings.delay) || 3) * 1000);
      const elapsedStable = Date.now() - stableSince;

      if (elapsedStable < quietMs) {
        const remaining = Math.ceil((quietMs - elapsedStable) / 1000);
        setStatus(`Response settled. Sending follow-up ${settings.roundsUsed + 1}/${settings.maxRounds} in ${remaining}s…`);
        continue;
      }

      // Quiet period passed and response is complete
      if (settings.roundsUsed >= settings.maxRounds) {
        settings.enabled = false;
        paused = true;
        await chrome.storage.local.set({ enabled: false });
        setStatus(`Completed ${settings.roundsUsed}/${settings.maxRounds} follow-ups. Maximum reached.`);
        return;
      }

      previousAssistantText = text;
      handledResponseKey = responseKey(text);
      setStatus(`Sending follow-up ${settings.roundsUsed + 1}/${settings.maxRounds}…`);
      await sendPrompt();
      return;
    }

    if (monitorId === responseMonitorId && thisOperation === operationId && settings.enabled && !paused) {
      setStatus('Timed out waiting for a response to finish. Check ChatGPT, then press Start to retry.');
    }
  }

  async function sendPrompt() {
    if (!settings.enabled || paused || running || !settings.prompt.trim()) return;
    const thisOperation = operationId;
    if (settings.roundsUsed >= settings.maxRounds) {
      settings.enabled = false;
      paused = true;
      await chrome.storage.local.set({ enabled: false, runtimeStatus: "Maximum follow-ups reached." });
      return;
    }

    // Never overwrite an existing draft or send while ChatGPT is still generating.
    const composer = findComposer();
    const draft = getComposerText(composer);
    if (draft) {
      setStatus("Skipped: composer contains an existing draft. Clear it to continue.");
      return;
    }
    if (isGenerating()) {
      setStatus("ChatGPT is still generating. Waiting for it to finish…");
      return;
    }

    running = true;
    setStatus("Inserting follow-up prompt…");
    try {
      await insertPrompt(settings.prompt.trim());
      if (thisOperation !== operationId || !settings.enabled || paused) {
        setStatus("Cancelled before sending because automation was stopped.");
        return;
      }

      if (!settings.autoSend) {
        setStatus("Prompt inserted for review; auto-send is off.");
        return;
      }

      await sleep(250);
      if (thisOperation !== operationId || !settings.enabled || paused) {
        setStatus("Cancelled before sending because automation was stopped.");
        return;
      }

      const baseline = getLatestAssistantText();
      const baselineMessages = getAssistantMessages().length;
      const sendMethod = await submitComposer(composer);
      if (thisOperation !== operationId || !settings.enabled || paused) {
        setStatus("Cancelled after the send attempt because automation was stopped.");
        return;
      }
      settings.roundsUsed += 1;
      await chrome.storage.local.set({ roundsUsed: settings.roundsUsed });

      if (settings.roundsUsed >= settings.maxRounds) {
        settings.enabled = false;
        paused = true;
        await chrome.storage.local.set({ enabled: false });
        setStatus(`Sent follow-up ${settings.roundsUsed}/${settings.maxRounds}. Maximum reached; automation stopped.`);
      } else {
        previousAssistantText = baseline;
        handledResponseKey = responseKey(baseline);
        setStatus(`Sent follow-up ${settings.roundsUsed}/${settings.maxRounds} (${sendMethod}). Waiting for response…`);
        void monitorNextResponse(thisOperation, baseline, baselineMessages, false);
      }
    } catch (error) {
      lastError = error?.message || "Unknown error";
      console.warn("[PromptLoop] Could not complete follow-up", error);
      setStatus(`Error: ${lastError}`);
    } finally {
      running = false;
    }
  }

  function scheduleCompletionCheck() {
    clearTimeout(completionTimer);
    completionTimer = setTimeout(async () => {
      // If active polling monitor is currently tracking, do not duplicate actions
      if (responseMonitorId > 0) return;
      if (!settings.enabled || paused || running || isGenerating()) return;
      const text = getLatestAssistantText();
      if (!text || text === previousAssistantText) return;

      const key = responseKey(text);
      if (key === handledResponseKey) return;

      const quietMs = Math.max(1000, Math.min(15000, (Number(settings.delay) || 3) * 1000));
      const snapshot = text;
      await sleep(quietMs);
      if (!settings.enabled || paused || running || isGenerating()) return;

      const latest = getLatestAssistantText();
      if (latest !== snapshot) {
        scheduleCompletionCheck();
        return;
      }
      if (!latest || latest === previousAssistantText) return;

      handledResponseKey = responseKey(latest);
      previousAssistantText = latest;
      await sendPrompt();
    }, 600);
  }

  function observe() {
    if (observer) observer.disconnect();
    if (!document.body) {
      window.addEventListener("DOMContentLoaded", observe, { once: true });
      return;
    }
    observer = new MutationObserver(() => {
      if (responseMonitorId > 0) return; // monitorNextResponse is active
      const text = getLatestAssistantText();
      if (isGenerating()) return;
      if (text && text !== previousAssistantText) {
        scheduleCompletionCheck();
      }
    });
    observer.observe(document.body, {
      childList: true, subtree: true, characterData: true, attributes: true
    });
  }

  const messageListener = (message, _sender, sendResponse) => {
    if (message?.type === "PING") {
      sendResponse({ ok: true, version: "1.4.6" });
      return false;
    }
    if (message?.type !== "PROMPTLOOP_COMMAND") return false;
    (async () => {
      if (message.settings) {
        settings = { ...settings, ...message.settings };
      }
      const command = message.command;

      if (command === "START") {
        operationId++;
        responseMonitorId++;
        if (!settings.prompt.trim()) throw new Error("Enter a prompt before starting.");
        settings.enabled = true;
        paused = false;
        settings.roundsUsed = 0;
        previousAssistantText = getLatestAssistantText();
        handledResponseKey = "";
        const generating = isGenerating();
        await chrome.storage.local.set({ ...settings, enabled: true, roundsUsed: 0 });

        if (generating) {
          setStatus("ChatGPT is responding. Waiting for that response to finish before sending the follow-up.");
          sendResponse({ ok: true, message: "ChatGPT is responding. Waiting for it to finish; the follow-up will then be sent." });
          const baseline = getLatestAssistantText();
          const baselineMessages = getAssistantMessages().length;
          void monitorNextResponse(operationId, baseline, baselineMessages, true);
        } else {
          setStatus("No response is running. Sending the configured prompt now…");
          sendResponse({ ok: true, message: "No response is running. Sending the configured prompt now." });
          setTimeout(() => { void sendPrompt(); }, 0);
        }
      } else if (command === "PAUSE") {
        operationId++;
        responseMonitorId++;
        paused = true;
        settings.enabled = false;
        clearTimeout(completionTimer);
        await chrome.storage.local.set({ enabled: false });
        setStatus("Paused.");
        sendResponse({ ok: true, message: "Paused. Settings and counter are preserved." });
      } else if (command === "STOP") {
        operationId++;
        responseMonitorId++;
        paused = true;
        settings.enabled = false;
        clearTimeout(completionTimer);
        settings.roundsUsed = 0;
        await chrome.storage.local.set({ enabled: false, roundsUsed: 0 });
        setStatus("Stopped. Counter reset.");
        sendResponse({ ok: true, message: "Stopped. Follow-up counter reset." });
      } else if (command === "UPDATE_SETTINGS") {
        await chrome.storage.local.set(settings);
        setStatus("Settings saved.");
        sendResponse({ ok: true, message: "Settings saved." });
      } else {
        sendResponse({ ok: false, message: "Unknown command." });
      }
    })().catch(error => {
      setStatus(`Error: ${error.message}`);
      sendResponse({ ok: false, message: error.message });
    });
    return true;
  };

  chrome.runtime.onMessage.addListener(messageListener);

  window.__promptLoopCleanup = () => {
    if (observer) observer.disconnect();
    if (completionTimer) clearTimeout(completionTimer);
    running = false;
    paused = true;
    operationId++;
    responseMonitorId++;
    try {
      chrome.runtime.onMessage.removeListener(messageListener);
    } catch (_) {}
  };

  chrome.storage.local.get(DEFAULTS).then(saved => {
    settings = { ...DEFAULTS, ...saved };
    paused = !settings.enabled;
    previousAssistantText = getLatestAssistantText();
  }).catch(error => console.warn("[PromptLoop] Could not load settings", error));

  observe();
})();
