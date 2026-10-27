# PromptLoop v1.5.0 Release Notes

## 🎉 What's New in v1.5.0: Google Gemini Support

PromptLoop now officially supports **Google Gemini** alongside **OpenAI ChatGPT**! You can now run automated follow-up prompt loops directly in Chrome's native Side Panel across both major AI platforms.

---

### ✨ Key Highlights

- **Google Gemini Compatibility**:
  - Full support for `https://gemini.google.com/*`.
  - Native integration with Gemini's custom `<rich-textarea>` web component, supporting both shadow DOM boundary traversal and light DOM structures.
  - Smart stop-detection for Gemini's dynamic `"Stop response"` action button and streaming indicators.
  - Model response tracking targeting `<model-response>` turns with automatic filtering of collapsed reasoning blocks (`<model-thoughts>`).
  - Framework-resilient event dispatching (`InputEvent`, `beforeinput`, `change`, and `execCommand`) ensuring Gemini's Send button activates reliably.

- **Unified ChatGPT & Gemini Experience**:
  - Automatically identifies whether you are currently on ChatGPT or Gemini and adjusts selectors and diagnostics accordingly.
  - Displays context-aware tab detection and status badges in the sidebar.

- **Enhanced Robustness & Self-Healing**:
  - Auto-injection updated for both ChatGPT and Gemini tabs on installation and extension reload.
  - Zero-width character sanitization and safe draft detection prevent accidental overwrites.

---

### 📦 Installation & Upgrade

1. Download **`PromptLoop-v1.5.0.zip`** from this release.
2. Unzip the archive to a folder on your computer.
3. Open `chrome://extensions` in Google Chrome.
4. Enable **Developer mode** in the top-right corner.
5. Click **Load unpacked** and select the unzipped folder.
6. Open [ChatGPT](https://chatgpt.com) or [Google Gemini](https://gemini.google.com) and click the PromptLoop icon in your extensions toolbar!
