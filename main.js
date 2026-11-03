/*
 * AcodeX Browser — Acode floating-window plugin
 * Copyright © 2026 Chanwit™
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

(function () {
  'use strict';

  if (!window.acode) return;

  const PLUGIN_ID = 'com.developer.webbrowser'; // must match plugin.json "id"
  const PLUGIN_NAME = 'Web Browser';
  const WINDOW_ID = 'webbrowser-window';
  const TAB_ID = 'webbrowser-tab';
  const STYLE_ID = 'webbrowser-plugin-style';
  const COMMAND_NAME = 'webbrowser-toggle';
  const WINDOW_COMMAND_NAME = 'webbrowser-window-toggle';
  const HOME_URL = 'https://www.google.com/webhp?igu=1';
  const KEY_ENABLED = PLUGIN_ID + ':enabled';
  const KEY_LAST_URL = PLUGIN_ID + ':last-url';
  const KEY_ENGINE = PLUGIN_ID + ':engine2';
  const KEY_RECT = PLUGIN_ID + ':rect';
  const MIN_W = 260;
  const MIN_H = 220;
  const FOCUS_DELAY_MS = 60;

  // Show / hide shortcut: Ctrl+Alt+B (Cmd+Alt+B on macOS).
  const WINDOW_SHORTCUT = { code: 'KeyB', key: 'b', alt: true, shift: false };
  const WINDOW_SHORTCUT_ACE = { win: 'Ctrl-Alt-B', mac: 'Command-Alt-B' };

  // Search engines for the iframe. DuckDuckGo is not listed: it blocks iframes.
  const ENGINES = [
    { key: 'G', name: 'Google', url: 'https://www.google.com/search?igu=1&q=' },
    { key: 'B', name: 'Bing', url: 'https://www.bing.com/search?q=' },
    { key: 'M', name: 'Mojeek', url: 'https://www.mojeek.com/search?q=' },
    { key: 'W', name: 'Wikipedia', url: 'https://en.m.wikipedia.org/w/index.php?search=' },
  ];

  const svgIcon = (inner) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${inner}</svg>`;
  const GLOBE_SVG = svgIcon(
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/>' +
    '<path d="M12 3c2.5 2.5 3.8 5.5 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z"/>'
  );
  const EXTERNAL_SVG = svgIcon(
    '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>' +
    '<polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>'
  );
  const MINIMIZE_SVG = svgIcon('<line x1="5" y1="12" x2="19" y2="12"/>');
  const MAXIMIZE_SVG = svgIcon('<rect x="5" y="5" width="14" height="14" rx="2"/>');
  const CLOSE_SVG = svgIcon(
    '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>'
  );

  const CSS = `
    .wb-tab {
      position: fixed; right: 0; top: 40%; z-index: 8999;
      writing-mode: vertical-rl; padding: 12px 6px; cursor: pointer; user-select: none;
      background: #8ab4f8; color: #0b1220; font: 600 12px/1 system-ui, sans-serif;
      letter-spacing: .5px; border-radius: 6px 0 0 6px; box-shadow: -2px 2px 8px rgba(0,0,0,.25);
    }
    .wb-window {
      position: fixed; z-index: 9000; display: none; flex-direction: column;
      left: 12px; top: 12px; width: 400px; height: 480px;
      background: #1f1f2a; color: #e5e7eb; border: 1px solid #3a3a4a; border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0,0,0,.45); overflow: hidden;
      font: 14px/1.3 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    }
    .wb-window.wb-open { display: flex; }
    .wb-window.wb-max {
      left: 0 !important; top: 0 !important; width: 100% !important; height: 100% !important;
      border-radius: 0; border-width: 0;
    }
    .wb-window *, .wb-window *::before, .wb-window *::after { box-sizing: border-box; }
    .wb-header {
      display: flex; align-items: center; gap: 4px; height: 32px; flex: none;
      padding: 0 4px 0 10px; background: #15151e; border-bottom: 1px solid #2c2c3a;
      cursor: move; touch-action: none; user-select: none;
    }
    .wb-globe { display: flex; flex: none; }
    .wb-globe svg { width: 14px; height: 14px; color: #8ab4f8; }
    .wb-title {
      flex: 1; min-width: 0; padding-left: 2px; font-size: 10px; font-weight: 600;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .wb-state { font-size: 9px; opacity: .7; min-width: 18px; text-align: right; }
    .wb-switch {
      position: relative; width: 30px; height: 14px; padding: 0; flex: none;
      border: none; border-radius: 7px; cursor: pointer; background: #4b5563; transition: background .2s;
    }
    .wb-switch[aria-checked="true"] { background: #3b82f6; }
    .wb-knob {
      position: absolute; top: 2px; left: 2px; width: 10px; height: 10px;
      border-radius: 50%; background: #fff; transition: transform .2s;
    }
    .wb-switch[aria-checked="true"] .wb-knob { transform: translateX(16px); }
    .wb-hbtn {
      display: flex; align-items: center; justify-content: center; flex: none;
      width: 24px; height: 14px; padding: 0; border: none; border-radius: 6px;
      background: transparent; color: #cbd5e1; cursor: pointer;
    }
    .wb-hbtn:active { background: #2c2c3a; }
    .wb-hbtn svg, .wb-globe svg {
      fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
    }
    .wb-hbtn svg { width: 12px; height: 12px; }
    .wb-body { display: flex; flex-direction: column; flex: 1; min-height: 0; }
    .wb-bar { display: flex; gap: 6px; align-items: center; padding: 4px 6px 0; }
    .wb-input {
      flex: 1; min-width: 0; height: 30px; padding: 0 8px; font-size: 13px; outline: none;
      color: #e5e7eb; background: #2a2a38; border: 1px solid #3a3a4a; border-radius: 6px;
    }
    .wb-input:focus { border-color: #60a5fa; }
    .wb-btn {
      flex: none; min-width: 30px; height: 30px; padding: 0 6px; font-size: 14px; cursor: pointer;
      color: #e5e7eb; background: #2a2a38; border: 1px solid #3a3a4a; border-radius: 6px;
    }
    .wb-btn:active { background: #3b82f6; color: #fff; }
    .wb-tools { padding-bottom: 4px; }
    .wb-tools .wb-btn { flex: 1; }\n    .wb-zoom { display: flex; gap: 4px; padding: 0 6px 4px; }\n    .wb-zoom .wb-btn { flex: 1; }
    .wb-hint { padding: 0 8px 3px; font-size: 10px; opacity: .6; line-height: 1.2; }
    .wb-frame { flex: 1; min-height: 0; width: 100%; border: none; background: #fff; }
    .wb-off {
      display: none; flex: 1; align-items: center; justify-content: center;
      padding: 24px; text-align: center; font-size: 13px; opacity: .7; line-height: 1.6;
    }
    .wb-resize { position: absolute; right: 0; bottom: 0; width: 24px; height: 24px; cursor: nwse-resize; touch-action: none; }
    .wb-resize::after {
      content: ''; position: absolute; right: 5px; bottom: 5px; width: 9px; height: 9px;
      border-right: 2px solid #6b7280; border-bottom: 2px solid #6b7280;
    }
    .wb-window.wb-disabled .wb-body { display: none; }
    .wb-window.wb-disabled .wb-off { display: flex; }
    .wb-window.wb-dragging .wb-frame { pointer-events: none; }
    .wb-window.wb-max .wb-resize { display: none; }
  `;

  const TEMPLATE = `
    <div class="wb-header" data-wb="header">
      <span class="wb-globe">${GLOBE_SVG}</span>
      <span class="wb-title">${PLUGIN_NAME}</span>
      <span class="wb-state" data-wb="state">ON</span>
      <button class="wb-switch" data-wb="switch" role="switch" aria-checked="true"
              aria-label="Turn the browser on or off" title="Turn the browser on / off"><span class="wb-knob"></span></button>
      <button class="wb-hbtn" data-wb="external" title="Open in external browser"
              aria-label="Open in external browser">${EXTERNAL_SVG}</button>
      <button class="wb-hbtn" data-wb="minimize" title="Minimize (hide)"
              aria-label="Minimize">${MINIMIZE_SVG}</button>
      <button class="wb-hbtn" data-wb="maximize" title="Maximize"
              aria-label="Maximize">${MAXIMIZE_SVG}</button>
      <button class="wb-hbtn" data-wb="close" title="Close (unload page)"
              aria-label="Close">${CLOSE_SVG}</button>
    </div>
    <div class="wb-body">
      <div class="wb-bar">
        <input class="wb-input" data-wb="input" type="text" inputmode="url"
               autocapitalize="off" autocomplete="off" spellcheck="false"
               placeholder="URL or search, then Enter" />
        <button class="wb-btn" data-wb="go" title="Go">&#10140;</button>
      </div>
      <div class="wb-bar wb-tools wb-controls">
        <button class="wb-btn" data-wb="back" title="Back">&#8592;</button>
        <button class="wb-btn" data-wb="home" title="Home (Google)">&#8962;</button>
        <button class="wb-btn" data-wb="reload" title="Reload">&#10227;</button>
        <button class="wb-btn" data-wb="engine" title="Search engine">G</button>
        <button class="wb-btn" data-wb="zoomOut" title="Zoom out">−</button>
        <button class="wb-btn" data-wb="zoomReset" title="Reset zoom">100%</button>
        <button class="wb-btn" data-wb="zoomIn" title="Zoom in">+</button>
        <button class="wb-btn" data-wb="language" title="Switch language">TH</button>
      </div>
      <div class="wb-hint" data-wb="hint"></div>
      <iframe class="wb-frame" data-wb="frame" src="about:blank"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
    </div>
    <div class="wb-off" data-wb="off">Browser is turned off.<br>Flip the switch in the header to turn it on.</div>
    <div class="wb-resize" data-wb="resize" title="Resize"></div>
  `;

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    },
  };

  function notify(message) {
    try {
      if (typeof window.toast === 'function') return window.toast(message, 2000);
    } catch (e) { /* ignore */ }
    console.log('[' + PLUGIN_NAME + '] ' + message);
  }

  function normalizeUrl(raw, searchBase) {
    const text = (raw || '').trim();
    if (!text) return '';
    if (/^https?:\/\//i.test(text)) return text;
    if (/^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/\S*)?$/i.test(text)) return 'http://' + text;
    if (/^[^\s:]+\.[^\s]{2,}$/.test(text)) return 'https://' + text;
    return searchBase + encodeURIComponent(text);
  }

  class WebBrowserPlugin {
    constructor() {
      this.enabled = store.get(KEY_ENABLED, true) !== false;
      this.currentUrl = store.get(KEY_LAST_URL, HOME_URL);
      const saved = parseInt(store.get(KEY_ENGINE, 0), 10);
      this.engineIndex = saved >= 0 && saved < ENGINES.length ? saved : 0;
      this.zoomLevel = 100;
      this.language = store.get(PLUGIN_ID + ':language', 'en') === 'th' ? 'th' : 'en';

      // history: our own stack + count of in-page navigations seen via iframe "load"
      this.stack = [];
      this.stackIndex = -1;
      this.loadCount = 0;
      this.internalDepth = 0;
      this.ignoreLoads = 0;

      this.isOpen = false;
      this.rect = null;
      this.tab = null;
      this.win = null;
      this.refs = {};
      this.styleEl = null;
      this.commands = null;
      this.focusTimer = null;
      this.onKeyDown = null;
      this.onViewportResize = null;
    }

    init() {
      try {
        this._injectStyle();
        this._buildTab();
        this._registerCommand();
        this._registerShortcut();
        this._registerViewport();
        console.log('[' + PLUGIN_NAME + '] Initialized.');
      } catch (error) {
        console.error('[' + PLUGIN_NAME + '] Initialization failed:', error);
        notify(PLUGIN_NAME + ' failed to start');
      }
    }

    _injectStyle() {
      if (document.getElementById(STYLE_ID)) return;
      this.styleEl = document.createElement('style');
      this.styleEl.id = STYLE_ID;
      this.styleEl.textContent = CSS;
      document.head.appendChild(this.styleEl);
    }

    // Edge tab on the right side of the screen (like the Web Preview tab).
    _buildTab() {
      const tab = document.createElement('div');
      tab.id = TAB_ID;
      tab.className = 'wb-tab';
      tab.textContent = PLUGIN_NAME;
      tab.title = 'Show / hide the browser window';
      tab.addEventListener('click', () => this.toggleWindow());
      document.body.appendChild(tab);
      this.tab = tab;
    }

    _registerCommand() {
      const em = window.editorManager;
      this.commands = em && em.editor && em.editor.commands;
      if (!this.commands) return;
      this.commands.addCommand({
        name: COMMAND_NAME,
        description: PLUGIN_NAME + ': Toggle on/off',
        exec: () => this.setEnabled(!this.enabled),
      });
      this.commands.addCommand({
        name: WINDOW_COMMAND_NAME,
        description: PLUGIN_NAME + ': Show / hide window',
        bindKey: WINDOW_SHORTCUT_ACE,
        exec: () => this.toggleWindow(),
      });
    }

    // Listen at document level (capture phase), so the shortcut works from the
    // editor, the address bar and the window alike. Keys typed inside the web
    // page itself live in the iframe and cannot be intercepted.
    _registerShortcut() {
      this.onKeyDown = (e) => this._handleKeyDown(e);
      document.addEventListener('keydown', this.onKeyDown, true);
    }

    _registerViewport() {
      this.onViewportResize = () => {
        if (!this.win || !this.isOpen || this.win.classList.contains('wb-max')) return;
        this._applyRect(this.rect || this._defaultRect());
      };
      window.addEventListener('resize', this.onViewportResize);
    }

    _handleKeyDown(e) {
      if (e.isComposing || !this._isWindowShortcut(e)) return;
      e.preventDefault();
      e.stopPropagation(); // keeps the editor from handling the same key
      if (!e.repeat) this.toggleWindow(); // holding the keys toggles only once
    }

    _isWindowShortcut(e) {
      if (e.getModifierState && e.getModifierState('AltGraph')) return false;
      const isKeyB = e.code === WINDOW_SHORTCUT.code ||
        String(e.key || '').toLowerCase() === WINDOW_SHORTCUT.key;
      const modifiersOk = Boolean(e.ctrlKey || e.metaKey) &&
        Boolean(e.altKey) === WINDOW_SHORTCUT.alt &&
        Boolean(e.shiftKey) === WINDOW_SHORTCUT.shift;
      return isKeyB && modifiersOk;
    }

    // ----- window lifecycle -------------------------------------------------

    _ensureWindow() {
      if (this.win) return;
      const win = document.createElement('div');
      win.id = WINDOW_ID;
      win.className = 'wb-window';
      win.innerHTML = TEMPLATE;
      document.body.appendChild(win);
      this.win = win;
      win.querySelectorAll('[data-wb]').forEach((el) => {
        this.refs[el.getAttribute('data-wb')] = el;
      });
      this.refs.input.value = this.currentUrl;
      this._bindEvents();
      this._applyRect(this._restoreRect());
    }

    _bindEvents() {
      const r = this.refs;
      r.switch.addEventListener('click', () => this.setEnabled(!this.enabled));
      r.external.addEventListener('click', () => this.openExternal());
      r.minimize.addEventListener('click', () => this.hideWindow());
      r.maximize.addEventListener('click', () => this.toggleMaximize());
      r.close.addEventListener('click', () => this.closeWindow());
      r.go.addEventListener('click', () => this.navigate(r.input.value));
      r.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.navigate(r.input.value);
      });
      r.back.addEventListener('click', () => this.goBack());
      r.home.addEventListener('click', () => this.navigate(HOME_URL));
      r.reload.addEventListener('click', () => this.reload());
      r.engine.addEventListener('click', () => this.nextEngine());
      r.zoomIn.addEventListener('click', () => this.setZoom(this.zoomLevel + 10));
      r.zoomOut.addEventListener('click', () => this.setZoom(this.zoomLevel - 10));
      r.zoomReset.addEventListener('click', () => this.setZoom(100));
      r.language.addEventListener('click', () => this.toggleLanguage());
      r.frame.addEventListener('load', () => this._onFrameLoad());
      r.header.addEventListener('pointerdown', (e) => this._startDrag(e));
      r.resize.addEventListener('pointerdown', (e) => this._startResize(e));
    }

    toggleWindow() {
      if (this.isOpen) this.hideWindow();
      else this.showWindow();
    }

    showWindow() {
      this._ensureWindow();
      this.isOpen = true;
      this.win.classList.add('wb-open');
      this._applyRect(this.rect || this._restoreRect()); // re-fit to the current screen
      this._render();
      clearTimeout(this.focusTimer);
      this.focusTimer = setTimeout(() => this._focusInput(), FOCUS_DELAY_MS);
    }

    // Minimize: hide the window but keep the page loaded.
    hideWindow() {
      this.isOpen = false;
      clearTimeout(this.focusTimer);
      if (this.win) this.win.classList.remove('wb-open');
      this._focusEditor();
    }

    // Close: hide the window and unload the page; it loads again on next open.
    closeWindow() {
      this.hideWindow();
      if (this.refs.frame) this.refs.frame.src = 'about:blank';
    }

    toggleMaximize() {
      if (this.win) this.win.classList.toggle('wb-max');
    }

    openExternal() {
      try {
        window.open(this.currentUrl, '_blank');
      } catch (e) {
        notify('Could not open the page in an external browser');
      }
    }

    // ----- drag / resize ----------------------------------------------------

    _startDrag(e) {
      if (e.button > 0) return;
      if (e.target.closest && e.target.closest('button')) return; // header buttons, not drag
      if (this.win.classList.contains('wb-max')) return;
      e.preventDefault();
      this._track(e, (dx, dy, start) => this._applyRect({
        left: start.left + dx, top: start.top + dy, width: start.width, height: start.height,
      }));
    }

    _startResize(e) {
      if (e.button > 0) return;
      if (this.win.classList.contains('wb-max')) return;
      e.preventDefault();
      e.stopPropagation();
      this._track(e, (dx, dy, start) => this._applyRect({
        left: start.left, top: start.top, width: start.width + dx, height: start.height + dy,
      }));
    }

    // Follow the pointer on the handle element until it is released.
    _track(e, onMove) {
      const handle = e.currentTarget;
      const box = this.win.getBoundingClientRect();
      const start = {
        x: e.clientX, y: e.clientY,
        left: box.left, top: box.top, width: box.width, height: box.height,
      };
      try { handle.setPointerCapture(e.pointerId); } catch (err) { /* events still reach the handle */ }
      this.win.classList.add('wb-dragging');

      const move = (ev) => onMove(ev.clientX - start.x, ev.clientY - start.y, start);
      const end = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', end);
        handle.removeEventListener('pointercancel', end);
        if (this.win) this.win.classList.remove('wb-dragging');
        if (this.rect) store.set(KEY_RECT, this.rect);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
    }

    _clampRect(r) {
      const vw = window.innerWidth || document.documentElement.clientWidth;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const width = Math.min(Math.max(r.width, MIN_W), vw);
      const height = Math.min(Math.max(r.height, MIN_H), vh);
      const left = Math.min(Math.max(r.left, 0), Math.max(0, vw - width));
      const top = Math.min(Math.max(r.top, 0), Math.max(0, vh - height));
      return { left, top, width, height };
    }

    _applyRect(rect) {
      const c = this._clampRect(rect);
      this.win.style.left = c.left + 'px';
      this.win.style.top = c.top + 'px';
      this.win.style.width = c.width + 'px';
      this.win.style.height = c.height + 'px';
      this.rect = c;
    }

    _defaultRect() {
      const vw = window.innerWidth || document.documentElement.clientWidth;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const width = Math.min(400, vw - 24);
      const height = Math.min(500, Math.round(vh * 0.6));
      return { left: vw - width - 12, top: Math.max(12, vh - height - 90), width, height };
    }

    _restoreRect() {
      const saved = store.get(KEY_RECT, null);
      if (saved && [saved.left, saved.top, saved.width, saved.height].every(Number.isFinite)) {
        return saved;
      }
      return this._defaultRect();
    }

    // ----- browser logic ----------------------------------------------------

    _focusInput() {
      if (!this.isOpen || !this.enabled || !this.refs.input) return;
      try {
        this.refs.input.focus();
        this.refs.input.select();
      } catch (e) { /* ignore */ }
    }

    _focusEditor() {
      try {
        if (this.refs.input && document.activeElement === this.refs.input) this.refs.input.blur();
        const editor = window.editorManager && window.editorManager.editor;
        if (editor && typeof editor.focus === 'function') editor.focus();
      } catch (e) { /* ignore */ }
    }

    _onFrameLoad() {
      if (this.ignoreLoads > 0) { this.ignoreLoads--; return; }
      if (this.refs.frame.getAttribute('src') === 'about:blank') return;
      this.loadCount++;
      this.internalDepth = Math.max(0, this.loadCount - 1); // links clicked inside the page
    }

    _loadFrame(url) {
      this.loadCount = 0;
      this.internalDepth = 0;
      this.ignoreLoads = 0;
      this.refs.frame.src = url;
    }

    _pushHistory(url) {
      if (this.stack[this.stackIndex] === url) return;
      this.stack = this.stack.slice(0, this.stackIndex + 1);
      this.stack.push(url);
      this.stackIndex = this.stack.length - 1;
    }

    setZoom(value) {
      this.zoomLevel = Math.max(50, Math.min(200, value));
      // CSS zoom applies to the embedded page rendering without changing the window size.
      this.refs.frame.style.zoom = (this.zoomLevel / 100);
      this.refs.zoomReset.textContent = this.zoomLevel + '%';
      this.refs.zoomReset.title = this.language === 'th' ? 'คืนค่าซูม' : 'Reset zoom';
    }

    toggleLanguage() {
      this.language = this.language === 'en' ? 'th' : 'en';
      store.set(PLUGIN_ID + ':language', this.language);
      this._render();
    }

    _render() {
      if (!this.win) return;
      const { switch: sw, state, frame, engine, hint } = this.refs;
      sw.setAttribute('aria-checked', String(this.enabled));
      state.textContent = this.enabled ? 'ON' : 'OFF';
      this.win.classList.toggle('wb-disabled', !this.enabled);
      engine.textContent = ENGINES[this.engineIndex].key;
      engine.title = 'Search engine: ' + ENGINES[this.engineIndex].name + ' (tap to change)';
      const th = this.language === 'th';
      this.refs.language.textContent = th ? 'EN' : 'TH';
      this.refs.language.title = th ? 'เปลี่ยนเป็นภาษาอังกฤษ' : 'Switch to Thai';
      this.refs.zoomIn.title = th ? 'ซูมเข้า' : 'Zoom in';
      this.refs.zoomOut.title = th ? 'ซูมออก' : 'Zoom out';
      this.refs.input.placeholder = th ? 'URL หรือคำค้นหา แล้วกด Enter' : 'URL or search, then Enter';
      this.refs.back.title = th ? 'ย้อนกลับ' : 'Back';
      this.refs.home.title = th ? 'หน้าแรก (Google)' : 'Home (Google)';
      this.refs.reload.title = th ? 'โหลดใหม่' : 'Reload';
      this.refs.go.title = th ? 'ไป' : 'Go';
      this.refs.off.textContent = th ? 'ปิดเบราว์เซอร์อยู่ — กดสวิตช์ด้านบนเพื่อเปิดใช้งาน' : 'Browser is turned off. Flip the switch in the header to turn it on.';
      hint.textContent = th
        ? 'เครื่องมือค้นหา: ' + ENGINES[this.engineIndex].name + ' — หากหน้าเว็บว่างหรือผิดพลาด ให้แตะปุ่มเครื่องมือค้นหาเพื่อเปลี่ยน'
        : 'Engine: ' + ENGINES[this.engineIndex].name + '. Blank or error page? Tap the engine button (G/B/M/W) to try another.';
      this.setZoom(this.zoomLevel);
      if (this.enabled) {
        if (frame.getAttribute('src') === 'about:blank') {
          this._pushHistory(this.currentUrl);
          this._loadFrame(this.currentUrl);
        }
      } else {
        frame.src = 'about:blank'; // stops loading, audio and scripts
      }
    }

    setEnabled(value) {
      this.enabled = !!value;
      store.set(KEY_ENABLED, this.enabled);
      this._render();
      notify(PLUGIN_NAME + (this.enabled ? ' enabled' : ' disabled'));
    }

    nextEngine() {
      this.engineIndex = (this.engineIndex + 1) % ENGINES.length;
      store.set(KEY_ENGINE, this.engineIndex);
      notify('Search engine: ' + ENGINES[this.engineIndex].name);
      this._render();
    }

    navigate(raw) {
      const url = normalizeUrl(raw, ENGINES[this.engineIndex].url);
      if (!url) return;
      if (!this.enabled) return notify('Browser is off — turn it on first');
      this.currentUrl = url;
      store.set(KEY_LAST_URL, url);
      this.refs.input.value = url;
      this._pushHistory(url);
      this._loadFrame(url);
    }

    reload() {
      if (!this.enabled) return notify('Browser is off — turn it on first');
      this._loadFrame(this.currentUrl);
    }

    goBack() {
      if (!this.enabled) return notify('Browser is off — turn it on first');
      // 1) pages opened by clicking links inside the iframe
      if (this.internalDepth > 0) {
        this.internalDepth--;
        this.loadCount = this.internalDepth + 1;
        this.ignoreLoads = 1;
        setTimeout(() => { this.ignoreLoads = 0; }, 1500);
        window.history.back();
        return;
      }
      // 2) pages opened from the address bar / Home
      if (this.stackIndex > 0) {
        this.stackIndex--;
        const url = this.stack[this.stackIndex];
        this.currentUrl = url;
        store.set(KEY_LAST_URL, url);
        this.refs.input.value = url;
        this._loadFrame(url);
        return;
      }
      notify('No previous page');
    }

    destroy() {
      try {
        if (this.onKeyDown) document.removeEventListener('keydown', this.onKeyDown, true);
        if (this.onViewportResize) window.removeEventListener('resize', this.onViewportResize);
        this.onKeyDown = null;
        this.onViewportResize = null;
        clearTimeout(this.focusTimer);
        if (this.commands) {
          this.commands.removeCommand(COMMAND_NAME);
          this.commands.removeCommand(WINDOW_COMMAND_NAME);
        }
        if (this.refs.frame) this.refs.frame.src = 'about:blank';
        if (this.win) this.win.remove();
        if (this.tab) this.tab.remove();
        if (this.styleEl) this.styleEl.remove();
        this.win = null;
        this.tab = null;
        this.refs = {};
        this.isOpen = false;
        console.log('[' + PLUGIN_NAME + '] Destroyed gracefully.');
      } catch (error) {
        console.error('[' + PLUGIN_NAME + '] Destruction failed:', error);
      }
    }
  }

  let plugin = null;

  acode.setPluginInit(PLUGIN_ID, () => {
    plugin = new WebBrowserPlugin();
    plugin.init();
  });

  acode.setPluginUnmount(PLUGIN_ID, () => {
    if (plugin) plugin.destroy();
    plugin = null;
  });
})();
