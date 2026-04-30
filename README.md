<div align="center">
  <img src="vtm_banner.svg" alt="Voice Task Master" width="600" />

  <h1>VOICE-TASK-MASTER (VTM)</h1>
  <p><strong>v1.6.9 — Voice task capture for Flavortown.</strong></p>

  ![Version](https://img.shields.io/badge/version-1.6.9-10B981?style=flat-square)
  ![Manifest V3](https://img.shields.io/badge/manifest-MV3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
  ![JavaScript](https://img.shields.io/badge/JavaScript-vanilla-F7DF1E?style=flat-square&logo=javascript&logoColor=111)
  ![i18n](https://img.shields.io/badge/i18n-EN%20%7C%20PT--BR%20%7C%20ES%20%7C%20FR%20%7C%20JA%20%7C%20ZH-10B981?style=flat-square)
  ![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
  ![Flavortown](https://img.shields.io/badge/Hack%20Club-Flavortown-ec3750?style=flat-square)
</div>

## Overview

VOICE-TASK-MASTER is a Chrome extension for saving tasks while browsing Flavortown. It can capture notes by voice, attach them to the current project, and keep a small task panel available on the page.

The extension stores tasks locally in the browser. When a Flavortown API key is available in the page settings, VTM also registers extension usage with Flavortown using the official extension header.

## Features

| Feature | Description |
|:--|:--|
| Voice capture | `Ctrl+Shift+V` opens the voice overlay and saves recognized speech as a task. |
| Quick save | `Ctrl+Shift+S` saves the current project or selected text without confirmation. |
| Project context | Detects project pages and Explore cards, storing project name, project URL, and user profile URL when available. |
| Confirmation flow | When saving from another user's project, asks whether to save to that project, save globally, or cancel. |
| Floating panel | Shows current-project tasks and global tasks on Flavortown pages. |
| Collapsed bubble | The panel can collapse into a floating bubble and reopen on hover or click. |
| Themes | Includes built-in palettes and a custom accent color picker. |
| i18n | Uses browser language detection with EN, PT-BR, ES, FR, JA, and ZH support. |

## Hotkeys

| Shortcut | Action |
|:--|:--|
| `Ctrl+Shift+V` | Start voice capture |
| `Ctrl+Shift+S` | Quick-save current context |
| `Ctrl+K` | Focus the popup task input |
| `Enter` | Add a text task from the popup input |

## Install

1. Download `vtm-extension-code.zip` from the release or build output.
2. Extract the zip.
3. Open `chrome://extensions`.
4. Enable **Developer mode**.
5. Click **Load unpacked** and select the extracted folder.

For a packaged install, use `vtm-extension-code.crx`. Keep `vtm-extension-code.pem` private if you need future CRX builds to keep the same extension ID.

## Build Artifacts

The release package includes only runtime extension files:

```text
manifest.json
popup.html
popup.js
style.css
i18n.js
content.js
background.js
icon16.png
icon48.png
icon128.png
```

## Development

No build step is required.

```bash
git clone https://github.com/EngThi/voice-task-master
cd voice-task-master
node --check content.js
node --check popup.js
node --check background.js
node --check i18n.js
```

To create the zip:

```bash
python3 -c "import zipfile; files=['manifest.json','popup.html','popup.js','style.css','i18n.js','content.js','background.js','icon16.png','icon48.png','icon128.png']; z=zipfile.ZipFile('vtm-extension-code.zip','w',zipfile.ZIP_DEFLATED); [z.write(f,f) for f in files]; z.close()"
```

## Project

Built for Hack Club Flavortown.  
Project: [#4322](https://flavortown.hackclub.com)
