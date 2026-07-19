'use strict';

const { Notice, TFile, moment } = require('obsidian');
const { splitLines, wordAt } = require('./shared/markdown');
const {
  MaterializePreviewModal, HarvestPreviewModal, ChooseTermModal, UnlinkPreviewModal,
  TermPickerModal, AliasTextModal,
} = require('./modals');
const { candidatesFor } = require('./shared/discover');
const { t, plural } = require('./shared/i18n');

// Turning terms into links + collecting aliases. Mixed into the plugin prototype.
module.exports = {
  // Ambiguous matches keep their `alts` so the preview can let the user pick a term.
  collectMatches(text, currentCanonical) {
    const matches = this.findMatches(text, currentCanonical, { protect: true });
    if (!this.settings.linkFirstOnly) return matches;
    const seen = new Set();
    const out = [];
    for (const m of matches) {
      if (seen.has(m.canonical)) continue;
      seen.add(m.canonical);
      out.push(m);
    }
    return out;
  },

  openMaterializePreview(files, onApply) {
    new MaterializePreviewModal(this.app, files, this, onApply).open();
  },

  // Write each result, skipping notes edited since the preview was built.
  async writeScopeResults(results) {
    let total = 0;
    let skipped = 0;
    for (const r of results) {
      let written = false;
      // process reads and writes atomically; the guard inside drops notes touched since the preview.
      await this.app.vault.process(r.file, (data) => {
        if (data !== r.original) return data;
        written = true;
        return r.newText;
      });
      if (written) total += r.count;
      else skipped++;
    }
    let msg = t('notice.scopeWritten', { files: plural('file', results.length - skipped), links: plural('link', total) });
    if (skipped) msg += t('notice.scopeSkipped', { n: skipped });
    new Notice(msg);
    this.updateStatusBar();
  },

  async materializeCurrent() {
    const file = this.app.workspace.getActiveFile();
    if (!file) { new Notice(t('notice.noActiveNote')); return; }
    const text = await this.app.vault.cachedRead(file);
    const matches = this.collectMatches(text, this.canonicalForPath(file.path));
    if (!matches.length) { new Notice(t('notice.noMatches')); return; }
    this.openMaterializePreview([{ file, original: text, matches }], async (results) => {
      const r = results[0];
      let written = false;
      await this.app.vault.process(r.file, (data) => {
        if (data !== r.original) return data;
        written = true;
        return r.newText;
      });
      if (!written) {
        new Notice(t('notice.noteChanged'));
        return;
      }
      new Notice(t('notice.linksCreated', { links: plural('link', r.count) }));
      this.updateStatusBar();
    });
  },

  materializeSelection(editor) {
    const sel = editor.getSelection();
    if (!sel) { new Notice(t('notice.noSelection')); return; }
    const file = this.app.workspace.getActiveFile();
    const matches = this.collectMatches(sel, file ? this.canonicalForPath(file.path) : null);
    if (!matches.length) { new Notice(t('notice.noMatches')); return; }
    this.openMaterializePreview([{ file: null, original: sel, matches, label: t('label.selection') }], (results) => {
      editor.replaceSelection(results[0].newText);
      new Notice(t('notice.linksCreated', { links: plural('link', results[0].count) }));
    });
  },

  async scanScopeMatches(compute) {
    const files = this.getScopeFiles();
    const out = [];
    const notice = new Notice(t('notice.scanning'), 0);
    try {
      for (let i = 0; i < files.length; i++) {
        if (i % 25 === 0) notice.setMessage(t('notice.scanningProgress', { current: i + 1, total: files.length }));
        const file = files[i];
        const text = await this.app.vault.cachedRead(file);
        const matches = compute(text, file);
        if (matches.length) out.push({ file, original: text, matches });
      }
    } finally {
      notice.hide();
    }
    return out;
  },

  async materializeScope() {
    const files = await this.scanScopeMatches((text, file) =>
      this.collectMatches(text, this.canonicalForPath(file.path)));
    if (!files.length) { new Notice(t('notice.noMatches')); return; }
    this.openMaterializePreview(files, (results) => this.writeScopeResults(results));
  },

  // Glossary wikilinks in `text` that unlink can revert: each resolves to a glossary note,
  // sits outside code/frontmatter, and isn't a #subpath link (those are deliberate — reverting
  // would drop the anchor). Offsets are into `text`.
  findGlossaryLinks(text, sourcePath) {
    const ranges = this.codeFrontmatterRanges(text);
    const re = /\[\[([^\]\n]+)\]\]/g;
    const out = [];
    let m;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;
      if (this.overlapsProtected(ranges, start, end)) continue;
      const { target, display, hasSubpath } = this.parseWikiInner(m[1]);
      if (!target || !display || hasSubpath) continue;
      const dest = this.app.metadataCache.getFirstLinkpathDest(target, sourcePath || '');
      if (!dest || !this.isGlossaryFile(dest)) continue;
      out.push({ start, end, canonical: dest.basename, display, source: m[0] });
    }
    return out;
  },

  openUnlinkPreview(files, onApply) {
    new UnlinkPreviewModal(this.app, files, this, onApply).open();
  },

  async unlinkCurrent() {
    const file = this.app.workspace.getActiveFile();
    if (!file) { new Notice(t('notice.noActiveNote')); return; }
    const text = await this.app.vault.cachedRead(file);
    const links = this.findGlossaryLinks(text, file.path);
    if (!links.length) { new Notice(t('notice.noGlossaryLinks')); return; }
    this.openUnlinkPreview([{ file, original: text, matches: links }], (results) => this.writeScopeResults(results));
  },

  unlinkSelection(editor) {
    const sel = editor.getSelection();
    if (!sel) { new Notice(t('notice.noSelection')); return; }
    const file = this.app.workspace.getActiveFile();
    const links = this.findGlossaryLinks(sel, file ? file.path : '');
    if (!links.length) { new Notice(t('notice.noGlossaryLinks')); return; }
    this.openUnlinkPreview([{ file: null, original: sel, matches: links, label: t('label.selection') }], (results) => {
      editor.replaceSelection(results[0].newText);
      new Notice(t('notice.linksRemoved', { links: plural('link', results[0].count) }));
    });
  },

  async unlinkScope() {
    const files = await this.scanScopeMatches((text, file) => this.findGlossaryLinks(text, file.path));
    if (!files.length) { new Notice(t('notice.noGlossaryLinks')); return; }
    this.openUnlinkPreview(files, (results) => this.writeScopeResults(results));
  },

  async createTermFromSelection(editor, replaceWithLink) {
    const sel = (editor.getSelection() || '').trim();
    if (!sel) { new Notice(t('notice.nothingSelected')); return; }

    // If the selection already matches a term, open that one instead of making a duplicate.
    if (this.settings.aliasCollisionWarnings) {
      const hits = this.termsMatchingText(sel);
      if (hits.length) {
        const sourcePath = this.app.workspace.getActiveFile()?.path || '';
        this.openTerm(hits[0], sourcePath, false);
        new Notice(t('notice.alreadyMatchesOpened', { sel, term: hits[0] }));
        return;
      }
    }
    return this.createTermNote(editor, sel, replaceWithLink);
  },

  async createTermNote(editor, sel, replaceWithLink) {
    const name = sel.replace(/[\\/:*?"<>|#^\[\]]/g, '').replace(/\s+/g, ' ').trim();
    if (!name) { new Notice(t('notice.invalidTermName')); return; }

    await this.ensureGlossaryFolder();
    const folder = this.settings.glossaryFolder.replace(/\/+$/, '');
    const path = folder ? `${folder}/${name}.md` : `${name}.md`;
    let file = this.app.vault.getAbstractFileByPath(path);
    if (file) {
      new Notice(t('notice.termExists', { name }));
    } else {
      try {
        const content = await this.buildTermContent(name, sel);
        file = await this.app.vault.create(path, content);
      }
      catch (e) { new Notice(t('notice.couldNotCreate')); return; }
    }

    if (replaceWithLink) editor.replaceSelection(this.wikiLink(name, sel));
    this.rebuildIndex();
    this.updateStatusBar();
    await this.app.workspace.getLeaf('tab').openFile(file);
  },

  async buildTermContent(name, sel) {
    const tplPath = (this.settings.termTemplate || '').trim();
    if (!tplPath) return '';
    const tpl = this.app.vault.getAbstractFileByPath(tplPath);
    if (!(tpl instanceof TFile)) {
      new Notice(t('notice.templateNotFound', { path: tplPath }));
      return '';
    }
    let text;
    try { text = await this.app.vault.read(tpl); }
    catch (e) { new Notice(t('notice.couldNotReadTemplate')); return ''; }
    return this.applyTermPlaceholders(text, name, sel);
  },

  applyTermPlaceholders(text, name, sel) {
    const src = this.app.workspace.getActiveFile();
    const m = (() => { try { return moment ? moment() : null; } catch (e) { return null; } })();
    const fmt = (f, fallback) => (m ? m.format(f) : fallback());
    return text
      .replace(/\{\{\s*title\s*\}\}/g, name)
      .replace(/\{\{\s*selection\s*\}\}/g, sel)
      .replace(/\{\{\s*source\s*\}\}/g, src ? src.basename : '')
      .replace(/\{\{\s*sourcePath\s*\}\}/g, src ? src.path : '')
      .replace(/\{\{\s*date(?::([^}]*))?\s*\}\}/g, (_, f) => fmt((f || 'YYYY-MM-DD').trim(), () => new Date().toISOString().slice(0, 10)))
      .replace(/\{\{\s*time(?::([^}]*))?\s*\}\}/g, (_, f) => fmt((f || 'HH:mm').trim(), () => new Date().toTimeString().slice(0, 5)));
  },

  // The highlighted (not yet linked) match under the cursor, with whatever the other
  // linkers would offer at the same spot, or null.
  //
  // It runs through ownSpans, so on a word several linkers know only the owner finds
  // anything here — which is what keeps one "Link…" item in the menu instead of one per
  // plugin. The others stay quiet and their readings ride along as candidates.
  matchAtCursor(editor) {
    const head = editor.getCursor('head');
    const line = editor.getLine(head.line);
    if (!line) return null;
    const matches = this.ownSpans(line, this.findMatches(line, this.activeCanonical(), { protect: true }));
    const hit = matches.find((m) => head.ch >= m.start && head.ch <= m.end);
    if (!hit) return null;
    const foreign = candidatesFor(this.yieldedIn(line), hit.start, hit.end);
    return { match: hit, foreign, line: head.line };
  },

  // The match under the cursor as we see it, ownership aside — so null only when this word
  // means nothing to us at all.
  //
  // Used for excluding a word, and only for that. Excluding is a setting of *this* plugin:
  // it stops us matching the word and says nothing about what the sibling does. Gating it on
  // ownership hid it exactly where it is most wanted — on a word both linkers match, where
  // the loser is drawing nothing yet still matches, and the settings tab was the only way
  // left to tell it to stop.
  wordAtCursor(editor) {
    const head = editor.getCursor('head');
    const line = editor.getLine(head.line);
    if (!line) return null;
    const matches = this.findMatches(line, this.activeCanonical(), { protect: true });
    return matches.find((m) => head.ch >= m.start && head.ch <= m.end) || null;
  },

  // The plain word under the cursor, whether or not the index knows it.
  rawWordAtCursor(editor) {
    const head = editor.getCursor('head');
    return wordAt(editor.getLine(head.line), head.ch);
  },

  // Every reading of the match under the cursor: ours, our own same-named alternatives, and
  // the ones other linkers stood down on. What the menu offers to link or open.
  cursorCandidates(hit, sourcePath, newTab) {
    const own = [hit.match.canonical, ...(hit.match.alts || [])];
    const foreign = hit.foreign.map((c) => ({ ...c, open: () => c.open(sourcePath, newTab) }));
    return [...own, ...foreign];
  },

  chooseTerm(candidates, title, action) {
    const list = (candidates || []).filter(Boolean);
    // A lone candidate needs no dialog. It can still be another linker's, in which case it
    // opens itself rather than going through our own resolver.
    if (list.length <= 1) {
      const only = list[0];
      if (only && typeof only === 'object') return only.open();
      return action(only);
    }
    new ChooseTermModal(this.app, { title, terms: list, onChoose: action }).open();
  },

  isExcluded(listKey, value) {
    const v = value.toLowerCase();
    return splitLines(this.settings[listKey]).some((l) => l.toLowerCase() === v);
  },

  // Add or remove exclusion item, toggled by current state. Tagged with the verb, so the
  // builder collects it with whatever else offers to exclude the same word. excludeWords are
  // stored lowercased.
  addExclusionMenuItem(menu, listKey, value) {
    const words = listKey === 'excludeWords';
    const noun = words ? t('exclude.words') : t('exclude.terms');
    const excluded = this.isExcluded(listKey, value);
    const key = excluded ? 'exclude.remove' : 'exclude.add';
    menu.tagged('exclude', { value }, (i, grouped) => i
      // Inside the group the parent already names the word, so the title drops it.
      .setTitle(t(grouped ? key + 'Short' : key, { value, noun }))
      .setIcon(excluded ? 'rotate-ccw' : (words ? 'ban' : 'trash-2'))
      .onClick(() => (excluded
        ? this.removeFromExclusion(listKey, value)
        : this.addToExclusion(listKey, words ? value.toLowerCase() : value))));
  },

  async addToExclusion(listKey, value) {
    const lines = splitLines(this.settings[listKey]);
    if (lines.some((l) => l.toLowerCase() === value.toLowerCase())) {
      new Notice(t('notice.alreadyExcluded', { value }));
      return;
    }
    lines.push(value);
    this.settings[listKey] = lines.join('\n');
    await this.saveSettings();
    this.rebuildIndex();
    this.rerenderViews();
    this.updateStatusBar();
    const where = listKey === 'excludeWords' ? t('exclude.words') : t('exclude.terms');
    new Notice(t('notice.addedToExcluded', { value, where }));
  },

  async removeFromExclusion(listKey, value) {
    const v = value.toLowerCase();
    const lines = splitLines(this.settings[listKey]);
    const kept = lines.filter((l) => l.toLowerCase() !== v);
    if (kept.length === lines.length) { new Notice(t('notice.wasNotExcluded', { value })); return; }
    this.settings[listKey] = kept.join('\n');
    await this.saveSettings();
    this.rebuildIndex();
    this.rerenderViews();
    this.updateStatusBar();
    const where = listKey === 'excludeWords' ? t('exclude.words') : t('exclude.terms');
    new Notice(t('notice.removedFromExcluded', { value, where }));
  },

  // linkAs (optional) overrides which term the occurrence is linked to — used when
  // a word matches several terms and the user picks an alternative from the menu.
  async materializeSingle(file, canonical, display, nearOffset, occurrence, linkAs) {
    let created = false;
    await this.app.vault.process(file, (text) => {
      const matches = this.findMatches(text, this.canonicalForPath(file.path), { protect: true })
        .filter((m) => m.canonical === canonical && m.display === display);
      if (!matches.length) return text;
      let target = matches[0];
      if (occurrence != null && matches[occurrence]) {
        target = matches[occurrence];
      } else if (nearOffset != null) {
        target = matches.reduce((best, m) => (Math.abs(m.start - nearOffset) < Math.abs(best.start - nearOffset) ? m : best), matches[0]);
      }
      const chosen = (linkAs && linkAs !== target.canonical) ? { ...target, canonical: linkAs } : target;
      created = true;
      return this.applyLinks(text, [chosen]).newText;
    });
    if (!created) { new Notice(t('notice.occurrenceNotFound')); return; }
    new Notice(t('notice.linkCreatedSingle'));
    this.updateStatusBar();
  },

  // linkAs (optional) links the matched occurrences to a chosen alternative term
  // instead of the one findMatches picked (used to resolve an alias collision).
  async materializeTerm(file, canonical, linkAs) {
    let count = 0;
    await this.app.vault.process(file, (text) => {
      let matches = this.findMatches(text, this.canonicalForPath(file.path), { protect: true })
        .filter((m) => m.canonical === canonical);
      if (!matches.length) return text;
      if (this.settings.linkFirstOnly) matches = matches.slice(0, 1);
      if (linkAs && linkAs !== canonical) matches = matches.map((m) => ({ ...m, canonical: linkAs }));
      count = matches.length;
      return this.applyLinks(text, matches).newText;
    });
    if (!count) { new Notice(t('notice.noOccurrences')); return; }
    new Notice(t('notice.linksCreated', { links: plural('link', count) }));
    this.updateStatusBar();
  },

  async materializeTermScope(canonical, linkAs) {
    const term = linkAs || canonical;
    const files = await this.scanScopeMatches((text, file) => {
      let matches = this.findMatches(text, this.canonicalForPath(file.path), { protect: true })
        .filter((m) => m.canonical === canonical);
      if (this.settings.linkFirstOnly) matches = matches.slice(0, 1);
      // Term already chosen → no per-occurrence picker in the preview.
      return matches.map((m) => ({ ...m, canonical: term, alts: null }));
    });
    if (!files.length) { new Notice(t('notice.noOccurrences')); return; }
    this.openMaterializePreview(files, (results) => this.writeScopeResults(results));
  },

  termLiterals(file) {
    const out = new Set();
    for (const form of [file.basename, ...this.aliasesOf(file)]) {
      if (typeof form === 'string' && form.trim()) out.add(form.toLowerCase());
    }
    return out;
  },

  // Obsidian keeps inline markup in displayText; drop it so `code`/*em* doesn't reach an alias.
  // Returns '' (skip the link) when no letters survive.
  normalizeDisplay(display) {
    if (typeof display !== 'string') return '';
    const clean = display.replace(/[`*_~]/g, '').replace(/\s+/g, ' ').trim();
    return /\p{L}/u.test(clean) ? clean : '';
  },

  partialOfMultiwordTitle(file, cand) {
    const words = this.tokenizeForm(file.basename);
    if (words.length < 2) return false;
    const keys = this.keysFor(cand);
    return words.some((w) => w.keys.some((k) => keys.includes(k)));
  },

  harvestCandidates(display) {
    if (this.settings.harvestSingleWordOnly && this.tokenizeForm(display).length > 1) return [];
    const lower = display.toLowerCase();
    const out = [];
    const mode = this.settings.aliasHarvestMode;
    if (mode === 'literal' || mode === 'both') out.push(lower);
    if (mode === 'lemma' || mode === 'both') out.push(this.lemmaFor(display));
    const min = Math.max(1, this.settings.harvestMinLength || 1);
    return [...new Set(out)].filter((a) => a && a.length >= min);
  },

  // Fills `add` (cand → collidesWith) and `skip` from one link's display. Shared by both harvest paths.
  collectAliasesFromDisplay(file, display, literals, add, skip) {
    if (this.termsMatchingText(display).includes(file.basename)) return; // an existing form already matches
    for (const cand of this.harvestCandidates(display)) {
      if (add.has(cand)) continue;
      if (literals.has(cand)) { skip.add(cand); continue; }
      if (this.partialOfMultiwordTitle(file, cand)) { skip.add(cand); continue; }
      add.set(cand, this.settings.aliasCollisionWarnings ? this.termsMatchingText(cand, file.basename) : []);
    }
  },

  async harvestFiles(files, silent) {
    const perTerm = new Map();

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache || !cache.links) continue;
      for (const link of cache.links) {
        const display = this.normalizeDisplay(link.displayText);
        if (!display) continue;
        const targetFile = this.app.metadataCache.getFirstLinkpathDest(link.link, file.path);
        if (!targetFile || !this.isGlossaryFile(targetFile)) continue;
        if (display.toLowerCase() === targetFile.basename.toLowerCase()) continue;

        let entry = perTerm.get(targetFile.path);
        if (!entry) { entry = { file: targetFile, add: new Map(), skip: new Set(), literals: this.termLiterals(targetFile) }; perTerm.set(targetFile.path, entry); }
        this.collectAliasesFromDisplay(targetFile, display, entry.literals, entry.add, entry.skip);
      }
    }

    const additions = [];
    for (const entry of perTerm.values()) {
      let chosen = [...entry.add.entries()];
      // No preview to vet a collision in a silent run — drop it.
      if (silent) chosen = chosen.filter(([, collidesWith]) => !collidesWith.length);
      if (!chosen.length) continue;
      const aliases = chosen.map(([text, collidesWith]) => ({ text, collidesWith }));
      additions.push({ file: entry.file, aliases, skipped: [...entry.skip] });
    }
    if (!additions.length) { if (!silent) new Notice(t('notice.noNewAliases')); return; }

    if (silent) { await this.applyHarvest(additions); return; }
    new HarvestPreviewModal(this.app, additions, (selected) => this.applyHarvest(selected)).open();
  },

  async applyHarvest(selected) {
    await this.ensureGlossaryFolder();
    let total = 0;
    for (const a of selected) {
      await this.app.fileManager.processFrontMatter(a.file, (fm) => {
        let list = fm.aliases;
        if (!Array.isArray(list)) list = (typeof list === 'string' && list.trim()) ? [list] : [];
        const existing = new Set(list.map((x) => String(x).toLowerCase()));
        for (const al of a.aliases) {
          const text = typeof al === 'string' ? al : al.text;
          if (!existing.has(text.toLowerCase())) { list.push(text); existing.add(text.toLowerCase()); total++; }
        }
        fm.aliases = list;
      });
    }
    this.rebuildIndex();
    this.updateStatusBar();
    new Notice(t('notice.aliasesAdded', { aliases: plural('alias', total) }));
  },

  // Collect just one link's wording as an alias for its term — the per-link version of
  // harvestFiles, reusing the same candidate rules, collision check and preview/apply.
  async harvestOneLink(targetFile, rawDisplay) {
    const display = this.normalizeDisplay(rawDisplay);
    if (!targetFile || !this.isGlossaryFile(targetFile) || !display) return;
    if (display.toLowerCase() === targetFile.basename.toLowerCase()) {
      new Notice(t('notice.wordingMatchesTerm')); return;
    }
    const add = new Map();
    const skip = new Set();
    this.collectAliasesFromDisplay(targetFile, display, this.termLiterals(targetFile), add, skip);
    if (!add.size) { new Notice(t('notice.noNewAlias')); return; }
    const aliases = [...add.entries()].map(([text, collidesWith]) => ({ text, collidesWith }));
    const additions = [{ file: targetFile, aliases, skipped: [...skip] }];
    new HarvestPreviewModal(this.app, additions, (selected) => this.applyHarvest(selected)).open();
  },

  // Shared write: attach `alias` as a plain alias on `term` (from this.terms).
  // For forms the stemmer can't derive from the title (abbreviations, synonyms,
  // alternate spellings), which must be listed explicitly to be matched.
  async writeAlias(term, alias) {
    const file = this.app.vault.getAbstractFileByPath(term.path);
    if (!(file instanceof TFile)) { new Notice(t('notice.termFileMissing', { term: term.canonical })); return; }

    const already = (this.aliasesOf(file) || []).some((a) => a.toLowerCase() === alias.toLowerCase());
    if (already || alias.toLowerCase() === term.canonical.toLowerCase()) {
      new Notice(t('notice.aliasExists', { alias, term: term.canonical }));
      return;
    }

    const collidesWith = [...this.termsMatchingText(alias)].filter((c) => c !== term.canonical);

    await this.app.fileManager.processFrontMatter(file, (fm) => {
      let list = fm.aliases;
      if (!Array.isArray(list)) list = (typeof list === 'string' && list.trim()) ? [list] : [];
      list.push(alias);
      fm.aliases = list;
    });
    this.rebuildIndex();
    this.updateStatusBar();

    if (collidesWith.length) {
      new Notice(t('notice.aliasAddedCollision', { alias, term: term.canonical, others: collidesWith.join(', ') }));
    } else {
      new Notice(t('notice.aliasAdded', { alias, term: term.canonical }));
    }
  },

  // Command Palette flow: pick a term, then type the alias.
  addAlias() {
    if (!this.terms || !this.terms.length) { new Notice(t('notice.noTerms')); return; }
    new TermPickerModal(this.app, this.terms, (term) => {
      new AliasTextModal(this.app, term.canonical, (alias) => this.writeAlias(term, alias)).open();
    }).open();
  },

  // Editor context-menu flow: the selection already IS the alias, so only
  // the term still needs picking.
  addAliasFromSelection(alias) {
    if (!this.terms || !this.terms.length) { new Notice(t('notice.noTerms')); return; }
    new TermPickerModal(this.app, this.terms, (term) => this.writeAlias(term, alias)).open();
  },
};
