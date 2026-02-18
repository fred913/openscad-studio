# OpenSCAD Studio — Feature Roadmap v2

> Current version: **v0.4.0** (Phases 1–3 complete, Phase 4 partially complete)
>
> This roadmap replaces the Phase 5+ sections of the original ROADMAP.md. Phases 1–3 are historical and remain unchanged. Phase 4 is partially complete. Everything below represents the forward-looking plan based on a full codebase review.

---

## Ordering Principles

1. **Quick wins first.** Small changes that dramatically improve perceived quality ship before large features.
2. **AI is the moat.** The AI copilot is the reason someone chooses this over the stock OpenSCAD editor. Every phase deepens that advantage.
3. **Architecture before features.** Structural debt (App.tsx size, error handling, missing tests) is addressed early so later features don't compound the mess.
4. **Desktop-first, web-ready.** ARCHITECTURE.md defines a platform abstraction layer. Refactors in this roadmap move toward that interface without blocking desktop progress.

---

## Phase 4A: Quick Wins & Polish (~1 week)

**Goal:** Ship the changes with the highest impact-to-effort ratio. These are all independently shippable and can be merged in any order.

### 4A.1: Toast Notification System
- [ ] Add a toast library (`sonner` or `react-hot-toast`)
- [ ] Replace all `alert()` calls with non-blocking toasts:
  - `App.tsx`: file open/save/export errors (lines 435, 589, 748)
  - `AiPromptPanel.tsx`: checkpoint restore error (line 175)
- [ ] Replace `confirm()` with Tauri native dialogs (already partially done) or styled modal
- [ ] Categorize toasts: `success` (green), `error` (red), `info` (neutral)
- [ ] Auto-dismiss success toasts after 3s; errors persist until dismissed

