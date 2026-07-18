'use strict';

// Stubs rich enough to construct a plugin and run onload(), so a load-time failure is
// caught by the tests instead of by opening Obsidian. Deliberately hollow: it proves the
// code runs, not that it behaves — behaviour belongs in the focused tests.

const Module = require('module');
const path = require('path');

global.window = { localStorage: { getItem: () => 'en' } };
global.document = { createElement: () => ({ style: {}, setAttribute: () => {}, addEventListener: () => {} }), createTreeWalker: () => ({ nextNode: () => false }), createDocumentFragment: () => ({ appendChild: () => {} }) };

const noop = () => {};
const chainable = () => {
  const o = {};
  const self = () => o;
  for (const k of ['setTitle', 'setIcon', 'setDesc', 'setName', 'onClick', 'setValue', 'onChange',
    'addOption', 'setPlaceholder', 'setDisabled', 'setTooltip', 'setCta', 'setButtonText',
    'setHeading', 'addText', 'addTextArea', 'addToggle', 'addDropdown', 'addButton',
    'addExtraButton', 'addSearch', 'setLimits', 'setDynamicTooltip', 'then']) o[k] = self;
  o.setSubmenu = () => menuLike();
  o.inputEl = { type: '', min: '', focus: noop, select: noop, addEventListener: noop, rows: 0 };
  o.controlEl = elLike();
  o.settingEl = elLike();
  o.nameEl = elLike();
  return o;
};
const menuLike = () => ({ addItem: (cb) => { cb(chainable()); return menuLike(); }, addSeparator: noop, showAtMouseEvent: noop });
function elLike() {
  const el = {
    createEl: () => elLike(), createDiv: () => elLike(), createSpan: () => elLike(),
    empty: noop, addClass: noop, removeClass: noop, setText: noop, appendChild: noop,
    hide: noop, show: noop, toggleClass: noop, detach: noop, remove: noop,
    querySelectorAll: () => [], setAttribute: noop, getAttribute: () => null, removeAttribute: noop,
    hasAttribute: () => false, closest: () => null, replaceChild: noop, parentNode: null,
    addEventListener: noop, style: {}, classList: { add: noop, contains: () => false, toggle: noop },
    onclick: null, checked: false,
  };
  return el;
}

const stub = {
  Plugin: class { constructor(app, manifest) { this.app = app; this.manifest = manifest || { version: '0.0.0' }; } },
  Notice: class {}, Modal: class { constructor(app) { this.app = app; } },
  SuggestModal: class {}, FuzzySuggestModal: class {}, EditorSuggest: class {},
  AbstractInputSuggest: class {}, PopoverSuggest: class {}, ItemView: class {}, WorkspaceLeaf: class {}, Component: class {},
  PluginSettingTab: class { constructor(app, plugin) { this.app = app; this.plugin = plugin; } },
  Setting: class { constructor() { return chainable(); } },
  MarkdownView: class {}, TFile: class {}, TFolder: class {}, Menu: class { constructor() { return menuLike(); } },
  MarkdownRenderChild: class { constructor(containerEl) { this.containerEl = containerEl; } },
  Platform: { isMobile: false, isDesktop: true },
  debounce: (fn) => fn, normalizePath: (p) => p, moment: () => ({ format: () => '' }),
  prepareFuzzySearch: () => () => null, loadPdfJs: () => Promise.resolve(null),
};
stub.Plugin.prototype.addStatusBarItem = () => elLike();
stub.Plugin.prototype.addRibbonIcon = () => elLike();
stub.Plugin.prototype.registerEvent = noop;
stub.Plugin.prototype.registerDomEvent = noop;
stub.Plugin.prototype.registerMarkdownPostProcessor = noop;
stub.Plugin.prototype.registerMarkdownCodeBlockProcessor = noop;
stub.Plugin.prototype.registerInterval = noop;
stub.Plugin.prototype.registerEditorExtension = noop;
stub.Plugin.prototype.registerEditorSuggest = noop;
stub.Plugin.prototype.registerView = noop;
stub.Plugin.prototype.addCommand = noop;
stub.Plugin.prototype.addSettingTab = noop;
stub.Plugin.prototype.register = noop;
stub.Plugin.prototype.loadData = () => Promise.resolve({});
stub.Plugin.prototype.saveData = () => Promise.resolve();

