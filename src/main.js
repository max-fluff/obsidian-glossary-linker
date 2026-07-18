'use strict';

const { Plugin, Notice, TFile, TFolder, debounce } = require('obsidian');
const { DEFAULT_SETTINGS, sanitizeFolder } = require('./constants');
const { splitLines, inTableCell } = require('./shared/markdown');
const { BUILTIN_LANGUAGES } = require('./shared/morphology/builtin-languages');
const { validateLanguage } = require('./shared/morphology/language-api');
const { GlossaryLinkerSettingTab } = require('./settings-tab');
const matcher = require('./matcher');
const highlight = require('./highlight');
const actions = require('./actions');
const api = require('./api');
const { GlossaryTermSuggest, suggestAvailable } = require('./term-suggest');
const { GlossaryOverviewView, OVERVIEW_VIEW_TYPE } = require('./overview-view');
const { initI18n, t, plural } = require('./shared/i18n');
const { menuSection } = require('./shared/menu');

class GlossaryLinkerPlugin extends Plugin {
  async onload() {
    initI18n({
      en: require('./locales/en'), ru: require('./locales/ru'), de: require('./locales/de'),
      es: require('./locales/es'), fr: require('./locales/fr'), uk: require('./locales/uk'),
    });
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
    // path -> JSON(canonical+aliases) as of the last rebuild. Lets the 'changed'
    // handler tell "this note's term identity changed" from "its body changed" —
    // in whole-vault mode every note is a glossary file, so without this every
    // keystroke pause anywhere would trigger a full rebuildIndex().
    this.aliasFingerprints = new Map();
    this._indexListeners = new Set(); // API onChange subscribers; needed before the first rebuild

    await this.loadLanguages();
    this.rebuildIndex();
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
      if (!this.isGlossaryPath(file.path)) return;
      // Only the title (unchanged by an edit) and the aliases frontmatter define a
      // term, so a rebuild is only warranted when the aliases actually differ from
      // what's already indexed — not on every edit to the note's body.
      const next = JSON.stringify(this.aliasesOf(file));
      if (this.aliasFingerprints.get(file.path) === next) return;
      this.aliasFingerprints.set(file.path, next);
      this.scheduleRebuild();
    }));
    // 'changed' fires on edits but not on add/remove/rename — a new or renamed term
    // note (the title is the term) must also rebuild the index.
    this.registerEvent(this.app.vault.on('create', (file) => {
      if (this.isGlossaryPath(file.path)) this.scheduleRebuild();
    }));
    this.registerEvent(this.app.vault.on('delete', (file) => {
      if (!this.isGlossaryPath(file.path)) return;
      this.aliasFingerprints.delete(file.path);
      this.scheduleRebuild();
    }));
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      if (!this.isGlossaryPath(file.path) && !this.isGlossaryPath(oldPath)) return;
      this.aliasFingerprints.delete(oldPath);
      this.scheduleRebuild();
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

      const file = this.app.workspace.getActiveFile();
      const sourcePath = file ? file.path : '';

      // Flat, and named for the list it writes to: "excluded words"/"excluded terms" are
      // already ours and "excluded headings" is already the heading linker's, so the wording
      // tells them apart on its own. Wrapping one item in a submenu titled with the plugin
      // name only added a click.
      const excludeItems = (value, ...listKeys) => {
        if (!this.settings.menuExclude) return;
        for (const key of listKeys) this.addExclusionMenuItem(menu, key, value);
      };

      // On one of our links: unlink, exclude, collect its wording as an alias.
      if (link) {
        if (this.settings.menuUnlink) {
          menu.addItem((i) => i.setTitle(t('menu.unlinkThisTerm')).setIcon('unlink')
            .onClick(() => this.unlinkLinkAt(editor, link)));
        }
        if (this.settings.menuCollect && link.targetFile) {
          menu.addItem((i) => i.setTitle(t('menu.collectThisAlias')).setIcon('download')
            .onClick(() => this.harvestOneLink(link.targetFile, link.display)));
        }
        excludeItems(link.display, 'excludeWords', 'excludeTerms');
        return;
      }

      // On a selection that isn't a link: make a term out of it.
      if (hasSel) {
        if (this.settings.menuCreateTerm) {
          menu.addItem((i) => i.setTitle(t('menu.createTermLink')).setIcon('plus-circle')
            .onClick(() => this.createTermFromSelection(editor, true)));
          menu.addItem((i) => i.setTitle(t('menu.createTerm')).setIcon('file-plus')
            .onClick(() => this.createTermFromSelection(editor, false)));
        }
        if (this.settings.menuAddAlias) {
          menu.addItem((i) => i.setTitle(t('menu.addAlias')).setIcon('text-cursor-input')
            .onClick(() => this.addAliasFromSelection(sel)));
        }
        excludeItems(sel, 'excludeWords');
        return;
      }

      // A highlighted word that isn't a link yet: the other half of the same toggle, so it
      // sits in the same menu rather than in one of our own.
      const hit = this.matchAtCursor(editor);
      if (hit) {
        const display = hit.match.display;
        const canonical = hit.match.canonical;
        const candidates = () => this.cursorCandidates(hit, sourcePath, false);
        if (file && this.settings.menuTurnInto) {
          // Three ways to link the same word differ only in how far they reach, so they are
          // one entry with a choice inside rather than three lines competing for attention.
          const scope = this.settings.linkFirstOnly ? t('scope.first') : t('scope.all');
          const linkGroup = menuSection(menu, t('menu.linkThisWord', { display }), true, 'link');
          linkGroup.addItem((i) => i.setTitle(t('menu.linkHere', { display })).setIcon('link')
            .onClick(() => this.chooseTerm(candidates(), t('menu.linkDisplayTo', { display }),
              (c) => this.materializeSingle(file, canonical, display, editor.posToOffset({ line: hit.line, ch: hit.match.start }), 0, c))));
          linkGroup.addItem((i) => i.setTitle(t('menu.linkScopeThisNote', { scope, display })).setIcon('links-coming-in')
            .onClick(() => this.chooseTerm(candidates(), t('menu.linkScopeTo', { scope, display }),
              (c) => this.materializeTerm(file, canonical, c))));
          linkGroup.addItem((i) => i.setTitle(t('menu.linkScopeAllNotes', { scope, display })).setIcon('links-going-out')
            .onClick(() => this.chooseTerm(candidates(), t('menu.linkScopeTo', { scope, display }),
              (c) => this.materializeTermScope(canonical, c))));
        }
        if (this.settings.menuOpen) {
          menu.addItem((i) => i.setTitle(t('menu.openThisWord', { display })).setIcon('file-text')
            .onClick(() => this.chooseTerm(candidates(), t('menu.openTitle'), (c) => this.openTerm(c, sourcePath, false))));
        }
        excludeItems(display, 'excludeTerms');
        return;
      }

      // A word the sibling owns. We draw nothing on it, but we do match it, so the one thing
      // still worth offering is the setting that makes us stop.
      const word = this.wordAtCursor(editor);
      if (word) {
        excludeItems(word.canonical, 'excludeTerms');
        return;
      }
    }));

    this.registerEvent(this.app.workspace.on('file-menu', (menu, file, source) => {
      // Explorer file/folder actions only — not the menu from right-clicking a link to a note.
      if (source === 'link-context-menu') return;
      const isFolder = file instanceof TFolder;
      if (!isFolder && !(file instanceof TFile && file.extension === 'md')) return;
      const path = file.path;
      const noun = isFolder ? t('noun.folder') : t('noun.file');
      // Flat. Every one of these titles already begins with "Glossary:", so a submenu named
      // after the plugin said the same thing twice — and with the common settings it held a
      // single item, which is a click to reach one line.
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

      // Harvesting reads the note's links, so it belongs on the note rather than on a spot
      // in the text — where it had nothing to do with what was under the cursor, and where
      // both linkers offered it at once. Flat and named for what it collects, so the sibling's
      // version reads as a different action rather than a duplicate of this one.
      if (this.settings.menuCollect && !isFolder) {
        menu.addItem((i) => i.setTitle(t('menu.collectFromNote')).setIcon('download')
          .onClick(() => this.harvestFiles([file], false)));
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
      id: 'add-alias',
      name: t('cmd.addAlias'),
      callback: () => this.addAlias(),
    });

    this.addSettingTab(new GlossaryLinkerSettingTab(this.app, this));

    // Published last, and deliberately so. The api (app.plugins.plugins['glossary-linker'].api)
    // is how a sibling linker finds us and decides to stand down on a word we both match — so
    // a load that throws before this point leaves no provider behind, and the sibling keeps
    // highlighting instead of yielding to a plugin that never came up.
    this.api = this.buildApi();
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