### 4A.2: Markdown Rendering in AI Chat
- [ ] Add `react-markdown` + `remark-gfm` + `react-syntax-highlighter`
- [ ] Render assistant messages as markdown instead of `whitespace-pre-wrap font-mono`
- [ ] OpenSCAD code blocks get syntax highlighting
- [ ] Inline code, bold, lists, headers all render properly
- [ ] Keep user messages as plain text (they're prompts, not prose)

### 4A.3: Auto-Render on Idle
- [ ] Add debounced auto-render (500ms after last keystroke) as a setting
- [ ] Default: **off** (preserves current explicit-render behavior)
- [ ] Setting toggle in `SettingsDialog.tsx` → Editor tab
- [ ] When enabled: `useOpenScad` watches source changes, debounces, calls `doRender`
- [ ] Cancel in-flight render if source changes before completion
- [ ] Visual indicator: subtle "auto-rendering..." badge (reuse existing rendering spinner)

### 4A.4: Strip Debug Logging
- [ ] Remove or gate behind `import.meta.env.DEV` all `console.log` statements in:
  - `useAiAgent.ts` (~30 log statements)
  - `AiPromptPanel.tsx` (~10 log statements)
  - `useOpenScad.ts` (~8 log statements)
  - `App.tsx` (~6 log statements)
  - `Editor.tsx` (~4 log statements)
- [ ] Keep `console.error` and `console.warn` for genuine error paths

### 4A.5: Smart Welcome Screen
- [ ] Check `has_api_key` on mount
- [ ] If no API key: hide the AI prompt textarea, show a setup CTA instead ("Set up AI to get started" → opens Settings → AI tab)
- [ ] Keep example prompts visible but disabled, with tooltip: "Configure an API key in Settings to use AI"
- [ ] Always show "Open File" and "Start with empty project" prominently
- [ ] Show recent files regardless of API key status

### 4A.6: ECHO Output in Console
- [ ] Currently, ECHO messages are filtered out of diagnostics in `PanelComponents.tsx` (line 19: `diagnostics.filter(d => !d.message.match(/^ECHO:/i))`)
- [ ] Create a separate "Output" section in `DiagnosticsPanel` for ECHO messages
- [ ] Display ECHO messages with a distinct icon/color (not error red)
- [ ] Preserve chronological order

**Success criteria:** App feels polished. No more browser `alert()` popups. AI chat looks professional. Debugging output is clean.

---

## Phase 4B: Architecture Cleanup (~1 week)

**Goal:** Reduce structural debt so subsequent features don't fight the codebase. No user-visible changes.

### 4B.1: Decompose App.tsx (1189 lines → <300)
- [ ] Extract `useFileManager` hook:
  - `saveFile`, `checkUnsavedChanges`, `handleOpenFile`, `handleOpenRecent`
  - File dialog interactions, unsaved changes prompts
- [ ] Extract `useTabManager` hook:
  - `createNewTab`, `switchTab`, `closeTab`, `updateTabContent`, `reorderTabs`
  - Tab state, active tab tracking
- [ ] Extract `useMenuListeners` hook:
  - All `listen('menu:file:*')` event registrations
  - All `listen('render-requested')` and `listen('history:restore')` registrations
- [ ] Extract `useKeyboardShortcuts` hook:
  - `⌘K`, `⌘,`, `⌘T`, `⌘W` handlers
- [ ] App.tsx becomes: composition of hooks + JSX layout only
- [ ] Eliminate the 7+ refs-as-state pattern by moving state to hooks

### 4B.2: React Error Boundaries
- [ ] Create `<PanelErrorBoundary>` component
- [ ] Wrap each dockview panel (Editor, Preview, AI Chat, Console, Customizer, Diff) in a boundary
- [ ] Error boundary shows: "This panel encountered an error" + "Reload Panel" button
- [ ] Prevents a crash in one panel from taking down the entire app
- [ ] Log errors to `console.error` with component stack

### 4B.3: Centralized State Management
- [ ] Evaluate whether `zustand` or a context-based approach would reduce the ref-heavy patterns
- [ ] At minimum: create a `useEditorState` zustand store for the source/diagnostics/preview state that both `useOpenScad` and `useAiAgent` share
- [ ] Eliminate the `EditorState` duplication between frontend React state and backend Rust `EditorState`
  - Currently both sides maintain separate copies and sync via IPC
  - Backend should be the source of truth; frontend reads via events

### 4B.4: Platform Abstraction (Phase 1 from ARCHITECTURE.md)
- [ ] Create `packages/platform/` package with `Platform` interface (types only)
- [ ] Create `TauriPlatform` implementation wrapping existing `api/tauri.ts` + `invoke` calls
- [ ] Wire up `PlatformProvider` in `main.tsx`
- [ ] Refactor `useOpenScad.ts` to use `usePlatform().rendering.*`
- [ ] Refactor `useAiAgent.ts` to use `usePlatform().ai.*`
- [ ] Delete `apps/ui/src/api/tauri.ts` (replaced by platform package)
- [ ] Verify: desktop works identically, zero functional changes

**Success criteria:** App.tsx is under 300 lines. No component can crash the whole app. State flows are clear. Platform abstraction exists.

---

## Phase 5: AI Experience (~2 weeks)

**Goal:** Make the AI copilot competitive with Cursor/Copilot-level UX. This is the app's differentiator.

### 5.1: Conversation History Sidebar
- [ ] Add "Conversations" as a dockview panel option (alongside Editor, Preview, AI, Console)
- [ ] List saved conversations with title, date, message count
- [ ] Click to load a conversation
- [ ] Delete conversations with confirmation
- [ ] Search across conversation titles
- [ ] Backend already supports `save_conversation`, `load_conversations`, `delete_conversation`
- [ ] Frontend just needs the UI — `loadConversation` already exists in `useAiAgent`

### 5.2: Image Input for AI
- [ ] Add image paste/drag-drop support to the AI prompt textarea
- [ ] Support: clipboard paste, file drag-drop, file picker button
- [ ] Convert images to base64 for API transmission
- [ ] Display image thumbnails in the message history
- [ ] Send as `image` content blocks to Anthropic API / OpenAI vision API
- [ ] Use case: "Make something like this" with a photo/sketch reference
- [ ] Backend change: extend `send_ai_query` message format to support image content blocks

### 5.3: Multi-File Project Context for AI
- [ ] Parse `use`/`include` statements from current file
- [ ] Resolve referenced files relative to `working_dir`
- [ ] Read referenced file contents
- [ ] Include referenced files in the AI system prompt as context:
  ```
  The user's project includes these files:
  --- utils.scad ---
  [contents]
  --- main.scad (active) ---
  [contents]
  ```
- [ ] Add an `explore_project` AI tool that lists files in the working directory
- [ ] Limit context to files actually referenced (don't dump entire directories)

### 5.4: AI Prompt Templates
- [ ] Create a prompt template system with categories:
  - **Generate**: "Create a parametric enclosure", "Design a gear with N teeth"
  - **Fix**: "Fix compilation errors", "Optimize for 3D printing"
  - **Modify**: "Add fillets to all edges", "Make this parametric", "Add mounting holes"
  - **Explain**: "Explain this code", "What does this module do?"
- [ ] Template picker accessible from AI prompt area (button or `/` command)
- [ ] Templates inject into prompt textarea, user can edit before sending
- [ ] Store templates as JSON in app resources (not user-editable initially)

### 5.5: Configurable Edit Size Limit
- [ ] Move the 120-line edit limit from hardcoded to a setting
- [ ] Default: 120 lines (current behavior)
- [ ] Allow increase to 250 or 500 for users who want full-file generation
- [ ] Setting in `SettingsDialog.tsx` → AI tab
- [ ] Update `validate_edit()` in `ai_tools.rs` to read from settings

**Success criteria:** AI chat renders beautifully. Users can reference images and past conversations. AI understands multi-file projects. Common operations are one-click.

---

## Phase 6: 3D Viewer & CAD Features (~2 weeks)

**Goal:** Make the 3D viewer competitive with dedicated CAD preview tools.

### 6.1: Adaptive Render Resolution
- [ ] Replace hardcoded 800x600 with actual panel dimensions
- [ ] Use `ResizeObserver` on the preview panel to track size
- [ ] Pass dynamic `{ w, h }` to `renderPreview`
- [ ] Cap at 2x device pixel ratio for retina displays
- [ ] Debounce resize-triggered re-renders (300ms)

### 6.2: Section/Clipping Plane
- [ ] Add a toggle button to the 3D viewer toolbar: "Section Plane"
- [ ] When enabled: render a draggable clipping plane using `THREE.Plane`
- [ ] Controls: drag to move plane position, rotate to change orientation
- [ ] Useful for inspecting hollow objects, internal cavities, fit checks
- [ ] Three.js `clippingPlanes` on material is the standard approach

### 6.3: Color Support from OpenSCAD
- [ ] Parse `color()` calls from OpenSCAD source code
- [ ] When rendering STL: OpenSCAD doesn't embed colors, so this requires either:
  - Option A: Use AMF/3MF format (supports colors) for preview instead of STL
  - Option B: Parse color from source and apply to Three.js materials by geometry group
- [ ] Evaluate AMF/3MF support in Three.js loaders
- [ ] Minimum viable: single-color override from first `color()` call in source

### 6.4: Measurement Tools
- [ ] Point-to-point distance measurement:
  - Click two points on the mesh surface
  - Display distance with a line and label
  - Snap to vertices
- [ ] Bounding box dimensions:
  - Toggle to show X/Y/Z extent labels
  - Display total size in current units
- [ ] Three.js raycasting for point picking

### 6.5: Special Operator Preview
- [ ] Support OpenSCAD debug operators: `#` (highlight), `%` (transparent), `*` (disable), `!` (show only)
- [ ] This requires parsing the source for operators and communicating them to the renderer
- [ ] `#` highlighted objects: render with a distinct color/transparency
- [ ] `%` background objects: render with low opacity
- [ ] May require multiple render passes or creative use of OpenSCAD `--colorscheme`

**Success criteria:** Preview adapts to panel size. Users can inspect internal geometry. Measurement tools exist for verifying dimensions.

---

## Phase 7: Editor Intelligence (~1.5 weeks)

**Goal:** Make the code editor smarter than stock OpenSCAD.

### 7.1: Static Linting
- [ ] Implement basic linting rules (no external process needed):
  - Undefined variable references
  - Unused variable warnings
  - Module arity mismatches (wrong number of arguments)
  - Deprecated function usage
- [ ] Use Tree-sitter AST (already available for formatting) for analysis
- [ ] Display as Monaco warning markers (alongside OpenSCAD compile errors)
- [ ] Linting runs on idle (debounced), not on every keystroke

### 7.2: Go-to-Definition
- [ ] `Cmd+Click` / `F12` on module/function names jumps to definition
- [ ] Works within the current file
- [ ] Works across `use`/`include` files (resolve to file, open in new tab)
- [ ] Uses Tree-sitter to find definition sites
- [ ] Register as Monaco `DefinitionProvider`

### 7.3: Hover Documentation
- [ ] Hover over built-in functions (`cube`, `sphere`, `translate`, etc.) shows documentation
- [ ] Include: signature, parameter descriptions, example
- [ ] Source: embed OpenSCAD cheat sheet data as JSON
- [ ] Hover over user-defined modules shows the module signature
- [ ] Register as Monaco `HoverProvider`

### 7.4: Improved Autocomplete
- [ ] Context-aware completions:
  - Inside `translate([...])` → suggest coordinate patterns
  - After `$fn =` → suggest common values (32, 64, 128)
  - Inside `color("...")` → suggest named colors with preview swatches
- [ ] Complete user-defined module and function names
- [ ] Complete variable names from current scope
- [ ] Complete parameter names for known modules
- [ ] Rank by usage frequency

**Success criteria:** Editor catches errors before compilation. Navigation within projects is fast. Autocomplete is genuinely useful beyond snippet insertion.

---

## Phase 8: Cross-Platform & Distribution (~2 weeks)

**Goal:** Ship to real users on all platforms.

### 8.1: Windows Support
- [ ] Test OpenSCAD detection on Windows (`where openscad`, common install paths)
- [ ] Fix path handling (backslashes, drive letters)
- [ ] Verify keyboard shortcuts (Ctrl vs ⌘)
- [ ] MSI installer via Tauri bundler
- [ ] Code signing with Windows certificate
- [ ] Test on Windows 10 and 11

### 8.2: Linux Support
- [ ] Test OpenSCAD detection on Linux (`which openscad`, package manager paths)
- [ ] AppImage build
- [ ] .deb package for Ubuntu/Debian
- [ ] Test on Ubuntu 22.04 and Fedora 39
- [ ] Verify file dialogs work with various desktop environments

### 8.3: Auto-Update
- [ ] Enable Tauri's built-in updater plugin
- [ ] Set up update server (GitHub Releases as update source)
- [ ] In-app update notification: "A new version is available" with changelog
- [ ] One-click update + restart

### 8.4: CI/CD Pipeline
- [ ] GitHub Actions workflow:
  - Build on macOS, Windows, Linux
  - Run TypeScript type checking
  - Run formatter tests
  - Run `pnpm audit` for dependency security
- [ ] Automated release builds on tag push
- [ ] Upload artifacts to GitHub Releases

### 8.5: E2E Test Suite
- [ ] Set up Playwright or WebdriverIO for Tauri app testing
- [ ] Critical path tests:
  - Open app → editor visible → type code → preview renders
  - Open file → edit → save → file on disk is correct
  - Export STL → file saved correctly
  - AI: set API key → send prompt → response streams → tool calls visible
  - Settings: change theme → UI updates → survives restart
- [ ] Run in CI on each PR

**Success criteria:** App installs and runs correctly on macOS, Windows, and Linux. Updates are automatic. CI catches regressions.

---

## Phase 9: Web Version (~3 weeks)

**Goal:** Run OpenSCAD Studio in the browser with openscad-wasm. Full spec in `ARCHITECTURE.md`.

### 9.1: Web Platform Implementation
- [ ] Create `WebPlatform` implementing the `Platform` interface
- [ ] `WebRenderingService`: openscad-wasm in a Web Worker
- [ ] Port `parseOpenScadStderr()` from Rust to TypeScript
- [ ] `WebFileSystemService`: File System Access API + fallbacks
- [ ] `WebStorageService`: localStorage
- [ ] `WebConversationService`: IndexedDB
- [ ] `WebHistoryService`: in-memory undo/redo

### 9.2: Web AI Agent
- [ ] Direct `fetch()` to Anthropic API with SSE parsing (CORS supported)
- [ ] In-browser tool execution (calls `WebRenderingService` for compile)
- [ ] API key stored in localStorage with security warning
- [ ] Anthropic-only initially (OpenAI needs CORS proxy)

### 9.3: Web-Specific UI
- [ ] In-app menu bar (no native menus in browser)
- [ ] Skip `OpenScadSetupScreen` (WASM is always available)
- [ ] Export = browser download instead of file save dialog
- [ ] Tab title shows filename via `document.title`
- [ ] `beforeunload` handler for unsaved changes

### 9.4: Build & Deploy
- [ ] Vite dual-target config (`VITE_PLATFORM=web`)
- [ ] `pnpm dev:web` and `pnpm build:web` scripts
- [ ] Deploy to GitHub Pages or Vercel
- [ ] Loading screen while openscad-wasm downloads (~3-4MB compressed)

**Success criteria:** Full workflow works in Chrome: edit → preview → export → AI chat. Desktop has zero regressions.

---

## Phase 10: Advanced Features (Post-1.0)

These are valuable but not blocking a production release. Prioritize based on user feedback.

### Community & Sharing
- [ ] Share designs via URL (encode source as URL parameter or pastebin-style)
- [ ] Gallery of example designs with one-click open
- [ ] Community prompt library (submit/upvote prompt templates)

### Offline LLM
- [ ] Integrate llama.cpp as Tauri sidecar
- [ ] Model download/management UI
- [ ] Offline mode toggle (no network required)
- [ ] Fine-tuned model on OpenSCAD code corpus

### Plugin System
- [ ] Plugin API for custom tools, exporters, and UI panels
- [ ] Plugin manifest format and loader
- [ ] Community plugin registry

### Performance
- [ ] Incremental rendering (re-render only changed subtree)
- [ ] Background render thread pool
- [ ] GPU-accelerated preview (consider WebGPU for web)
- [ ] Render progress indicator for complex models (>5s)

### Collaboration
- [ ] Real-time collaborative editing (CRDT via Yjs)
- [ ] Shareable project URLs
- [ ] Comments/annotations on 3D model

---

## Known Technical Debt

Items to address opportunistically, not as dedicated phases:

| Issue | Location | Severity | Notes |
|-------|----------|----------|-------|
| Refs-as-state anti-pattern | `App.tsx` (7+ refs) | Medium | Address in 4B.1 decomposition |
| Settings split across localStorage and Tauri store | `settingsStore.ts`, `cmd/ai.rs` | Low | Consider unifying in platform abstraction |
| OpenSCAD stderr parsing is regex-based | `utils/parser.rs` | Low | Works but may miss edge cases. Revisit if OpenSCAD adds JSON output |
| `EditorState` duplicated between frontend and backend | `useOpenScad.ts`, `ai_agent.rs` | Medium | Backend should be source of truth (4B.3) |
| No graceful degradation when OpenSCAD is unavailable | Various | Low | Editor works, just no preview. Could be clearer about what's disabled |
| `DiffViewer` panel always shows same code for old/new | `PanelComponents.tsx:58-66` | Low | `oldCode={source} newCode={source}` — not actually showing a diff |

---

## Decision Log

Decisions made during roadmap planning that affect ordering:

1. **Auto-render defaults to off.** The stock OpenSCAD editor auto-renders, but for large models this causes constant lag. Making it opt-in avoids perf regressions for power users.

2. **Web version after cross-platform desktop.** The ARCHITECTURE.md web plan is excellent but complex. Shipping Windows/Linux first reaches more users with less risk.

3. **AI features before CAD viewer features.** The 3D viewer is functional. The AI copilot is the differentiator. Invest where the moat is.

4. **Platform abstraction in 4B, not 9.** Moving to the `Platform` interface early means every subsequent feature is written against the abstraction. When Phase 9 (web) arrives, it's just a new implementation of existing interfaces.

5. **No collaborative editing before 1.0.** CRDT/Yjs is a massive undertaking. It's not what users are asking for first. Save it for post-1.0 when there's a user base that wants to share.

---

**Last Updated:** 2026-02-17
**Current Phase:** 4A Planning
**Next Milestone:** Quick wins & polish release
