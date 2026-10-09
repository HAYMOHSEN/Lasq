'use strict';
// Thin Win32 layer through koffi (FFI). Every export is safe to call on any platform:
// when not on Windows (or koffi is missing) `available` is false and functions return nulls.
// Pointers (HWND, HKL, handles) are BigInt values in koffi 3.

const isWin = process.platform === 'win32';
let koffi = null;
try { koffi = require('koffi'); } catch { koffi = null; }

const VK = {
  BACK: 0x08, TAB: 0x09, RETURN: 0x0d, SHIFT: 0x10, CONTROL: 0x11, MENU: 0x12, CAPITAL: 0x14,
  ESCAPE: 0x1b, SPACE: 0x20, LEFT: 0x25, UP: 0x26, RIGHT: 0x27, DOWN: 0x28, DELETE: 0x2e,
  LWIN: 0x5b, RWIN: 0x5c, V: 0x56, PACKET: 0xe7,
};

const KEYEVENTF_KEYUP = 0x0002;
const KEYEVENTF_UNICODE = 0x0004;
const INPUT_KEYBOARD = 1;
const CF_HDROP = 15;
const WM_CLIPBOARDUPDATE = 0x031d;
const MAPVK_VK_TO_VSC = 0;
const MAPVK_VSC_TO_VK_EX = 3;
const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

function stub() {
  return {
    available: false, VK, WM_CLIPBOARDUPDATE,
    getForegroundWindow: () => null,
    setForegroundWindow: () => false,
    getWindowPid: () => 0,
    getWindowThreadId: () => 0,
    getKeyboardLayoutForWindow: () => null,
    scanToVk: () => 0,
    vkToScan: () => 0,
    toUnicode: () => '',
    capsLockOn: () => false,
    modifiersDown: () => false,
    sendKeyEvents: () => 0,
    sendUnicodeText: () => 0,
    sendVk: () => 0,
    sendBackspaces: () => 0,
    sendCtrlV: () => 0,
    getCaretScreenPos: () => null,
    getProcessName: () => '',
    getForegroundProcessName: () => '',
    getClipboardOwnerProcessName: () => '',
    isClipboardFormatAvailable: () => false,
    readClipboardFileList: () => [],
    addClipboardFormatListener: () => false,
    removeClipboardFormatListener: () => false,
  };
}

