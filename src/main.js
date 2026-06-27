'use strict';

const { Plugin, Notice, debounce } = require('obsidian');
const { DEFAULT_SETTINGS, splitLines } = require('./constants');
const BUILTIN_LANGUAGES = require('./builtin-languages');
const { GlossaryLinkerSettingTab } = require('./settings-tab');
const matcher = require('./matcher');
const highlight = require('./highlight');
const actions = require('./actions');

class GlossaryLinkerPlugin extends Plugin {
  async onload() {
    const loaded = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
    if (loaded) {
      if (typeof loaded.linkFolders === 'string' && loaded.scopeFolders === undefined) this.settings.scopeFolders = loaded.linkFolders;
      if (typeof loaded.harvestOnSave === 'boolean') this.settings.harvestOnSave = loaded.harvestOnSave ? 'silent' : 'off';
      if (typeof loaded.highlightInLivePreview === 'boolean' && loaded.editingHighlight === undefined) this.settings.editingHighlight = loaded.highlightInLivePreview ? 'live' : 'off';
    }

    this.languages = [];
    this.activeLanguages = [];
    this.languageErrors = [];
    this.index = { byKey: new Map() };
    this.excludeWordKeys = new Set();

    await this.loadLanguages();
    this.rebuildIndex();
    this.scheduleRebuild = debounce(() => { this.rebuildIndex(); this.rerenderViews(); }, 600, true);

    this.app.workspace.onLayoutReady(() => this.rebuildIndex());

    this.registerEvent(this.app.metadataCache.on('changed', (file) => {
      if (this.isGlossaryPath(file.path)) this.scheduleRebuild();
    }));

    this.harvestOnSaveDebounced = debounce((file) => this.harvestFiles([file], this.settings.harvestOnSave !== 'preview'), 1500, true);
    this.registerEvent(this.app.vault.on('modify', (file) => {
      if (file.extension !== 'md') return;
      if (this.settings.harvestOnSave !== 'off' && this.inScope(file.path)) this.harvestOnSaveDebounced(file);
      if (this.settings.editingHighlight === 'onSave') this.refreshEditors();
    }));

    this.app.workspace.registerHoverLinkSource('glossary-linker', { display: 'Glossary Linker', defaultMod: false });

    this.registerMarkdownPostProcessor((el, ctx) => this.processReadingMode(el, ctx));

    this.registerEditingHighlight();

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
    // Start from the bundled built-ins, then let runtime modules in the vault's
    // <plugin>/languages/ folder add new languages or override a built-in by id.
    this.languages = BUILTIN_LANGUAGES.slice();
    this.languageErrors = [];
    const dir = `${this.manifest.dir}/languages`;
    const adapter = this.app.vault.adapter;
    const runtimeIds = new Set();
    try {
      if (await adapter.exists(dir)) {
        const listed = await adapter.list(dir);
        for (const path of listed.files) {
          if (!path.toLowerCase().endsWith('.js')) continue;
          const file = path.split('/').pop();
          try {
            const code = await adapter.read(path);
            const mod = { exports: {} };
            const safeRequire = (typeof require !== 'undefined') ? require : () => ({});
            new Function('module', 'exports', 'require', code)(mod, mod.exports, safeRequire);
            const lang = mod.exports;
            const problem = this.validateLanguage(lang);
            if (problem) { this.languageErrors.push({ file, error: problem }); continue; }
            if (runtimeIds.has(lang.id)) { this.languageErrors.push({ file, error: `duplicate id "${lang.id}"` }); continue; }
            runtimeIds.add(lang.id);
            const idx = this.languages.findIndex((l) => l.id === lang.id);
            if (idx >= 0) this.languages[idx] = lang; else this.languages.push(lang);
          } catch (e) {
            this.languageErrors.push({ file, error: String(e && e.message || e) });
          }
        }
      }
    } catch (e) {
      console.error('Glossary Linker: cannot list languages folder', e);
    }
    this.languages.sort((a, b) => (b.priority || 0) - (a.priority || 0) || a.name.localeCompare(b.name));
    this.languageErrors.sort((a, b) => a.file.localeCompare(b.file));

    if (!Array.isArray(this.settings.enabledLanguages)) {
      this.settings.enabledLanguages = this.languages.map((l) => l.id);
      await this.saveSettings();
    }
    this.refreshActiveLanguages();
  }

  validateLanguage(lang) {
    if (!lang || typeof lang !== 'object') return 'module does not export an object';
    if (!lang.id) return 'missing "id"';
    if (!lang.name) return 'missing "name"';
    if (typeof lang.match !== 'function') return 'missing match() function';
    if (typeof lang.keys !== 'function') return 'missing keys() function';
    return null;
  }

  refreshActiveLanguages() {
    const enabled = new Set(this.settings.enabledLanguages || []);
    this.activeLanguages = this.languages.filter((l) => enabled.has(l.id));
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

  wikiLink(canonical, display) {
    return display === canonical ? `[[${canonical}]]` : `[[${canonical}|${display}]]`;
  }

  // Replace each match (sorted, non-overlapping) with a wikilink, right to left.
  applyLinks(text, matches) {
    const sorted = matches.slice().sort((a, b) => a.start - b.start);
    let out = text;
    for (let j = sorted.length - 1; j >= 0; j--) {
      const m = sorted[j];
      out = out.slice(0, m.start) + this.wikiLink(m.canonical, m.display) + out.slice(m.end);
    }
    const changes = sorted.map((m) => ({ start: m.start, before: m.display, after: this.wikiLink(m.canonical, m.display) }));
    return { newText: out, changes };
  }

  // Navigation / preview shared by Reading view and the editor.
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

Object.assign(GlossaryLinkerPlugin.prototype, matcher, highlight, actions);

module.exports = GlossaryLinkerPlugin;
