# Renderer ↔ main contract (`window.lasq`)

`src/preload.js` exposes exactly this object through `contextBridge`. The renderer never touches Node or Electron directly. When `window.lasq` is missing (page opened straight in a browser), `src/renderer/ui/mock.js` installs a mock with demo data so the UI can be designed without Electron.

## Types

```ts
type Item = {
  id: string;
  kind: 'text' | 'image' | 'files' | 'snippet';
  text: string;            // full text (text items), body preview (snippets), '' for images
  preview: string;         // first line, max ~120 chars
  sourceApp: string;       // 'Outlook', 'Chrome', 'Lasq' … ('' if unknown)
  createdAt: number;       // ms since epoch
  pinned: boolean;
  imageDataUrl?: string;   // kind === 'image' only (PNG data URL, thumbnail-sized)
  files?: string[];        // kind === 'files' only
  name?: string;           // kind === 'snippet'
  trigger?: string;        // kind === 'snippet'
  folder?: string;         // kind === 'snippet'
};

type Snippet = {
  id: string | null;       // null when creating
  name: string;
  trigger: string;         // e.g. ';sig'  or  '؛توق'
  folder: string;          // '' = root
  bodyEn: string;
  bodyAr: string;          // '' = none → bodyEn used everywhere
  appsAllow: string[];     // process names, e.g. ['outlook.exe']; empty = all apps
  appsDeny: string[];
  useCount: number;
  updatedAt: number;
};

type Note = { id: string; text: string; createdAt: number };

type Settings = {
  lang: 'en' | 'ar';
  theme: 'system' | 'light' | 'dark';
  hotkeys: { panel: string; pastePlain: string; capture: string; pause: string; library: string }; // Electron accelerator syntax
  capture: { text: boolean; images: boolean; files: boolean; maxTextKB: number; maxImageMB: number; retentionDays: number; maxItems: number; excludedApps: string[] };
  expansion: { enabled: boolean; wordBoundary: boolean; matchCase: boolean; sound: boolean; excludedApps: string[] };
  paste: { restoreClipboard: boolean; restoreClipboardAfterMs: number };
  privacy: { encrypt: boolean; paused: boolean };
  startup: boolean;
};

type Transform = { id: string; labelEn: string; labelAr: string };
```

## Methods

| Method | Returns | Notes |
| --- | --- | --- |
| `lasq.ready()` | `Promise<{ lang, dir, settings, platform, version, transforms: Transform[] }>` | Call once on load. |
| `lasq.search({ query, tab, limit? })` | `Promise<Item[]>` | `tab` = `'history' \| 'pinned' \| 'snippets'`; results already ranked. |
| `lasq.paste({ id, mode, transform? })` | `Promise<void>` | `mode` = `'normal' \| 'plain' \| 'multi' \| 'transform'`; main hides the panel itself unless `mode === 'multi'`. |
| `lasq.pin({ id, pinned })` | `Promise<void>` | |
| `lasq.remove({ id })` | `Promise<void>` | History item or note. |
| `lasq.hidePanel()` | `void` | Esc. |
| `lasq.quickCapture({ text, asSnippet })` | `Promise<void>` | `asSnippet: true` opens the library on a new snippet pre-filled with `text`. |
| `lasq.submitForm({ values })` | `void` | Fill-in form: `{ [fieldName]: string }`. |
| `lasq.cancelForm()` | `void` | |
| `lasq.listTransforms()` | `Promise<Transform[]>` | Same list as in `ready()`. |
| `lasq.getSnippets()` | `Promise<Snippet[]>` | |
| `lasq.saveSnippet(snippet)` | `Promise<Snippet>` | Returns the saved snippet with its id. Rejects with `{ code: 'trigger-taken' }` if the trigger belongs to another snippet. |
| `lasq.deleteSnippet({ id })` | `Promise<void>` | |
| `lasq.getHistory({ query, filter, limit, offset })` | `Promise<Item[]>` | `filter` = `'all' \| 'pinned' \| 'text' \| 'image' \| 'files'`. |
| `lasq.clearHistory({ olderThanDays })` | `Promise<void>` | `olderThanDays: 0` = everything (unpinned). |
| `lasq.getNotes()` | `Promise<Note[]>` | |
| `lasq.getSettings()` | `Promise<Settings>` | |
| `lasq.saveSettings(partial)` | `Promise<Settings>` | Deep-merged; returns the full settings. |
| `lasq.exportData()` | `Promise<{ ok: boolean; path?: string }>` | Main opens a save dialog. |
| `lasq.importData()` | `Promise<{ ok: boolean; counts?: { history: number; snippets: number; notes: number } }>` | Main opens an open dialog. |
| `lasq.openLibrary(section?)` | `void` | `section` = `'history' \| 'pinned' \| 'snippets' \| 'notes' \| 'settings'`. |
| `lasq.on(channel, cb)` | `() => void` (unsubscribe) | Channels below. |

## Events (main → renderer)

| Channel | Payload | Who listens |
| --- | --- | --- |
| `panel:mode` | `{ mode: 'paste' \| 'capture' \| 'form', fields?: { name: string; type: 'text' \| 'choice'; options?: string[] }[], snippetName?: string, prefill?: string }` | panel |
| `data:changed` | `{ what: 'history' \| 'snippets' \| 'notes' \| 'settings' }` | panel, library |
| `settings:changed` | `Settings` | panel, library |
| `library:section` | `{ section, snippetDraft?: Partial<Snippet> }` | library |

## Panel keyboard behaviour (must match the design doc)

Enter = paste normal · Ctrl+Enter = paste plain · Shift+Enter = paste and keep panel (multi) · Alt+Enter = open the transform picker, then Enter on a transform pastes with it · 1–9 = paste result n (normal) · Ctrl+P = toggle pin · Delete = remove · Tab / Shift+Tab = next / previous tab · ↑ ↓ = move selection · Esc = close (or back out of the transform picker / capture / form). Typing anywhere focuses the search box.