if (!isWin || !koffi) {
  module.exports = stub();
} else {
  const user32 = koffi.load('user32.dll');
  const kernel32 = koffi.load('kernel32.dll');
  const shell32 = koffi.load('shell32.dll');

  const POINT = koffi.struct('POINT', { x: 'int32', y: 'int32' });
  const RECT = koffi.struct('RECT', { left: 'int32', top: 'int32', right: 'int32', bottom: 'int32' });
  const GUITHREADINFO = koffi.struct('GUITHREADINFO', {
    cbSize: 'uint32', flags: 'uint32', hwndActive: 'void*', hwndFocus: 'void*', hwndCapture: 'void*',
    hwndMenuOwner: 'void*', hwndMoveSize: 'void*', hwndCaret: 'void*', rcCaret: RECT,
  });
  const KEYBDINPUT = koffi.struct('KEYBDINPUT', { wVk: 'uint16', wScan: 'uint16', dwFlags: 'uint32', time: 'uint32', dwExtraInfo: 'uintptr_t' });
  const MOUSEINPUT = koffi.struct('MOUSEINPUT', { dx: 'int32', dy: 'int32', mouseData: 'uint32', dwFlags: 'uint32', time: 'uint32', dwExtraInfo: 'uintptr_t' });
  const HARDWAREINPUT = koffi.struct('HARDWAREINPUT', { uMsg: 'uint32', wParamL: 'uint16', wParamH: 'uint16' });
  const INPUT_UNION = koffi.union('INPUT_UNION', { mi: MOUSEINPUT, ki: KEYBDINPUT, hi: HARDWAREINPUT });
  const INPUT = koffi.struct('INPUT', { type: 'uint32', u: INPUT_UNION });
  const INPUT_SIZE = koffi.sizeof(INPUT);

  const GetForegroundWindow = user32.func('void* __stdcall GetForegroundWindow()');
  const SetForegroundWindow = user32.func('bool __stdcall SetForegroundWindow(void* hWnd)');
  const GetWindowThreadProcessId = user32.func('uint32 __stdcall GetWindowThreadProcessId(void* hWnd, _Out_ uint32* pid)');
  const GetKeyboardLayout = user32.func('void* __stdcall GetKeyboardLayout(uint32 idThread)');
  const MapVirtualKeyExW = user32.func('uint32 __stdcall MapVirtualKeyExW(uint32 uCode, uint32 uMapType, void* dwhkl)');
  const ToUnicodeEx = user32.func('int __stdcall ToUnicodeEx(uint32 wVirtKey, uint32 wScanCode, const uint8* lpKeyState, _Out_ uint16* pwszBuff, int cchBuff, uint32 wFlags, void* dwhkl)');
  const GetKeyState = user32.func('int16 __stdcall GetKeyState(int nVirtKey)');
  const GetAsyncKeyState = user32.func('int16 __stdcall GetAsyncKeyState(int vKey)');
  const SendInput = user32.func('uint32 __stdcall SendInput(uint32 cInputs, const INPUT* pInputs, int cbSize)');
  const GetGUIThreadInfo = user32.func('bool __stdcall GetGUIThreadInfo(uint32 idThread, _Inout_ GUITHREADINFO* pgui)');
  const ClientToScreen = user32.func('bool __stdcall ClientToScreen(void* hWnd, _Inout_ POINT* lpPoint)');
  const GetCursorPos = user32.func('bool __stdcall GetCursorPos(_Out_ POINT* lpPoint)');
  const GetClipboardOwner = user32.func('void* __stdcall GetClipboardOwner()');
  const RegisterClipboardFormatW = user32.func('uint32 __stdcall RegisterClipboardFormatW(const char16_t* name)');
  const IsClipboardFormatAvailable = user32.func('bool __stdcall IsClipboardFormatAvailable(uint32 format)');
  const OpenClipboard = user32.func('bool __stdcall OpenClipboard(void* hWndNewOwner)');
  const CloseClipboard = user32.func('bool __stdcall CloseClipboard()');
  const GetClipboardData = user32.func('void* __stdcall GetClipboardData(uint32 uFormat)');
  const AddClipboardFormatListener = user32.func('bool __stdcall AddClipboardFormatListener(void* hwnd)');
  const RemoveClipboardFormatListener = user32.func('bool __stdcall RemoveClipboardFormatListener(void* hwnd)');
  const DragQueryFileW = shell32.func('uint32 __stdcall DragQueryFileW(void* hDrop, uint32 iFile, _Out_ uint16* lpszFile, uint32 cch)');
  const OpenProcess = kernel32.func('void* __stdcall OpenProcess(uint32 dwDesiredAccess, bool bInheritHandle, uint32 dwProcessId)');
  const QueryFullProcessImageNameW = kernel32.func('bool __stdcall QueryFullProcessImageNameW(void* hProcess, uint32 dwFlags, _Out_ uint16* lpExeName, _Inout_ uint32* lpdwSize)');
  const CloseHandle = kernel32.func('bool __stdcall CloseHandle(void* hObject)');

  const formatIds = new Map();
  function formatId(name) {
    if (!formatIds.has(name)) formatIds.set(name, RegisterClipboardFormatW(name));
    return formatIds.get(name);
  }

  function utf16(buf, units) {
    return buf.toString('utf16le', 0, units * 2);
  }

  function getWindowPid(hwnd) {
    if (!hwnd) return 0;
    const pid = [0];
    GetWindowThreadProcessId(hwnd, pid);
    return pid[0];
  }

  function getWindowThreadId(hwnd) {
    if (!hwnd) return 0;
    return GetWindowThreadProcessId(hwnd, [0]);
  }

  function getKeyboardLayoutForWindow(hwnd) {
    return GetKeyboardLayout(getWindowThreadId(hwnd));
  }

  /** uiohook keycode (XT scan code, 0xE0xx/0x0Exx for extended keys) → virtual key for the given layout. */
  function scanToVk(keycode, hkl) {
    const scan = keycode & 0xff;
    const hi = (keycode >> 8) & 0xff;
    const extended = hi === 0xe0 || hi === 0x0e;
    return MapVirtualKeyExW(extended ? 0xe000 | scan : scan, MAPVK_VSC_TO_VK_EX, hkl || null);
  }

  function vkToScan(vk, hkl) {
    return MapVirtualKeyExW(vk, MAPVK_VK_TO_VSC, hkl || null);
  }

  const keyState = Buffer.alloc(256);
  const charBuf = Buffer.alloc(32);

  /**
   * Translate a key press into the character it produces under `hkl`.
   * mods: { shift, ctrl, alt, caps }. Returns '' for no character, dead keys and control keys.
   */
  function toUnicode(vk, scan, mods, hkl) {
    keyState.fill(0);
    if (mods.shift) keyState[VK.SHIFT] = 0x80;
    if (mods.ctrl) keyState[VK.CONTROL] = 0x80;
    if (mods.alt) keyState[VK.MENU] = 0x80;
    if (mods.caps) keyState[VK.CAPITAL] = 0x01;
    // 0x4 = do not change the keyboard state of the target thread (Windows 10 1607+)
    const n = ToUnicodeEx(vk, scan, keyState, charBuf, 16, 0x4, hkl || null);
    if (n <= 0) return '';
    const s = utf16(charBuf, n);
    // control characters (Ctrl+A etc.) are not typed text
    return /^[\u0000-\u001f\u007f]+$/.test(s) ? '' : s;
  }

  function capsLockOn() {
    return (GetKeyState(VK.CAPITAL) & 0x0001) !== 0;
  }

  function modifiersDown() {
    return [VK.SHIFT, VK.CONTROL, VK.MENU, VK.LWIN, VK.RWIN].some((k) => (GetAsyncKeyState(k) & 0x8000) !== 0);
  }

  function keyInput(vk, scan, flags) {
    return { type: INPUT_KEYBOARD, u: { ki: { wVk: vk, wScan: scan, dwFlags: flags, time: 0, dwExtraInfo: 0 } } };
  }

  function sendKeyEvents(inputs) {
    if (!inputs.length) return 0;
    let sent = 0;
    for (let i = 0; i < inputs.length; i += 64) {
      const chunk = inputs.slice(i, i + 64);
      sent += SendInput(chunk.length, chunk, INPUT_SIZE);
    }
    return sent;
  }

  /** Press and release a virtual key (with optional modifier vks held). */
  function sendVk(vk, modifiers = []) {
    const inputs = [];
    for (const m of modifiers) inputs.push(keyInput(m, vkToScan(m), 0));
    inputs.push(keyInput(vk, vkToScan(vk), 0));
    inputs.push(keyInput(vk, vkToScan(vk), KEYEVENTF_KEYUP));
    for (const m of modifiers.slice().reverse()) inputs.push(keyInput(m, vkToScan(m), KEYEVENTF_KEYUP));
    return sendKeyEvents(inputs);
  }

  /** Type text as Unicode key events; newlines become Enter, tabs become Tab. */
  function sendUnicodeText(text) {
    const inputs = [];
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '\r') continue;
      if (ch === '\n') {
        inputs.push(keyInput(VK.RETURN, vkToScan(VK.RETURN), 0), keyInput(VK.RETURN, vkToScan(VK.RETURN), KEYEVENTF_KEYUP));
        continue;
      }
      if (ch === '\t') {
        inputs.push(keyInput(VK.TAB, vkToScan(VK.TAB), 0), keyInput(VK.TAB, vkToScan(VK.TAB), KEYEVENTF_KEYUP));
        continue;
      }
      const unit = text.charCodeAt(i);
      inputs.push(keyInput(0, unit, KEYEVENTF_UNICODE), keyInput(0, unit, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP));
    }
    return sendKeyEvents(inputs);
  }

  function sendBackspaces(n) {
    const inputs = [];
    const scan = vkToScan(VK.BACK);
    for (let i = 0; i < n; i++) inputs.push(keyInput(VK.BACK, scan, 0), keyInput(VK.BACK, scan, KEYEVENTF_KEYUP));
    return sendKeyEvents(inputs);
  }

  function sendCtrlV() {
    return sendVk(VK.V, [VK.CONTROL]);
  }

  /** Screen position of the text caret in the foreground window, or null when unknown. */
  function getCaretScreenPos() {
    const hwnd = GetForegroundWindow();
    if (!hwnd) return null;
    const info = { cbSize: koffi.sizeof(GUITHREADINFO), flags: 0, hwndActive: null, hwndFocus: null, hwndCapture: null, hwndMenuOwner: null, hwndMoveSize: null, hwndCaret: null, rcCaret: { left: 0, top: 0, right: 0, bottom: 0 } };
    if (!GetGUIThreadInfo(getWindowThreadId(hwnd), info) || !info.hwndCaret) return null;
    const pt = { x: info.rcCaret.left, y: info.rcCaret.bottom };
    if (!ClientToScreen(info.hwndCaret, pt)) return null;
    if (pt.x === 0 && pt.y === 0) return null;
    return { x: pt.x, y: pt.y, height: info.rcCaret.bottom - info.rcCaret.top };
  }

  function getProcessName(pid) {
    if (!pid) return '';
    const h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
    if (!h) return '';
    try {
      const buf = Buffer.alloc(1024);
      const size = [512];
      if (!QueryFullProcessImageNameW(h, 0, buf, size)) return '';
      const full = utf16(buf, size[0]);
      return full.slice(full.lastIndexOf('\\') + 1).toLowerCase();
    } finally {
      CloseHandle(h);
    }
  }

  function getForegroundProcessName() {
    return getProcessName(getWindowPid(GetForegroundWindow()));
  }

  function getClipboardOwnerProcessName() {
    const owner = GetClipboardOwner();
    return owner ? getProcessName(getWindowPid(owner)) : '';
  }

  function isClipboardFormatAvailable(name) {
    const id = formatId(name);
    return id ? IsClipboardFormatAvailable(id) : false;
  }

  /** File paths of a CF_HDROP clipboard (files copied in Explorer). */
  function readClipboardFileList() {
    if (!IsClipboardFormatAvailable(CF_HDROP)) return [];
    const files = [];
    if (!OpenClipboard(null)) return files;
    try {
      const hDrop = GetClipboardData(CF_HDROP);
      if (!hDrop) return files;
      const count = DragQueryFileW(hDrop, 0xffffffff, null, 0);
      const buf = Buffer.alloc(1040);
      for (let i = 0; i < count && i < 500; i++) {
        const n = DragQueryFileW(hDrop, i, buf, 520);
        if (n > 0) files.push(utf16(buf, n));
      }
    } finally {
      CloseClipboard();
    }
    return files;
  }

  module.exports = {
    available: true, VK, WM_CLIPBOARDUPDATE,
    getForegroundWindow: () => GetForegroundWindow(),
    setForegroundWindow: (hwnd) => (hwnd ? SetForegroundWindow(hwnd) : false),
    getWindowPid,
    getWindowThreadId,
    getKeyboardLayoutForWindow,
    scanToVk,
    vkToScan,
    toUnicode,
    capsLockOn,
    modifiersDown,
    sendKeyEvents,
    sendUnicodeText,
    sendVk,
    sendBackspaces,
    sendCtrlV,
    getCaretScreenPos,
    getProcessName,
    getForegroundProcessName,
    getClipboardOwnerProcessName,
    isClipboardFormatAvailable,
    readClipboardFileList,
    addClipboardFormatListener: (hwnd) => AddClipboardFormatListener(hwnd),
    removeClipboardFormatListener: (hwnd) => RemoveClipboardFormatListener(hwnd),
    getCursorPos: () => { const p = { x: 0, y: 0 }; return GetCursorPos(p) ? p : null; },
  };
}
