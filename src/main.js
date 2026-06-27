'use strict';

const { Plugin, Notice, debounce } = require('obsidian');
const { DEFAULT_SETTINGS, splitLines, sanitizeFolder } = require('./constants');
const BUILTIN_LANGUAGES = require('./builtin-languages');
const { validateLanguage } = require('./language-api');
const { GlossaryLinkerSettingTab } = require('./settings-tab');
const matcher = require('./matcher');
const highlight = require('./highlight');
const actions = require('./actions');
const api = require('./api');
const { GlossaryTermSuggest, suggestAvailable } = require('./term-suggest');

class GlossaryLinkerPlugin extends Plugin {
  async onload() {
    const loaded = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
    if (loaded) {
      if (typeof loaded.linkFolders === 'string' && loaded.scopeFolders === undefined) this.settings.scopeFolders = loaded.linkFolders;
      if (typeof loaded.harvestOnSave === 'boolean') this.settings.harvestOnSave = loaded.harvestOnSave ? 'silent' : 'off';
      if (typeof loaded.highlightInLivePreview === 'boolean' && loaded.editingHighlight === undefined) this.settings.editingHighlight = loaded.highlightInLivePreview ? 'live' : 'off';
    }
    this.settings.glossaryFolder = sanitizeFolder(this.settings.glossaryFolder);

    this.languages = [];
    this.activeLanguages = [];
    this.languageErrors = [];
    this.index = { byKey: new Map(), termCount: 0 };
    this.excludeWordKeys = new Set();
    this.keysCache = new Map();
    this.terms = [];
    this._indexListeners = new Set(); // API onChange subscribers; must exist before the first rebuild

    await this.loadLanguages();
    this.rebuildIndex();
    this.api = this.buildApi(); // app.plugins.plugins['glossary-linker'].api
    this.scheduleRebuild = debounce(() => { this.rebuildIndex(); this.rerenderViews(); this.updateStatusBar(); }, 600, true);

    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass('mod-clickable');
    this.statusBarEl.addEventListener('click', () => this.materializeCurrent());
    this.updateStatusBarDebounced = debounce(() => this.updateStatusBar(), 400, true);
    this.registerEvent(this.app.workspace.on('file-open', () => this.updateStatusBarDebounced()));
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.updateStatusBarDebounced()));

    this.app.workspace.onLayoutReady(() => { this.rebuildIndex(); this.updateStatusBar(); });

    this.registerEvent(this.app.metadataCache.on('changed', (file) => {
      if (this.isGlossaryPath(file.path)) this.scheduleRebuild();
    }));
    // 'changed' fires on edits but not on add/remove/rename — a new or renamed term
    // note (the title is the term) must also rebuild the index.
    this.registerEvent(this.app.vault.on('create', (file) => {
      if (this.isGlossaryPath(file.path)) this.scheduleRebuild();
    }));
    this.registerEvent(this.app.vault.on('delete', (file) => {
      if (this.isGlossaryPath(file.path)) this.scheduleRebuild();
    }));
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      if (this.isGlossaryPath(file.path) || this.isGlossaryPath(oldPath)) this.scheduleRebuild();
    }));

    this.harvestOnSaveDebounced = debounce((file) => this.harvestFiles([file], this.settings.harvestOnSave !== 'preview'), 1500, true);
    this.registerEvent(this.app.vault.on('modify', (file) => {
      if (file.extension !== 'md') return;
      if (this.settings.harvestOnSave !== 'off' && this.inScope(file.path)) this.harvestOnSaveDebounced(file);
      if (this.settings.editingHighlight === 'onSave') this.refreshEditors();
      const active = this.app.workspace.getActiveFile();
      if (active && active.path === file.path) this.updateStatusBarDebounced();
    }));

    this.registerEvent(this.app.workspace.on('editor-menu', (menu, editor) => {
      const sel = editor.getSelection().trim();
      const hasSel = !!sel && !sel.includes('\n');

      if (this.settings.menuCreateTerm && hasSel) {
        menu.addItem((i) => i.setTitle('Glossary: create term & link').setIcon('plus-circle')
          .onClick(() => this.createTermFromSelection(editor, true)));
        menu.addItem((i) => i.setTitle('Glossary: create term').setIcon('file-plus')
          .onClick(() => this.createTermFromSelection(editor, false)));
      }
      if (this.settings.menuExclude && hasSel) {
        menu.addItem((i) => i.setTitle(`Glossary: add "${sel}" to excluded words`).setIcon('ban')
          .onClick(() => this.addToExclusion('excludeWords', sel.toLowerCase())));
      }
      // Right-clicking a wikilink to a glossary term (no selection): same exclude
      // actions, targeting the link's visible text.
      if (this.settings.menuExclude && !hasSel) {
        const link = this.glossaryLinkAt(editor);
        if (link) {
          menu.addItem((i) => i.setTitle(`Glossary: add "${link.display}" to excluded words`).setIcon('ban')
            .onClick(() => this.addToExclusion('excludeWords', link.display.toLowerCase())));
          menu.addItem((i) => i.setTitle(`Glossary: add "${link.display}" to excluded terms`).setIcon('trash-2')
            .onClick(() => this.addToExclusion('excludeTerms', link.display)));
        }
      }
      if (this.settings.menuCollect) {
        const file = this.app.workspace.getActiveFile();
        if (file) menu.addItem((i) => i.setTitle('Glossary: collect aliases from links (this note)').setIcon('download')
          .onClick(() => this.harvestFiles([file], false)));
      }
    }));

    // defaultMod: true → previews honour the Page Preview modifier setting, same as real links.
    this.app.workspace.registerHoverLinkSource('glossary-linker', { display: 'Glossary Linker', defaultMod: true });

    this.registerMarkdownPostProcessor((el, ctx) => this.processReadingMode(el, ctx));

    this.registerEditingHighlight();

    if (suggestAvailable()) this.registerEditorSuggest(new GlossaryTermSuggest(this.app, this));

    this.addCommand({
      id: 'materialize-current',
      name: 'Turn terms into links: this note',
      callback: () => this.materializeCurrent(),
    });
    this.addCommand({
      id: 'materialize-selection',
      name: 'Turn terms into links: selection',
      editorCallback: (editor) => this.materializeSelection(editor),
    });
    this.addCommand({
      id: 'materialize-scope',
      name: 'Turn terms into links: all notes',
      callback: () => this.materializeScope(),
    });
    this.addCommand({
      id: 'harvest-current',
      name: 'Collect aliases from links: this note',
      callback: () => {
        const f = this.app.workspace.getActiveFile();
        if (f) this.harvestFiles([f], false);
      },
    });
    this.addCommand({
      id: 'harvest-scope',
      name: 'Collect aliases from links: all notes',
      callback: () => this.harvestFiles(this.getScopeFiles(), false),
    });
    this.addCommand({
      id: 'create-term-from-selection',
      name: 'Create glossary term from selection',
      editorCallback: (editor) => this.createTermFromSelection(editor, true),
    });
    this.addCommand({
      id: 'rebuild-index',
      name: 'Rebuild glossary index',
      callback: () => { this.rebuildIndex(); new Notice('Glossary Linker: index rebuilt'); },
    });

    this.addSettingTab(new GlossaryLinkerSettingTab(this.app, this));
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async loadLanguages() {
    // Validate the bundled modules; a malformed one is dropped and listed in
    // settings rather than breaking the index. Nothing is loaded at runtime.
    this.languages = [];
    this.languageErrors = [];
    const seen = new Set();
    for (const lang of BUILTIN_LANGUAGES) {
      const id = lang && lang.id;
      const error = validateLanguage(lang);
      if (error) { this.languageErrors.push({ id: id || '?', error }); continue; }
      if (seen.has(id)) { this.languageErrors.push({ id, error: `duplicate id "${id}"` }); continue; }
      seen.add(id);
      this.languages.push(lang);
    }
    this.sortLanguages();
    this.languageErrors.sort((a, b) => a.id.localeCompare(b.id));

    if (!Array.isArray(this.settings.enabledLanguages)) {
      // First run: enable English plus the Obsidian interface language, if present.
      const sys = (window.localStorage.getItem('language') || '').split('-')[0].toLowerCase();
      const wanted = new Set(['en']);
      if (sys && this.languages.some((l) => l.id === sys)) wanted.add(sys);
      this.settings.enabledLanguages = this.languages.filter((l) => wanted.has(l.id)).map((l) => l.id);
      await this.saveSettings();
    }
    this.refreshActiveLanguages();
  }

  sortLanguages() {
    const order = this.settings.languageOrder || [];
    const rank = (l) => { const i = order.indexOf(l.id); return i === -1 ? Infinity : i; };
    this.languages.sort((a, b) =>
      rank(a) - rank(b) || (b.priority || 0) - (a.priority || 0) || a.name.localeCompare(b.name));
  }

  moveLanguage(id, dir) {
    const ids = this.languages.map((l) => l.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    this.settings.languageOrder = ids;
    this.sortLanguages();
  }

  refreshActiveLanguages() {
    const enabled = new Set(this.settings.enabledLanguages || []);
    this.activeLanguages = this.languages.filter((l) => enabled.has(l.id));
    this.keysCache = new Map();
  }

  async updateStatusBar() {
    const el = this.statusBarEl;
    if (!el) return;
    const clear = () => { el.setText(''); el.removeAttribute('aria-label'); };
    if (!this.settings.statusBar) return clear();
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== 'md' || !this.inScope(file.path)) return clear();
    try {
      const text = await this.app.vault.cachedRead(file);
      // protect:true counts only plain-text mentions; linked terms are added below.
      const canon = new Set(this.findMatches(text, this.canonicalForPath(file.path), { protect: true }).map((m) => m.canonical));
      if (this.settings.statusBarIncludeLinks) {
        const cache = this.app.metadataCache.getFileCache(file);
        for (const link of (cache && cache.links) || []) {
          const dest = this.app.metadataCache.getFirstLinkpathDest(link.link, file.path);
          if (dest && this.isGlossaryFile(dest)) canon.add(dest.basename);
        }
      }
      const n = canon.size;
      el.setText(`${n} term${n === 1 ? '' : 's'}`);
      el.setAttribute('aria-label', `${n} glossary term(s) on this page — click to turn into links`);
    } catch (e) {
      clear();
    }
  }

  isGlossaryPath(path) {
    const p = this.settings.glossaryFolder.replace(/\/+$/, '');
    return path === `${p}.md` || path.startsWith(`${p}/`);
  }

  isGlossaryFile(file) {
    return file && file.extension === 'md' && this.isGlossaryPath(file.path);
  }

  async ensureGlossaryFolder() {
    const path = this.settings.glossaryFolder.replace(/\/+$/, '');
    if (!path || this.app.vault.getAbstractFileByPath(path)) return;
    try { await this.app.vault.createFolder(path); } catch (e) { /* already exists / race */ }
  }

  canonicalForPath(path) {
    if (!path || !this.isGlossaryPath(path)) return null;
    const base = path.split('/').pop();
    return base.replace(/\.md$/, '');
  }

  // The wikilink under the editor cursor if it points to a glossary term, else null.
  // Returns { canonical, display } (display = the link's visible text).
  glossaryLinkAt(editor) {
    const pos = editor.getCursor();
    const line = editor.getLine(pos.line);
    const re = /\[\[([^\]\n]+)\]\]/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      if (pos.ch < m.index || pos.ch > m.index + m[0].length) continue;
      const inner = m[1];
      const pipe = inner.indexOf('|');
      // Strip an escaped-pipe backslash (table cells) and any #subpath from the target.
      const target = (pipe >= 0 ? inner.slice(0, pipe) : inner).replace(/\\$/, '').replace(/#.*$/, '').trim();
      const display = (pipe >= 0 ? inner.slice(pipe + 1) : target).trim();
      if (!target) continue;
      const sourcePath = this.app.workspace.getActiveFile() ? this.app.workspace.getActiveFile().path : '';
      const dest = this.app.metadataCache.getFirstLinkpathDest(target, sourcePath);
      if (dest && this.isGlossaryFile(dest)) return { canonical: dest.basename, display };
    }
    return null;
  }

  aliasesOf(file) {
    const fm = this.app.metadataCache.getFileCache(file);
    const a = fm && fm.frontmatter && fm.frontmatter.aliases;
    if (Array.isArray(a)) return a.filter((x) => typeof x === 'string' && x.trim());
    if (typeof a === 'string' && a.trim()) return [a];
    return [];
  }

  activeCanonical() {
    const f = this.app.workspace.getActiveFile();
    return f ? this.canonicalForPath(f.path) : null;
  }

  wikiLink(canonical, display, inTable) {
    if (display === canonical) return `[[${canonical}]]`;
    // Inside a Markdown table cell the alias pipe must be escaped or it splits the row.
    return inTable ? `[[${canonical}\\|${display}]]` : `[[${canonical}|${display}]]`;
  }

  // A line counts as a table row if it contains a pipe.
  inTableCell(text, pos) {
    const ls = text.lastIndexOf('\n', pos - 1) + 1;
    let le = text.indexOf('\n', pos);
    if (le === -1) le = text.length;
    return text.slice(ls, le).includes('|');
  }

  // Replace each match (sorted, non-overlapping) with a wikilink, right to left.
  applyLinks(text, matches) {
    const sorted = matches.slice().sort((a, b) => a.start - b.start);
    const links = sorted.map((m) => this.wikiLink(m.canonical, m.display, this.inTableCell(text, m.start)));
    let out = text;
    for (let j = sorted.length - 1; j >= 0; j--) {
      out = out.slice(0, sorted[j].start) + links[j] + out.slice(sorted[j].end);
    }
    const changes = sorted.map((m, j) => ({ start: m.start, before: m.display, after: links[j] }));
    return { newText: out, changes };
  }

  openTerm(canonical, sourcePath, newTab) {
    this.app.workspace.openLinkText(canonical, sourcePath || '', newTab);
  }

  hoverTerm(event, targetEl, canonical, sourcePath) {
    this.app.workspace.trigger('hover-link', {
      event, source: 'glossary-linker', hoverParent: this, targetEl, linktext: canonical, sourcePath: sourcePath || '',
    });
  }

  inScope(path) {
    for (const ex of splitLines(this.settings.excludeFolders)) {
      if (path === ex || path.startsWith(ex + '/')) return false;
    }
    const folders = splitLines(this.settings.scopeFolders);
    const inFolders = folders.some((lf) => path.startsWith(lf + '/'));
    if (this.settings.scopeMode === 'folders') return inFolders;
    if (this.settings.scopeMode === 'except') return !inFolders;
    return true;
  }

  getScopeFiles() {
    return this.app.vault.getMarkdownFiles().filter((f) => this.inScope(f.path));
  }

  rerenderViews() {
    this.app.workspace.getLeavesOfType('markdown').forEach((leaf) => {
      const v = leaf.view;
      if (v && v.previewMode && typeof v.previewMode.rerender === 'function') v.previewMode.rerender(true);
    });
    this.refreshEditors();
  }

  refreshEditors() {
    if (!this.cmRefreshEffect) return;
    this.app.workspace.getLeavesOfType('markdown').forEach((leaf) => {
      const cm = leaf.view && leaf.view.editor && leaf.view.editor.cm;
      if (cm) cm.dispatch({ effects: this.cmRefreshEffect.of(null) });
    });
  }
}

Object.assign(GlossaryLinkerPlugin.prototype, matcher, highlight, actions, api);

module.exports = GlossaryLinkerPlugin;
