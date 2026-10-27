<p align="center">
  <img src="banner.png" alt="PromptLoop for ChatGPT & Google Gemini Banner" width="100%">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white" alt="Chrome Extension">
  <img src="https://img.shields.io/badge/Manifest-V3-success" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Version-1.5.0-blue" alt="Version 1.5.0">
  <img src="https://img.shields.io/badge/OpenAI-ChatGPT-74aa9c?logo=openai&logoColor=white" alt="ChatGPT">
  <img src="https://img.shields.io/badge/Google-Gemini-8E75C2?logo=googlegemini&logoColor=white" alt="Gemini">
</p>

<h1 align="center">PromptLoop for ChatGPT & Google Gemini</h1>

<p align="center">
  <strong>Automated follow-up prompting in Chrome's native Side Panel — hands-free conversation continuation for ChatGPT and Google Gemini.</strong>
</p>

---

## 🌟 Overview

**PromptLoop** is a lightweight, high-performance Chrome extension (Manifest V3) that docks into Google Chrome's native **Side Panel**. It automatically detects when **ChatGPT** or **Google Gemini** completes an answer, counts down your configured delay, and submits your custom follow-up prompt without manual intervention.

Because it runs in Chrome's dedicated browser sidebar, your entire conversation stays 100% visible and unblocked.

<p align="center">
  <img src="visual_guide.png" alt="PromptLoop Visual Guide and Architecture" width="100%">
</p>

---

## ✨ Features

- **Dual Platform Support**: Seamlessly works on both **ChatGPT** (`chatgpt.com`, `chat.openai.com`) and **Google Gemini** (`gemini.google.com`).
- **Chrome Native Side Panel**: Docks alongside your chat window — no floating popups blocking your view.
- **Automated Follow-ups**: Configurable rounds and settle delays before submitting the next prompt.
- **Smart Completion Monitor**: Detects streaming state, dynamic Stop buttons (`"Stop response"`, `"Stop generating"`), and quiet settlement periods before proceeding.
- **Shadow DOM & Framework Resilient**: Pierces Gemini's custom `<rich-textarea>` (shadow & light DOM) and bypasses ChatGPT's ProseMirror placeholder states using multi-strategy event dispatching.
- **Thinking / Reasoning Filtering**: Intelligently ignores internal model reasoning blocks (such as Gemini `<model-thoughts>`) to focus purely on the completed output.
- **Safe Draft Detection**: Skips auto-sending if you have an unsubmitted draft typed in the composer.
- **Self-Healing Connection**: Automatic script injection via `chrome.scripting` ensures the sidebar stays connected across tabs and after reloads.
- **Sleek Modern Dark UI**: Glassmorphic styling, pulse indicator, live countdown timer, and progress bar.

---

## 🚀 Installation

### Option 1: Download from GitHub Releases (Recommended)
1. Go to the [Releases](https://github.com/shaquib01/PromptLoop/releases) tab on GitHub.
2. Download `PromptLoop-v1.5.0.zip` and extract it to a folder on your computer.
3. Open `chrome://extensions` in Google Chrome.
4. Enable **Developer mode** (toggle in the top-right corner).
5. Click **Load unpacked** and select the extracted folder (the one containing `manifest.json`).

### Option 2: Clone via Git
```bash
git clone https://github.com/shaquib01/PromptLoop.git
```
Then load the folder via `chrome://extensions` using **Load unpacked**.

---

## 🎮 How to Use

1. Open [chatgpt.com](https://chatgpt.com/) or [gemini.google.com](https://gemini.google.com/) in your browser.
2. Click the **PromptLoop** icon in your Chrome extensions toolbar — it will immediately open in Chrome's **Side Panel** on the right.
3. Set your custom prompt (e.g., `"Continue."`, `"Proceed with the next step."`).
4. Set your **Max follow-ups** (e.g., `3`) and **Wait after response** delay (e.g., `3 sec`).
5. Click **▶ Start**. PromptLoop will monitor the AI output and trigger the follow-up loops automatically!

---

## 🎛️ Controls & Settings

| Control | Description |
| :--- | :--- |
| **Start** | Begins automation and resets the follow-up round counter. |
| **Pause** | Pauses automation and preserves the current round count. |
| **Stop** | Halts automation immediately and resets the round counter to 0. |
| **Automation Enabled** | Master switch to toggle automatic looping on or off. |
| **Automatically Press Send** | When ON, automatically clicks Send. When OFF, inserts text for manual review. |
| **Max Follow-ups** | Upper limit of automated rounds before stopping (default: 3). |
| **Wait After Response** | Seconds of quiet time after streaming finishes before sending the prompt. |

---

## 🛡️ Privacy & Security

- **100% Client-Side**: PromptLoop runs purely in your local browser sandbox.
- **Zero Telemetry**: No user data, chats, API keys, or prompt content are ever tracked, logged, or sent to external servers.
- **Restricted Host Permissions**: Limited strictly to `chatgpt.com`, `openai.com`, and `gemini.google.com` via Manifest host permissions.

---

## 📝 Changelog

### v1.5.0
- **Google Gemini Compatibility**: Added full support for `gemini.google.com`.
- **Shadow DOM Traversal**: Supports Gemini's `<rich-textarea>` input component across shadow root boundaries.
- **Dynamic Action Detection**: Added listeners for Gemini's dynamic `"Stop response"` button and streaming states.
- **Thinking Filter**: Automatically excludes `<model-thoughts>` reasoning tags from response settlement calculations.
- **Context-Aware Sidebar**: Updated diagnostics, tab detection, and status messaging for both ChatGPT and Gemini.

### v1.4.6
- Chrome native sidebar integration via Side Panel API.
- ProseMirror and React DOM event synchronization.
- Automatic reconnect and script injection.

---

## ⚠️ Notes & Disclaimer

- PromptLoop interacts with the client-side DOM of ChatGPT and Gemini and is **not** an official OpenAI or Google product. Changes to their frontend structures may require extension updates.
- Always begin testing with a small limit (**Max follow-ups = 1 or 2**) before running extended loops.
- Do not use automated loops for sensitive, financial, or critical data modifications.

---

## 📄 License

This project is licensed under the MIT License.
