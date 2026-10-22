# PromptLoop for ChatGPT (Chrome MV3) — Version 1.4.6

PromptLoop automatically inserts and sends follow-up prompts after each ChatGPT response appears complete, running in a dedicated sidebar.

## Install locally
1. Download and extract `PromptLoop.zip`.
2. Open `chrome://extensions` in Google Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the extracted `PromptLoop` folder containing `manifest.json`.
6. Open `https://chatgpt.com/` and reload the page if it was already open.
7. Click the PromptLoop toolbar icon, edit the prompt, choose a small **Max follow-ups** value (start with `1`), and click **Start**.

## Controls
- **Start**: starts a new run and resets the follow-up counter.
- **Pause**: pauses automation and preserves the counter.
- **Stop**: stops automation and resets the counter.
- **Auto-send off**: inserts the prompt but leaves it for manual review.
- **Delay**: how long the answer should remain unchanged before the extension treats it as complete. This is a heuristic, not an official ChatGPT completion signal.

## Important limitations
- This extension relies on ChatGPT's page DOM and is not an official OpenAI integration. Website changes may break response detection, editor insertion, or send-button selection.
- Test with **Max follow-ups = 1** first. Automatic mode may send messages without a separate confirmation. Do not use it for sensitive or consequential actions.
- It does not bypass usage limits, account restrictions, or safety systems.
- The content script only runs on `chatgpt.com` and `chat.openai.com`.
- Version 1.4.6 has passed local JSON and JavaScript syntax checks, but has not been end-to-end tested against a live ChatGPT session.

## Troubleshooting
- If the extension says the content script is not ready, reload the ChatGPT tab and reopen the popup.
- If a prompt is inserted but not sent, leave Auto-send off and send manually while checking the interface.
- If it loops unexpectedly, click **Stop** and reload the ChatGPT tab.


## Quick verification checklist
- [ ] Load the unpacked extension and reload ChatGPT.
- [ ] Turn **Auto-send off** and set **Max follow-ups = 1**.
- [ ] Start the extension, then submit a harmless test question in ChatGPT.
- [ ] Confirm that the follow-up is inserted only after the answer settles.
- [ ] Confirm it does not send while you have a draft in the composer.
- [ ] Stop the extension and confirm no additional follow-up is sent.
- [ ] Only after these checks, test Auto-send with a one-round limit.


## Version 1.4.6 (Sidebar & Loop Reliability Update)
- **Chrome Native Side Panel**: PromptLoop now docks directly into Chrome's native browser sidebar! When clicked, it opens on the right side of the screen without covering your ChatGPT conversation or prompts.
- **Custom Brand Icon**: Generated sleek neon gradient loop badge icon with full multi-resolution support (`16x16`, `48x48`, `128x128`).
- **Redesigned Modern Dark UI**: Crafted with Inter typography, glassmorphic cards, live pulsing status indicators, progress bar, and iOS-style toggle switches matching ChatGPT's aesthetic.
- **Fixed false draft detection**: ProseMirror placeholder elements and break tags (`.placeholder`, `[data-placeholder]`) are stripped during draft detection so they are no longer misidentified as user drafts that block sending.
- **Fixed ProseMirror rich-text insertion**: Added Clipboard/paste fallback and proper input event dispatching so React recognizes the inserted prompt and enables the Send button.
- **Added Send button wait loop**: Waits up to 1.5s for React to enable the Send button after text insertion before attempting form submission or keyboard fallbacks.
- **Resilient assistant message selectors**: Added support for modern ChatGPT `article[data-testid^="conversation-turn-"]` and `.markdown` structures so responses are accurately detected even if OpenAI alters role attributes.
- **Fixed initial Start wait**: When Start is clicked while ChatGPT is already generating, PromptLoop actively monitors that response and automatically sends the follow-up upon completion.
- **Expanded host permissions**: Added wildcard subdomain support for `https://*.chatgpt.com/*` and `https://*.openai.com/*`.

## Testing the Extension in Sidebar Mode
1. Open `chrome://extensions` and click the **Reload** (circular arrow) icon on PromptLoop.
2. Open `https://chatgpt.com/` and **reload the tab** (`F5`).
3. Click the PromptLoop extension icon in Chrome's top toolbar — it will immediately open docked in Chrome's native **Side Panel** on the right!
4. Notice your entire ChatGPT chat and prompt history remain 100% visible and unblocked.
5. Set your prompt and **Max follow-ups** (e.g. `3` or `10`), then click **Start**. The sidebar will show real-time countdowns and progress as it loops.
