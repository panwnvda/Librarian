# Librarian

A local-first desktop workspace for security professionals. Build a structured library of techniques, attack maps, and engagement notes — everything lives on your own machine, no accounts, no servers, no telemetry.

---

## Overview

Librarian is built around two ideas: **pages** and **blocks**.

A page is a single document with its own title, font, accent colour, and freeform body. Pages are arranged in a sidebar tree you can nest and reorder by drag.

A block is a piece of structured content you drop into a page. Librarian ships with a small set of purpose-built blocks for offensive-security documentation alongside the usual markdown primitives — paragraphs, headings, lists, tables, code fences, quotes, and check-lists.

---

## Page Types

| Type | What it's for |
|---|---|
| **Notes** | A blank page surface for any combination of blocks — technique cards, maps, links, prose. |
| **Home** | A landing dashboard with an author card and a top-level map block. |
| **Text** | A focused long-form markdown editor for write-ups and reports. |
| **Resources** | A curated link and reference collection. |
| **Attack Chain** | A free-canvas map of hosts, pivots, and lateral movement paths. |

Every page can pick its own title font (35 typefaces — mono, sans, serif, display) and one of 16 accent colours.

---

## The Block Library

### `/card` — Technique Card

A collapsible card built around how an engagement actually plays out:

- **Overview** — free markdown for prerequisites, context, references.
- **Steps** — an ordered checklist. Tick steps as you execute; a progress bar tracks completion. New steps are added on demand from the toolbar.
- **Technical Notes** *(optional)* — labelled, syntax-highlighted code blocks for the commands, payloads, or scripts that go with the technique. One-click copy on every block. Supports bash, PowerShell, Python, SQL, Go, JavaScript, and many more languages.

Cards expand inline with a single click. The Edit button opens the full-screen editor — an auto-growing textarea that saves silently as you type, so context-switches never lose work. Right-click any selection inside a card for inline font, size, colour, and highlight controls. Title, subtitle, tag, and accent colour are all editable in place.

### `/map` — Attack Map

A horizontal, multi-column board. Each column is a phase, tactic, or kill-chain step; each cell inside is a technique entry with a title and subtitle. Drag entries between columns, link any entry to a page so a click jumps straight to the full write-up, and right-click any heading, title, or subtitle to set its font size from a typeable picker with presets.

Columns and entries are independently colourable, so a single map can carry visual structure across both axes.

### `/pagelink` — Page Link

A first-class inline reference to another page. Renders as a chip showing the target page's title, accent colour, and font, and jumps when clicked. Useful for stitching write-ups, indexes, and cross-references together without duplicating content.

---

## Editing

The editor is a block-based rich-text surface. Type `/` anywhere to open the block menu — headings, lists, tables, code, callouts, and the custom blocks above.

Right-click a selection for inline formatting:

- **Font family** — choose any of the 35 installed typefaces
- **Font size** — typeable number with quick presets
- **Text colour** — full colour picker with eyedropper
- **Highlight** — background colour with the same picker

Right-click anywhere with no selection for block-level actions (font, accent colour, title size) on the surrounding card, column, or page header.

Markdown inputs are sanitised on every read/write boundary: stray code fences are balanced, blank-line runs collapsed, zero-width characters stripped. Inline HTML produced by the formatting menu round-trips faithfully through save/reload.

---

## Workspace Export & Import

The whole workspace serialises to a single **`.library`** archive — a ZIP containing every page, block, card, map, and per-page setting.

- Use it to back up your library before a fresh install.
- Use it to move between Linux and Windows builds.
- Use it to share a curated playbook with a teammate — they import the archive and pick it up exactly where you left off.

Import is non-destructive by default and merges into the existing workspace.

---

## Quality-of-Life

- **Command palette** — `Ctrl+K` / `Cmd+K` to jump to any page by name.
- **Drag-and-drop** — reorder sidebar pages, technique cards, map entries, and code blocks.
- **Keyboard shortcuts** — `Ctrl+B` bold, `Ctrl+I` italic, `Ctrl+K` link inside text editors.
- **Zero telemetry** — all data is in IndexedDB with a localStorage cache. Nothing leaves the machine.

