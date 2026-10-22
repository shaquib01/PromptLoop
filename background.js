// Background service worker for PromptLoop
// Enables Chrome native Side Panel behavior when clicking the extension action icon

async function injectIntoExistingTabs() {
  try {
    const tabs = await chrome.tabs.query({
      url: [
        "https://chatgpt.com/*",
        "https://*.chatgpt.com/*",
        "https://chat.openai.com/*",
        "https://*.openai.com/*"
      ]
    });
    for (const tab of tabs) {
      if (tab.id) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"]
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn("[PromptLoop] Auto-injection on install failed:", err);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((err) => console.warn("[PromptLoop] sidePanel behavior error:", err));
  }
  injectIntoExistingTabs();
});