const cm = {
  ViewPlugin: { fromClass: () => ({}) }, Decoration: { mark: () => ({}), none: {} },
  EditorView: { domEventHandlers: () => ({}), findFromDOM: () => null },
  RangeSetBuilder: class { add() {} finish() { return {}; } },
  StateEffect: { define: () => ({ of: () => ({}) }) },
  Prec: { highest: (x) => x }, syntaxTree: () => ({ iterate: noop }),
};

function installStubs() {
  const resolve = Module._resolveFilename;
  Module._resolveFilename = function (q, ...a) {
    if (q === 'obsidian') return 'OBSIDIAN_STUB';
    if (q.startsWith('@codemirror')) return 'CM_STUB';
    return resolve.call(this, q, ...a);
  };
  require.cache.OBSIDIAN_STUB = { id: 'OBSIDIAN_STUB', filename: 'OBSIDIAN_STUB', loaded: true, exports: stub };
  require.cache.CM_STUB = { id: 'CM_STUB', filename: 'CM_STUB', loaded: true, exports: cm };
}

// Handlers the plugin registers, kept so a test can fire one. Without this the menu-building
// code — the part most often changed and most often broken — is never actually run.
const handlers = new Map();

const app = {
  plugins: { plugins: {} },
  handlers,
  workspace: {
    on: (name, fn) => { handlers.set(name, fn); return {}; },
    getActiveFile: () => null,
    // Deliberately never fires. What is under test is that onload wires itself up without
    // throwing; the layout-ready callback kicks off a full filesystem index scan, which for
    // the sigil plugins walks real directories and leaves watchers running, so the test
    // process would do a lot of unrelated work and then refuse to exit.
    onLayoutReady: noop,
    trigger: noop, iterateAllLeaves: noop, getActiveViewOfType: () => null,
    registerHoverLinkSource: noop, getLeavesOfType: () => [], detachLeavesOfType: noop,
  },
  vault: { on: () => ({}), getMarkdownFiles: () => [], adapter: { getBasePath: () => 'C:/vault' }, cachedRead: () => Promise.resolve('') },
  metadataCache: { on: () => ({}), getFileCache: () => null, getFirstLinkpathDest: () => null },
};

// A menu that records what was put in it, including inside submenus, so a test can assert on
// the titles a reader would actually see.
function recordingMenu() {
  const items = [];
  const make = (prefix) => ({
    addItem(cb) {
      const entry = { title: '', icon: null, prefix };
      const item = {
        setTitle(v) { entry.title = String(v); return item; },
        setIcon(v) { entry.icon = v; return item; },
        setDisabled() { return item; },
        onClick(fn) { entry.click = fn; return item; },
        setSubmenu() { entry.submenu = true; return make(entry.title); },
      };
      items.push(entry);
      cb(item);
      return this;
    },
    addSeparator() { return this; },
  });
  const menu = make(null);
  menu.items = items;
  // "Parent ▸ Child" for a nested item, plain title for a top-level one.
  menu.titles = () => items.filter((e) => !e.submenu).map((e) => (e.prefix ? `${e.prefix} ▸ ${e.title}` : e.title));
  menu.groups = () => items.filter((e) => e.submenu).map((e) => e.title);
  return menu;
}

// The bits of the editor the menu handlers ask about.
function fakeEditor(line, ch) {
  const at = { line: 0, ch };
  return {
    getCursor: () => at,
    getLine: () => line,
    getValue: () => line,
    getSelection: () => '',
    posToOffset: (p) => p.ch,
    offsetToPos: (o) => ({ line: 0, ch: o }),
  };
}

module.exports = { obsidianStub: stub, cmStub: cm, fakeApp: app, installStubs, recordingMenu, fakeEditor };