---

## Running Locally (Development)

**Prerequisites:** Node.js 18+

```bash
git clone https://github.com/YOUR_USERNAME/librarian.git
cd librarian
npm install
npm run dev
```

Opens at `http://localhost:5173`.

For the Electron build with hot reload:

```bash
npm run electron:dev
```

Starts Vite and Electron together; React source changes hot-reload without restarting the Electron process.

---

## Desktop App

Librarian ships as a native desktop application via Electron. Linux installers are built natively; the Windows installer is produced by the GitHub Actions CI pipeline.

### Download

Grab a build from the [Releases](../../releases) page:

| Platform | File | Notes |
|---|---|---|
| Linux | `Librarian-x.x.x.AppImage` | Portable — make executable and run directly |
| Linux | `librarian_x.x.x_amd64.deb` | Installs via `dpkg`, adds an application menu entry |
| Windows | `Librarian-Setup-x.x.x.exe` | NSIS installer with Start Menu and Desktop shortcuts |

### Linux — AppImage

```bash
chmod +x Librarian-x.x.x.AppImage
./Librarian-x.x.x.AppImage
```

### Linux — .deb

```bash
sudo dpkg -i librarian_x.x.x_amd64.deb
```

### Windows

Run `Librarian-Setup-x.x.x.exe` and follow the installer wizard. An uninstaller is included.

### Data Location

The desktop app stores all data inside the Electron user-data folder:

- **Linux:** `~/.config/Librarian/`
- **Windows:** `%APPDATA%\Librarian\`

Use `.library` export/import to migrate data between the desktop app and the browser, or between Linux and Windows installs.

---

## Building From Source

### Linux Packages

Produces an AppImage and a `.deb`. Must be run on Linux.

```bash
npm run build:linux
# Output: release/Librarian-x.x.x.AppImage
#         release/librarian_x.x.x_amd64.deb
```

### Windows Installer

The Windows build runs on GitHub Actions (Windows VM). Push a version tag to trigger it:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The workflow in `.github/workflows/release.yml` builds both Linux and Windows targets and attaches all artifacts to the GitHub Release.

To build the Windows installer locally on a Windows machine:

```bash
npm run build:win
# Output: release\Librarian-Setup-x.x.x.exe
```

### All Platforms in One Shot

```bash
npm run build:all
```

---

## Project Structure

```
src/
  blocks/             Custom block specs — CardBlock, MapBlock, PageLinkBlock,
                      and inline style specs (FontSize, FontFamily, TextColor, BgColor)
  components/         Shared UI — TechniqueCard, CodeBlock, MarkdownView,
                      CardEditorPage, EditorContextMenu, SizePicker, …
  pages/
    custom/           Page renderers — Notes, Home, Text, Resources, AttackChain
    Layout.jsx        App shell, sidebar, command palette
  lib/                Storage, sanitisation, file-format, page style options
  hooks/              usePageStorage, useDragScroll, useGlobalFont, …
electron/
  main.cjs            Electron main process
  preload.cjs         Context-isolated preload script
  icon.png / icon.ico App icons
.github/
  workflows/
    release.yml       CI pipeline — builds Linux + Windows on every version tag
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI framework | React 18, Vite 6 |
| Block editor | BlockNote (custom block specs and inline style specs) |
| Styling | Tailwind CSS, Radix UI primitives |
| Routing | react-router-dom (HashRouter for Electron compatibility) |
| Markdown | react-markdown, remark-gfm, remark-breaks, rehype-raw |
| Code highlighting | Shiki |
| Storage | IndexedDB + localStorage (custom persistence layer) |
| File format | JSZip (`.library` archive) |
| Desktop | Electron 42, electron-builder |
| Icons | lucide-react |
| Command palette | cmdk |

---

## License

MIT
