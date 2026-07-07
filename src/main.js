'use strict';

const { Plugin, Notice, TFile, TFolder, debounce } = require('obsidian');
const { DEFAULT_SETTINGS, splitLines, sanitizeFolder, inTableCell } = require('./constants');
const { BUILTIN_LANGUAGES } = require('./builtin-languages');
const { validateLanguage } = require('./language-api');
const { GlossaryLinkerSettingTab } = require('./settings-tab');
const matcher = require('./matcher');
const highlight = require('./highlight');
const actions = require('./actions');
const api = require('./api');
const { GlossaryTermSuggest, suggestAvailable } = require('./term-suggest');
const { GlossaryOverviewView, OVERVIEW_VIEW_TYPE } = require('./overview-view');
const { initI18n, t, plural } = require('./i18n');

class GlossaryLinkerPlugin extends Plugin {
  async onload() {
    initI18n();
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
    this._indexListeners = new Set(); // API onChange subscribers; needed before the first rebuild

    await this.loadLanguages();
    this.rebuildIndex();
    this.api = this.buildApi(); // app.plugins.plugins['glossary-linker'].api
    this.scheduleRebuild = debounce(() => { this.rebuildIndex(); this.rerenderViews(); this.updateStatusBar(); }, 600, true);
    this.refreshOverviewDebounced = debounce(() => this.refreshOverview(), 800, true);

    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass('mod-clickable');
    this.registerDomEvent(this.statusBarEl, 'click', () => this.materializeCurrent());
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

      // A right-click on a link in a table cell selects the cell text, so resolve the link
      // regardless of selection; its actions take precedence over the selection ones.
      const link = this.glossaryLinkAt(editor);

      if (this.settings.menuCreateTerm && hasSel && !link) {
        menu.addItem((i) => i.setTitle(t('menu.createTermLink')).setIcon('plus-circle')
          .onClick(() => this.createTermFromSelection(editor, true)));
        menu.addItem((i) => i.setTitle(t('menu.createTerm')).setIcon('file-plus')
          .onClick(() => this.createTermFromSelection(editor, false)));
      }
      if (this.settings.menuAddAbbreviation && hasSel && !link) {
        menu.addItem((i) => i.setTitle(t('menu.addAbbreviation')).setIcon('text-cursor-input')
          .onClick(() => this.addAbbreviationFromSelection(sel)));
      }
      if (this.settings.menuExclude && hasSel && !link) {
        this.addExclusionMenuItem(menu, 'excludeWords', sel, 'Glossary: ');
      }
      // On a glossary link: exclude actions target its visible text, plus unlink and collect.
      if (this.settings.menuExclude && link) {
        this.addExclusionMenuItem(menu, 'excludeWords', link.display, 'Glossary: ');
        this.addExclusionMenuItem(menu, 'excludeTerms', link.display, 'Glossary: ');
      }
      if (this.settings.menuUnlink && link) {
        menu.addItem((i) => i.setTitle(t('menu.unlinkThisTerm')).setIcon('unlink')
          .onClick(() => this.unlinkLinkAt(editor, link)));
      }
      if (this.settings.menuCollect && link && link.targetFile) {
        menu.addItem((i) => i.setTitle(t('menu.collectThisAlias')).setIcon('download')
          .onClick(() => this.harvestOneLink(link.targetFile, link.display)));
      }
      if (this.settings.menuCollect) {
        const file = this.app.workspace.getActiveFile();
        if (file) menu.addItem((i) => i.setTitle(t('menu.collectFromNote')).setIcon('download')
          .onClick(() => this.harvestFiles([file], false)));
      }
    }));

    this.registerEvent(this.app.workspace.on('file-menu', (menu, file, source) => {
      // Explorer file/folder actions only — not the menu from right-clicking a link to a note.
      if (source === 'link-context-menu') return;
      const isFolder = file instanceof TFolder;
      if (!isFolder && !(file instanceof TFile && file.extension === 'md')) return;
      const path = file.path;
      const noun = isFolder ? t('noun.folder') : t('noun.file');
      const item = (title, icon, listKey, add) => menu.addItem((i) => i.setTitle(title).setIcon(icon)
        .onClick(() => this.setPathInList(listKey, path, add)));

      if (this.pathListed('excludeFolders', path)) {
        item(t('menu.removeFromAlwaysExcluded'), 'rotate-ccw', 'excludeFolders', false);
      } else {
        item(t('menu.addToAlwaysExcluded', { noun }), 'ban', 'excludeFolders', true);
      }

      if (this.settings.scopeMode === 'folders') {
        const listed = this.pathListed('scopeFolders', path);
        if (listed) item(t('menu.removeFromScope', { noun }), 'folder-minus', 'scopeFolders', false);
        else item(t('menu.includeInScope', { noun }), 'folder-plus', 'scopeFolders', true);
      }
    }));

    // defaultMod: true → previews honour the Page Preview modifier setting, same as real links.
    this.app.workspace.registerHoverLinkSource('glossary-linker', { display: 'Glossary Linker', defaultMod: true });

    this.registerMarkdownPostProcessor((el, ctx) => this.processReadingMode(el, ctx));

    this.registerEditingHighlight();

    if (suggestAvailable()) this.registerEditorSuggest(new GlossaryTermSuggest(this.app, this));

    this.registerView(OVERVIEW_VIEW_TYPE, (leaf) => new GlossaryOverviewView(leaf, this));
    this.applyRibbonIcon();

    this.addCommand({
      id: 'open-overview',
      name: t('cmd.openOverview'),
      callback: () => this.activateOverview(),
    });
    this.addCommand({
      id: 'materialize-current',
      name: t('cmd.linkThisNote'),
      callback: () => this.materializeCurrent(),
    });
    this.addCommand({
      id: 'materialize-selection',
      name: t('cmd.linkSelection'),
      editorCallback: (editor) => this.materializeSelection(editor),
    });
    this.addCommand({
      id: 'materialize-scope',
      name: t('cmd.linkAllNotes'),
      callback: () => this.materializeScope(),
    });
    this.addCommand({
      id: 'unlink-current',
      name: t('cmd.unlinkThisNote'),
      callback: () => this.unlinkCurrent(),
    });
    this.addCommand({
      id: 'unlink-selection',
      name: t('cmd.unlinkSelection'),
      editorCallback: (editor) => this.unlinkSelection(editor),
    });
    this.addCommand({
      id: 'unlink-scope',
      name: t('cmd.unlinkAllNotes'),
      callback: () => this.unlinkScope(),
    });
    this.addCommand({
      id: 'harvest-current',
      name: t('cmd.collectThisNote'),
      callback: () => {
        const f = this.app.workspace.getActiveFile();
        if (f) this.harvestFiles([f], false);
      },
    });
    this.addCommand({
      id: 'harvest-scope',
      name: t('cmd.collectAllNotes'),
      callback: () => this.harvestFiles(this.getScopeFiles(), false),
    });
    this.addCommand({
      id: 'create-term-from-selection',
      name: t('cmd.createTerm'),
      editorCallback: (editor) => this.createTermFromSelection(editor, true),
    });
    this.addCommand({
      id: 'rebuild-index',
      name: t('cmd.rebuildIndex'),
      callback: () => { this.rebuildIndex(); new Notice(t('notice.indexRebuilt')); },
    });
    this.addCommand({
      id: 'add-abbreviation',
      name: t('cmd.addAbbreviation'),
      callback: () => this.addAbbreviation(),
    });

    this.addSettingTab(new GlossaryLinkerSettingTab(this.app, this));
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async loadLanguages() {
    // Drop malformed modules and surface them in settings instead of breaking the index.
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
      el.setText(plural('term', n));
      el.setAttribute('aria-label', t('statusBar.aria', { n }));
    } catch (e) {
      clear();
    }
  }

  isGlossaryPath(path) {
    const p = this.settings.glossaryFolder.replace(/\/+$/, '');
    if (!p) return true; // empty folder setting = whole vault is the glossary
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

  // Parse the inside of a [[...]] into { target, display, hasSubpath }. Mirrors the
  // table-escape (\| separator) and #subpath handling so every link-reading path agrees.
  parseWikiInner(inner) {
    const pipe = inner.indexOf('|');
    const rawTarget = (pipe >= 0 ? inner.slice(0, pipe) : inner).replace(/\\$/, '').trim();
    const hasSubpath = rawTarget.includes('#');
    const target = rawTarget.replace(/#.*$/, '').trim();
    const display = (pipe >= 0 ? inner.slice(pipe + 1) : target).trim();
    return { target, display, hasSubpath };
  }

  // The wikilink the cursor or selection touches if it points to a glossary term, else null.
  // Spanning the selection (not just a point) is what catches a link in a table cell, where a
  // right-click selects the cell text instead of placing a bare cursor.
  glossaryLinkAt(editor) {
    const head = editor.getCursor('head');
    const from = editor.getCursor('from');
    const to = editor.getCursor('to');
    const lineNo = head.line;
    const line = editor.getLine(lineNo);
    const selStart = from.line === lineNo ? from.ch : 0;
    const selEnd = to.line === lineNo ? to.ch : line.length;
    const re = /\[\[([^\]\n]+)\]\]/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      const s = m.index;
      const e = m.index + m[0].length;
      if (selEnd < s || selStart > e) continue;
      const { target, display } = this.parseWikiInner(m[1]);
      if (!target) continue;
      const sourcePath = this.app.workspace.getActiveFile() ? this.app.workspace.getActiveFile().path : '';
      const dest = this.app.metadataCache.getFirstLinkpathDest(target, sourcePath);
      if (dest && this.isGlossaryFile(dest)) return { canonical: dest.basename, display, targetFile: dest, line: lineNo, from: s, to: e };
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

  // Replace each match (sorted, non-overlapping) with a wikilink, right to left.
  applyLinks(text, matches) {
    const sorted = matches.slice().sort((a, b) => a.start - b.start);
    const links = sorted.map((m) => this.wikiLink(m.canonical, m.display, inTableCell(text, m.start)));
    let out = text;
    for (let j = sorted.length - 1; j >= 0; j--) {
      out = out.slice(0, sorted[j].start) + links[j] + out.slice(sorted[j].end);
    }
    const changes = sorted.map((m, j) => ({ start: m.start, before: m.display, after: links[j] }));
    return { newText: out, changes };
  }

  // Inverse of applyLinks: replace each glossary link span with its plain display text,
  // right to left. The display has no pipe, so a table cell survives without escaping.
  unlinkLinks(text, links) {
    const sorted = links.slice().sort((a, b) => a.start - b.start);
    let out = text;
    for (let j = sorted.length - 1; j >= 0; j--) {
      out = out.slice(0, sorted[j].start) + sorted[j].display + out.slice(sorted[j].end);
    }
    return { newText: out, count: sorted.length };
  }

  // Unlink the single glossary link under the cursor (from glossaryLinkAt).
  unlinkLinkAt(editor, link) {
    editor.replaceRange(link.display, { line: link.line, ch: link.from }, { line: link.line, ch: link.to });
    new Notice(t('notice.unlinked'));
    this.updateStatusBar();
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
    // sanitizeFolder so a stray trailing "/" or "./" still matches.
    const covers = (entry) => { const e = sanitizeFolder(entry); return !!e && (path === e || path.startsWith(e + '/')); };
    if (splitLines(this.settings.excludeFolders).some(covers)) return false;
    if (this.settings.scopeMode === 'folders') return splitLines(this.settings.scopeFolders).some(covers);
    return true;
  }

  getScopeFiles() {
    return this.app.vault.getMarkdownFiles().filter((f) => this.inScope(f.path));
  }

  pathListed(listKey, path) {
    const entry = sanitizeFolder(path);
    return !!entry && splitLines(this.settings[listKey]).some((l) => sanitizeFolder(l) === entry);
  }

  // Scope only affects which notes get linked, so a rerender — not a rebuild — is enough.
  async setPathInList(listKey, path, add) {
    const entry = sanitizeFolder(path);
    if (!entry || add === this.pathListed(listKey, path)) return;
    const lines = splitLines(this.settings[listKey]);
    this.settings[listKey] = (add ? [...lines, entry] : lines.filter((l) => sanitizeFolder(l) !== entry)).join('\n');
    await this.saveSettings();
    this.rerenderViews();
    this.updateStatusBar();
    this.refreshOverviewDebounced();
    const key = listKey === 'excludeFolders'
      ? (add ? 'notice.pathAddedExcluded' : 'notice.pathRemovedExcluded')
      : (add ? 'notice.pathAddedScope' : 'notice.pathRemovedScope');
    new Notice(t(key, { entry }));
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

  async activateOverview() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(OVERVIEW_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      if (!leaf) return;
      await leaf.setViewState({ type: OVERVIEW_VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  refreshOverview() {
    this.app.workspace.getLeavesOfType(OVERVIEW_VIEW_TYPE).forEach((leaf) => {
      if (leaf.view && typeof leaf.view.refresh === 'function') leaf.view.refresh();
    });
  }

  applyRibbonIcon() {
    const want = this.settings.showRibbonIcon;
    if (want && !this.ribbonEl) {
      this.ribbonEl = this.addRibbonIcon('book-a', t('ribbon.tooltip'), () => this.activateOverview());
    } else if (!want && this.ribbonEl) {
      this.ribbonEl.remove();
      this.ribbonEl = null;
    }
  }
}

Object.assign(GlossaryLinkerPlugin.prototype, matcher, highlight, actions, api);

module.exports = GlossaryLinkerPlugin;
