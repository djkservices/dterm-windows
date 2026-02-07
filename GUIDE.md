# dTerm - Complete User Guide

A developer workspace combining terminal, file browser, code editor, FTP client, notes, live collaboration, network tools, and more — all in one window.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Interface Overview](#interface-overview)
3. [Title Bar](#title-bar)
4. [File Browser](#file-browser)
5. [Code Editor](#code-editor)
6. [Terminal](#terminal)
7. [Mini Browser](#mini-browser)
8. [Git Integration](#git-integration)
9. [Global Search](#global-search)
10. [Code Runner](#code-runner)
11. [Notes](#notes)
12. [Snippets](#snippets)
13. [Process Manager](#process-manager)
14. [Tools Panel](#tools-panel)
15. [AI Chat](#ai-chat)
16. [FTP Client](#ftp-client)
17. [Collaboration](#collaboration)
18. [Cloud Sync](#cloud-sync)
19. [Messaging & Contact](#messaging--contact)
20. [Workspaces](#workspaces)
21. [Settings](#settings)
22. [Command Palette](#command-palette)
23. [Keyboard Shortcuts](#keyboard-shortcuts)
24. [Auto-Updates](#auto-updates)
25. [Building & Releasing](#building--releasing)

---

## Getting Started

### Installation
1. Download the DMG from the admin panel or build from source
2. Drag **My Network Tools.app** to your Applications folder
3. Launch the app

### First Launch
On first launch you'll see a welcome screen:
- **Sign In** with an existing cloud account to sync your data
- **Register** to create a new account
- **Skip** to use dTerm without cloud sync

Your cloud account syncs notes, bookmarks, snippets, FTP connections, SSH connections, workspaces, and session data across devices.

---

## Interface Overview

dTerm has three main areas:

```
+------------------+----------------------------+
|                  |                            |
|   Left Panel     |      Code Editor           |
|   (sidebar)      |      (Monaco tabs)         |
|                  |                            |
|                  +----------------------------+
|                  |                            |
|                  |      Terminal Area          |
|                  |      (xterm tabs)           |
|                  |                            |
+------------------+----------------------------+
```

- **Left Panel** — Switchable tabs: Files, Browser, Git, Search, Terminal, Runner, Notes, Snippets, Processes, Tools, AI Chat, FTP, Collab
- **Code Editor** — Monaco editor with multi-tab support
- **Terminal** — Full terminal emulator with split panes

### Resizing Panels
- Drag the border between left panel and editor to resize
- **Cmd+Shift+B** — Toggle left sidebar visibility
- **Cmd+Shift+X** — Swap panel sizes (left vs right)
- **Cmd+Shift+F** — Focus mode (collapse all panels, full-screen editor or terminal)

---

## Title Bar

The title bar shows:

**Left side:**
- **FTP badge** — Appears when connected to an FTP server
- **Status file** — Name of the currently open file
- **Line/Column** — Cursor position in the editor

**Center:**
- **dTerm** title with version number (e.g. "dTerm v1.0.0")

**Right side:**
- **Cloud badge** — Click to open cloud sync menu (shows username when signed in)
- **Sync button** — Manual cloud sync
- **Notification bell** — Shows unread message count, pulses orange when new replies arrive
- **User avatar** — Profile photo or initials (click opens hamburger menu)
- **Hamburger menu** — Settings, Keyboard Shortcuts, Contact, About dTerm

---

## File Browser

The file browser is the default left panel tab.

### Toolbar
- **Home** — Navigate to your home directory
- **Up** — Go to parent directory
- **Open** — Open a folder via system dialog
- **Refresh** — Reload the current directory
- **Hidden** — Toggle showing hidden files (dotfiles)
- **Recent** — Dropdown of recently visited folders and files
- **Search** — Filter files by name in the current directory
- **+ File** — Create a new file
- **+ Folder** — Create a new folder

### Path Bar
Shows the full path as clickable breadcrumbs. Click any segment to navigate to that folder.

If the folder is a git repository, the current branch name appears next to the path.

A bookmark star (star icon) lets you pin the current folder for quick access.

### Bookmarks Bar
Pinned folders and files appear below the path bar. Click to navigate instantly. Click the X to remove a bookmark.

### File List
- **Single-click** a folder to navigate into it
- **Single-click** a file to open it in the editor
- **Right-click** for context menu: Open, Rename, Delete, Copy, Cut, Paste, Copy Path, Pin to Favorites, Compare with File
- **Hover** on an image file to see a thumbnail preview
- **Drag files** to the terminal to paste the file path
- **Drop files** from Finder to copy them into the current directory

### Git Status
When inside a git repo, files show status indicators:
- **M** — Modified
- **A** — Added/staged
- **D** — Deleted
- **?** — Untracked

---

## Code Editor

dTerm uses Monaco (the VS Code editor engine) with full syntax highlighting for 40+ languages.

### Editor Tabs
- Click a file in the browser to open it in a new tab
- Tabs show the filename with a colored language badge (JS, PY, TS, etc.)
- A dot indicator appears on tabs with unsaved changes
- Click the X to close a tab
- Drag tabs to reorder them
- **Cmd+W** closes the active tab

### Editing Features
- Full syntax highlighting, autocomplete, and IntelliSense
- **Cmd+F** — Find in file
- **Cmd+G** — Go to line
- **Cmd+S** — Save file
- **Cmd+Z / Cmd+Shift+Z** — Undo / Redo
- Auto-save triggers on changes

### Markdown Preview
When editing a `.md` file, a preview toggle appears:
- Click **Preview** to see rendered markdown
- Click **Editor** to go back to editing
- The preview updates live as you type

### File Comparison (Diff View)
Right-click a file and choose **Compare with File** to open a side-by-side diff view. Differences are highlighted. Click the X to close the diff view.

### Status Bar
The bottom bar shows:
- Current file name
- Line and column number (Ln X, Col Y)
- File language
- Git branch (if in a repo)

---

## Terminal

### Creating Terminals
- **Cmd+T** — New terminal tab
- Click the **+** button in the terminal tab bar
- Terminal opens in the current file browser directory

### Terminal Tabs
- Click tabs to switch between terminals
- Each tab shows the current working directory name
- Click X to close a terminal

### Split Panes
- **Cmd+\\** — Split vertically (side by side)
- **Cmd+Shift+\\** — Split horizontally (top and bottom)
- Click a pane to focus it (blue border appears)
- Drag the divider between panes to resize
- You can split any pane further for complex layouts

### Terminal Features
- Full color support (xterm-256color)
- **Cmd+F** — Search within terminal output (with Next/Prev/match count)
- **Right-click** for context menu: Copy, Paste, Clear, Split Vertical, Split Horizontal
- **Drag a file** from the file browser onto the terminal to paste its path
- Shell navigation: Cmd+Left (beginning of line), Cmd+Right (end of line), Cmd+Option+Left (word back), Cmd+Option+Right (word forward)

### SSH Connections
Access via the command palette (Cmd+Shift+P > "SSH Connection"):
- Enter host, port, username
- Save connections for quick access later
- Opens an SSH session in a new terminal tab

### Session Persistence
Terminals are saved when you quit dTerm and restored on next launch, including their working directory and scroll buffer.

---

## Mini Browser

A built-in web browser for quick reference without leaving dTerm.

### Controls
- **Back/Forward** — Browser history navigation
- **Refresh** — Reload the page
- **Home** — Go to your configured home page
- **URL bar** — Type a URL and press Enter

### Device Emulation
Switch between viewport sizes:
- **Desktop** — Full width
- **Tablet** — 768x1024
- **Mobile** — 375x667

The current viewport dimensions are shown as a label.

Configure the home page in Settings (default: DuckDuckGo).

---

## Git Integration

The Git panel shows the status of your current repository.

### Features
- **Branch display** — Current branch shown in the path bar and status bar
- **Changed files list** — Shows all modified, added, deleted, and untracked files
- **Commit message** — Enter a commit message in the textarea
- **Commit All** — Stage all changes and commit
- **Push** — Push commits to remote
- **Pull** — Pull from remote
- **Refresh** — Re-check git status

Click any changed file to open it in the editor.

---

## Global Search

Search across all files in your current directory.

### How to Use
1. Switch to the Search tab in the left panel
2. Enter your search query
3. Optionally enable **Regex** or **Case Sensitive**
4. Press Enter or click Search

### Results
- Results are grouped by file
- Each match shows the line number and matching text
- Click any result to open the file at that line in the editor
- Match count shown per file

---

## Code Runner

Detects your project type and provides one-click task execution.

### Supported Project Types
- **Node.js** — Runs npm scripts from package.json
- **Python** — pip install, Django management commands
- **Rust** — cargo run, build, test
- **Go** — go run, build, test
- **Docker** — docker build, run, compose up/down
- **Makefile** — Detected make targets

### Features
- **Run Current File** (Cmd+R) — Executes the active editor file
- **Task list** — Click any detected task to run it in the terminal
- **Custom command** — Enter any command to run
- **Autocomplete** — Suggests recent and common commands

---

## Notes

A built-in note-taking area using Monaco editor with markdown syntax highlighting.

- Write notes in the left panel Notes tab
- Notes auto-save after a short delay
- Notes sync to the cloud when signed in
- Full Monaco editor features (search, syntax highlighting, etc.)

---

## Snippets

Save and reuse code snippets.

### Managing Snippets
- Click **+ New** to create a snippet
- Enter a name, language, and code
- Click a snippet to insert it at the cursor in the active editor
- Click the pencil icon to edit
- Click the X to delete

Snippets sync to the cloud when signed in.

---

## Process Manager

Monitor running processes and listening ports.

### Process List
- Shows PID, CPU usage, memory, and command name
- **Search** to filter processes
- **Kill** button to terminate a process
- **Refresh** to update the list

### Ports
- Shows all listening ports with associated processes
- Useful for finding what's running on specific ports
- Click Refresh to update

---

## Tools Panel

A comprehensive collection of network, security, web, and developer tools.

### Network Tools
| Tool | Description |
|------|-------------|
| Ping | Ping a host with custom count |
| Traceroute | Trace the route to a host |
| DNS Lookup | Query DNS records (A, AAAA, MX, NS, TXT, CNAME, SOA, ANY) |
| Reverse DNS | Reverse IP lookup |
| Port Scanner | Scan specific ports on a host |
| IP Info | Geolocation and ISP info for an IP |
| Whois | Domain registration info |
| MAC Lookup | Find vendor by MAC address |
| Subnet Calculator | Calculate CIDR ranges and masks |
| Ping Monitor | Continuous ping with interval |
| Uptime Monitor | Check URL availability |
| Blacklist Check | RBL/DNSBL lookup |

### SSL & Security Tools
| Tool | Description |
|------|-------------|
| SSL Checker | Validate SSL certificates |
| SSL Expiry | Check certificate expiration |
| Security Headers | Analyze CSP, HSTS, X-Frame-Options, etc. |
| Password Generator | Generate passwords (configurable length, character sets) |
| Password Checker | Analyze password strength |
| Hash Generator | MD5, SHA-1, SHA-256, SHA-512 |

### Web & SEO Tools
| Tool | Description |
|------|-------------|
| SEO Analyzer | Page SEO analysis |
| Page Speed | Performance check |
| Broken Links | Find broken links on a page |
| HTTP Headers | View response headers |
| Open Graph | Check OG meta tags |
| Meta Tags | Extract all meta tags |
| Robots.txt | Fetch and view robots.txt |
| Sitemap Generator | Generate XML sitemap |
| Domain Expiry | Check domain expiration |

### Developer Tools
| Tool | Description |
|------|-------------|
| API Tester | Send HTTP requests (GET, POST, PUT, PATCH, DELETE, HEAD) with custom headers and body |
| JSON Formatter | Format or minify JSON |
| Code Beautifier | Beautify JavaScript, HTML, CSS |
| Regex Tester | Test regex patterns with live matching |
| Base64 | Encode/decode Base64 |
| JWT Decoder | Decode JWT tokens (header + payload) |
| Cron Parser | Validate and explain cron expressions |
| UUID Generator | Generate UUIDs in bulk |
| Timestamp Converter | Convert between Unix timestamps and human-readable dates |

### Other Tools
| Tool | Description |
|------|-------------|
| Environment Variables | View and search system env vars |
| Markdown Preview | Render markdown to HTML |
| Lorem Ipsum | Generate placeholder text |
| QR Generator | Create QR codes from text |
| Color Picker | Convert between HEX, RGB, HSL |

---

## AI Chat

Embedded AI chat interfaces. Switch between providers:
- **ChatGPT**
- **Claude**
- **Gemini**

Select a provider from the dropdown and the chat loads in a webview. Use it for quick questions without leaving dTerm.

---

## FTP Client

Full FTP client for managing remote files.

### Connecting
1. Switch to the FTP tab in the left panel
2. Enter host, port (default 21), username, and password
3. Click **Connect**
4. Save connections for quick access with the **Save** button

### Working with Remote Files
Once connected, the file browser switches to FTP mode (indicated by an "FTP" badge in the title bar):
- Browse remote directories
- Click files to download and open in the editor
- Right-click for context menu (Download, Delete, etc.)
- Create new folders on the remote server
- **Drag files from Finder** onto the file browser to upload them

### Disconnecting
Click **Disconnect** to end the FTP session and return to local file browsing.

Saved FTP connections sync to the cloud when signed in.

---

## Collaboration

Real-time collaborative editing with other dTerm users.

### Creating a Session
1. Switch to the Collab tab
2. Enter your username
3. Click **Generate Code** to create a 6-digit session code
4. Share the code with collaborators

### Joining a Session
1. Switch to the Collab tab
2. Enter your username
3. Enter the 6-digit session code
4. Click **Join**

### During a Session
- Connected users appear as dots with names
- A green pulsing indicator shows the session is active
- Edits sync in real-time between all participants
- The Collab tab shows a green dot when a session is active

### Ending a Session
- Click **End Session** (if you created it) or **Leave Session** (if you joined)

---

## Cloud Sync

Your dTerm cloud account keeps your data synced.

### What Syncs
- Notes
- FTP connections
- Folder and file bookmarks
- Recent folders and files
- Code snippets
- SSH connections
- Workspaces
- Session state (open files, terminals)

### How Sync Works
- **Auto-sync** — Changes sync automatically after you make them
- **Manual sync** — Click the sync button (circular arrow) in the title bar
- **Pull on login** — When you sign in, all your cloud data is pulled down

### Cloud Menu
Click the cloud badge in the title bar to:
- See your account info
- Trigger a manual sync
- Sign out

### Profile Photo
1. Go to **Settings** (Cmd+, or hamburger menu > Settings)
2. When signed in, a profile photo section appears at the top
3. Click **Change Photo** to select an image
4. Your photo appears in the title bar and in admin message views

---

## Messaging & Contact

Send messages to the dTerm admin team and receive replies.

### Sending a Message
1. Click **Contact** in the hamburger menu (or click the notification bell)
2. Select a subject type: Bug Report, Feature Request, Question, or Other
3. Optionally enter your email
4. Write your message
5. Click **Send**

### Viewing Replies
- The notification bell pulses orange and shows a count when you have new replies
- An OS notification pops up for new replies
- Click the bell to open Contact and see your messages
- Admin replies appear in green boxes below your messages

### Notification System
- **Bell icon** — Shows unread count badge
- **Toast notification** — Appears bottom-right in the app
- **OS notification** — Native macOS notification (click to focus dTerm)
- Checks for new replies every 60 seconds

---

## Workspaces

Save and restore your entire workspace layout.

### Saving a Workspace
1. Open the command palette (Cmd+Shift+P)
2. Search for "Save Workspace"
3. Enter a name for the workspace

### What Gets Saved
- Current folder path
- All open file tabs
- Active file
- Number of terminals
- Active left panel tab
- Panel states (collapsed/expanded)

### Loading a Workspace
1. Open the command palette (Cmd+Shift+P)
2. Search for "Load Workspace"
3. Select a saved workspace

The title bar updates to show "dTerm -- WorkspaceName" when a workspace is loaded.

### Deleting a Workspace
Use the command palette > "Delete Workspace" to remove saved workspaces.

Workspaces sync to the cloud when signed in.

---

## Settings

Open with **Cmd+,** or hamburger menu > Settings.

| Setting | Default | Description |
|---------|---------|-------------|
| Font Size | 14 | Editor and terminal font size |
| Shell | /bin/zsh | Default shell for new terminals |
| Browser Home | https://duckduckgo.com | Mini browser home page |
| Minimap | Off | Show code minimap in editor |

### Profile Photo
When signed in, a profile photo section appears at the top of settings. Click **Change Photo** to upload a new photo.

---

## Command Palette

Press **Cmd+Shift+P** (or **Cmd+P**) to open the command palette.

Type to search through all available commands. Use arrow keys to navigate and Enter to execute.

### Available Commands
| Command | Shortcut |
|---------|----------|
| New Terminal | Cmd+T |
| New File | — |
| New Folder | — |
| Open Folder | — |
| Save File | Cmd+S |
| Toggle Sidebar | Cmd+Shift+B |
| Swap Panel Sizes | Cmd+Shift+X |
| Focus Mode | Cmd+Shift+F |
| Split Terminal Vertical | Cmd+\\ |
| Split Terminal Horizontal | Cmd+Shift+\\ |
| Settings | Cmd+, |
| Keyboard Shortcuts | Cmd+/ |
| Search in Terminal | Cmd+F |
| Clear Terminal | — |
| Go Home | — |
| Refresh Files | — |
| Toggle Hidden Files | — |
| Notes | — |
| Tools | — |
| AI Chat | — |
| FTP | — |
| Run Current File | Cmd+R |
| Code Runner | — |
| Compare Files | — |
| Snippets | — |
| Processes | — |
| SSH Connection | — |
| Save Workspace | — |
| Load Workspace | — |
| Delete Workspace | — |

---

## Keyboard Shortcuts

Open the shortcut reference with **Cmd+/** or hamburger menu > Keyboard Shortcuts.

### Customizing Shortcuts

All keyboard shortcuts can be remapped to your preferred key combinations:

1. Open **Keyboard Shortcuts** (Cmd+/ or hamburger menu)
2. Click on any shortcut key badge to start recording
3. Press your desired key combination
4. The new shortcut saves automatically

Additional controls:
- Click the **✕** next to a customized shortcut to reset it to the default
- Click **Reset All** to restore all shortcuts to their defaults
- Conflict detection prevents you from assigning the same combo to two actions

Custom shortcuts sync to the cloud when signed in.

### File Operations
| Shortcut | Action |
|----------|--------|
| Cmd+S | Save file |
| Cmd+C | Copy file (in file browser) |
| Cmd+X | Cut file (in file browser) |
| Cmd+V | Paste file (in file browser) |

### Terminal
| Shortcut | Action |
|----------|--------|
| Cmd+T | New terminal |
| Cmd+W | Close tab |
| Cmd+F | Search in terminal |
| Cmd+\\ | Split vertical |
| Cmd+Shift+\\ | Split horizontal |
| Cmd+Left | Beginning of line |
| Cmd+Right | End of line |
| Cmd+Option+Left | Word back |
| Cmd+Option+Right | Word forward |

### Editor
| Shortcut | Action |
|----------|--------|
| Cmd+F | Find in file |
| Cmd+G | Go to line |
| Cmd+R | Run current file |

### Interface
| Shortcut | Action |
|----------|--------|
| Cmd+Shift+P | Command palette |
| Cmd+P | Command palette (alt) |
| Cmd+Shift+B | Toggle sidebar |
| Cmd+Shift+X | Swap panel sizes |
| Cmd+Shift+F | Focus mode |
| Cmd+Shift+L | Open left panel to % (configurable width) |
| Cmd+Shift+C | Close left panel |
| Cmd+, | Settings |
| Cmd+/ | Keyboard shortcuts |

### Left Panel Width Shortcut

The **Open left panel to %** shortcut (Cmd+Shift+L) opens the left panel to a specific percentage of the window width. You can configure the percentage directly in the Keyboard Shortcuts panel — a number input appears next to this shortcut where you can set any value from 10% to 90% (default: 40%).

### File Browser
| Shortcut | Action |
|----------|--------|
| Delete | Delete selected file |
| Backspace | Go up one directory |

---

## Auto-Updates

dTerm checks for updates automatically on launch.

### How It Works
1. On startup, dTerm checks the update server
2. If a new version is available, it downloads in the background
3. A green bar appears at the top: "Downloading update..."
4. Once downloaded, the bar changes to "Update ready!" with a **Restart Now** button
5. Click **Restart Now** to apply the update, or it will install automatically next time you quit

Your data is never affected by updates — all settings, notes, connections, and synced data are stored separately from the app.

---

## Building & Releasing

### Prerequisites
- Node.js 18+
- npm

### Development
```bash
cd "Documents/Mac - Projects/dTerm"
npm install
npm start
```

### Building for Distribution
Double-click **build-app.command** or run:
```bash
npm run build
```

This produces in the `dist/` folder:
- **My Network Tools-{version}-arm64.dmg** — macOS installer
- **My Network Tools-{version}-arm64-mac.zip** — App bundle (for auto-update)
- **latest-mac.yml** — Version manifest (for auto-update)

### Releasing an Update

**Automated deploy (recommended):**
1. Bump the version in `package.json`
2. Run `npm run deploy`
3. The script builds the app, uploads the ZIP and YML to the server, and updates the version in the admin database automatically
4. All dTerm instances will auto-update on next launch

**Manual deploy:**
1. Bump the version in `package.json`
2. Double-click `build-app.command`
3. When prompted "Upload update to server?", press **y**
4. The ZIP and YML files are uploaded to the update server

You can also upload manually via the **dTerm Admin** panel at `/dterm/admin/` under the "App Updates" section.

### Version Number
The version is defined in `package.json` and displayed in:
- The title bar (next to "dTerm")
- The About panel (hamburger menu > About dTerm)
- The admin dashboard stats
