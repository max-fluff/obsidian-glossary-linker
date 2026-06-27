'use strict';

const { Menu, Notice } = require('obsidian');
const { MaterializePreviewModal, HarvestPreviewModal, ChooseTermModal } = require('./modals');

// Turning terms into links + collecting aliases. Mixed into the plugin prototype.
module.exports = {
  // The matches to link in a note: findMatches, then (optionally) first-per-term.
  // Ambiguous matches keep their `alts`, so the preview can let the user pick a term.
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
      if ((await this.app.vault.read(r.file)) !== r.original) { skipped++; continue; }
      await this.app.vault.modify(r.file, r.newText);
      total += r.count;
    }
    let msg = `Glossary Linker: ${results.length - skipped} file(s), ${total} link(s)`;
    if (skipped) msg += `, ${skipped} skipped (changed since preview)`;
    new Notice(msg);
    this.updateStatusBar();
  },

  async materializeCurrent() {
    const file = this.app.workspace.getActiveFile();
    if (!file) { new Notice('No active note'); return; }
    const text = await this.app.vault.cachedRead(file);
    const matches = this.collectMatches(text, this.canonicalForPath(file.path));
    if (!matches.length) { new Notice('Glossary Linker: no matches found'); return; }
    this.openMaterializePreview([{ file, original: text, matches }], async (results) => {
      const r = results[0];
      if ((await this.app.vault.read(r.file)) !== r.original) {
        new Notice('Glossary Linker: note changed since preview, nothing written');
        return;
      }
      await this.app.vault.modify(r.file, r.newText);
      new Notice(`Glossary Linker: ${r.count} link(s) created`);
      this.updateStatusBar();
    });
  },

  materializeSelection(editor) {
    const sel = editor.getSelection();
    if (!sel) { new Notice('No selection'); return; }
    const file = this.app.workspace.getActiveFile();
    const matches = this.collectMatches(sel, file ? this.canonicalForPath(file.path) : null);
    if (!matches.length) { new Notice('Glossary Linker: no matches found'); return; }
    this.openMaterializePreview([{ file: null, original: sel, matches, label: 'selection' }], (results) => {
      editor.replaceSelection(results[0].newText);
      new Notice(`Glossary Linker: ${results[0].count} link(s) created`);
    });
  },

  // Scan in-scope notes with compute(text, file) -> matches[], keeping only files
  // with matches, with a progress notice.
  async scanScopeMatches(compute) {
    const files = this.getScopeFiles();
    const out = [];
    const notice = new Notice('Glossary Linker: scanning…', 0);
    try {
      for (let i = 0; i < files.length; i++) {
        if (i % 25 === 0) notice.setMessage(`Glossary Linker: scanning ${i + 1}/${files.length}…`);
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
    if (!files.length) { new Notice('Glossary Linker: no matches found'); return; }
    this.openMaterializePreview(files, (results) => this.writeScopeResults(results));
  },

  async createTermFromSelection(editor, replaceWithLink) {
    const sel = (editor.getSelection() || '').trim();
    if (!sel) { new Notice('Glossary Linker: nothing selected'); return; }

    // If the selection already matches an existing term, don't make a duplicate —
    // just open the existing one (collision on creation is a rare corner case, and
    // the context almost always means the term you want already exists).
    if (this.settings.aliasCollisionWarnings) {
      const hits = this.termsMatchingText(sel);
      if (hits.length) {
        const sourcePath = this.app.workspace.getActiveFile()?.path || '';
        this.openTerm(hits[0], sourcePath, false);
        new Notice(`Glossary Linker: "${sel}" already matches "${hits[0]}" — opened it`);
        return;
      }
    }
    return this.createTermNote(editor, sel, replaceWithLink);
  },

  async createTermNote(editor, sel, replaceWithLink) {
    const name = sel.replace(/[\\/:*?"<>|#^\[\]]/g, '').replace(/\s+/g, ' ').trim();
    if (!name) { new Notice('Glossary Linker: selection is not a valid term name'); return; }

    await this.ensureGlossaryFolder();
    const folder = this.settings.glossaryFolder.replace(/\/+$/, '');
    const path = folder ? `${folder}/${name}.md` : `${name}.md`;
    let file = this.app.vault.getAbstractFileByPath(path);
    if (file) {
      new Notice(`Glossary Linker: term "${name}" already exists`);
    } else {
      try { file = await this.app.vault.create(path, ''); }
      catch (e) { new Notice('Glossary Linker: could not create term note'); return; }
    }

    if (replaceWithLink) editor.replaceSelection(this.wikiLink(name, sel));
    this.rebuildIndex();
    this.updateStatusBar();
    await this.app.workspace.getLeaf('tab').openFile(file);
  },

  // Run `action(term)`. With one candidate it runs straight away; with several
  // (an alias collision) it first asks which term via a modal.
  chooseTerm(candidates, title, action) {
    const list = (candidates || []).filter(Boolean);
    if (list.length <= 1) return action(list[0]);
    new ChooseTermModal(this.app, { title, terms: list, onChoose: action }).open();
  },

  showLinkMenu(evt, canonical, display, file, nearOffset, occurrence, alts) {
    const sourcePath = file ? file.path : '';
    // When a word matches several terms, ambiguous actions resolve via a picker.
    const candidates = (alts && alts.length) ? [canonical, ...alts] : [canonical];
    const groups = [];

    if (file && this.settings.menuTurnInto) {
      groups.push((menu) => {
        menu.addItem((i) => i.setTitle('Turn into link').setIcon('link')
          .onClick(() => this.chooseTerm(candidates, `Link "${display}" to…`,
            (c) => this.materializeSingle(file, canonical, display, nearOffset, occurrence, c))));
        menu.addItem((i) => i.setTitle(`Turn all "${display}" into links: this note`).setIcon('links-coming-in')
          .onClick(() => this.chooseTerm(candidates, `Link all "${display}" to…`,
            (c) => this.materializeTerm(file, canonical, c))));
        menu.addItem((i) => i.setTitle(`Turn all "${display}" into links: all notes`).setIcon('links-going-out')
          .onClick(() => this.chooseTerm(candidates, `Link all "${display}" to…`,
            (c) => this.materializeTermScope(canonical, c))));
      });
    }
    if (this.settings.menuExclude) {
      groups.push((menu) => {
        menu.addItem((i) => i.setTitle(`Add "${display}" to excluded words`).setIcon('ban')
          .onClick(() => this.addToExclusion('excludeWords', display.toLowerCase())));
        // Use the clicked word, not the resolved term: excluded terms matches titles
        // AND aliases, so excluding "container" drops every term that shares it —
        // no need to pick one of the colliding terms.
        menu.addItem((i) => i.setTitle(`Add "${display}" to excluded terms`).setIcon('trash-2')
          .onClick(() => this.addToExclusion('excludeTerms', display)));
      });
    }
    if (this.settings.menuOpen) {
      groups.push((menu) => {
        menu.addItem((i) => i.setTitle('Open glossary note').setIcon('file-text')
          .onClick(() => this.chooseTerm(candidates, 'Open…', (c) => this.openTerm(c, sourcePath, false))));
        menu.addItem((i) => i.setTitle('Open in new tab').setIcon('file-plus')
          .onClick(() => this.chooseTerm(candidates, 'Open in new tab…', (c) => this.openTerm(c, sourcePath, true))));
      });
    }

    if (!groups.length) return false;
    const menu = new Menu();
    groups.forEach((group, i) => { if (i) menu.addSeparator(); group(menu); });
    evt.preventDefault();
    menu.showAtMouseEvent(evt);
    return true;
  },

  // Append a value to a newline list setting (excludeWords / excludeTerms) and apply it.
  async addToExclusion(listKey, value) {
    const lines = (this.settings[listKey] || '').split('\n').map((s) => s.trim()).filter(Boolean);
    if (lines.some((l) => l.toLowerCase() === value.toLowerCase())) {
      new Notice(`Glossary Linker: "${value}" is already excluded`);
      return;
    }
    lines.push(value);
    this.settings[listKey] = lines.join('\n');
    await this.saveSettings();
    this.rebuildIndex();
    this.rerenderViews();
    this.updateStatusBar();
    const where = listKey === 'excludeWords' ? 'excluded words' : 'excluded terms';
    new Notice(`Glossary Linker: added "${value}" to ${where}`);
  },

  // linkAs (optional) overrides which term the occurrence is linked to — used when
  // a word matches several terms and the user picks an alternative from the menu.
  async materializeSingle(file, canonical, display, nearOffset, occurrence, linkAs) {
    const text = await this.app.vault.read(file);
    const matches = this.findMatches(text, this.canonicalForPath(file.path), { protect: true })
      .filter((m) => m.canonical === canonical && m.display === display);
    if (!matches.length) { new Notice('Glossary Linker: occurrence not found'); return; }
    let target = matches[0];
    if (occurrence != null && matches[occurrence]) {
      target = matches[occurrence];
    } else if (nearOffset != null) {
      target = matches.reduce((best, m) => (Math.abs(m.start - nearOffset) < Math.abs(best.start - nearOffset) ? m : best), matches[0]);
    }
    const chosen = (linkAs && linkAs !== target.canonical) ? { ...target, canonical: linkAs } : target;
    const { newText } = this.applyLinks(text, [chosen]);
    await this.app.vault.modify(file, newText);
    new Notice('Glossary Linker: link created');
    this.updateStatusBar();
  },

  // linkAs (optional) links the matched occurrences to a chosen alternative term
  // instead of the one findMatches picked (used to resolve an alias collision).
  async materializeTerm(file, canonical, linkAs) {
    const text = await this.app.vault.read(file);
    let matches = this.findMatches(text, this.canonicalForPath(file.path), { protect: true })
      .filter((m) => m.canonical === canonical);
    if (!matches.length) { new Notice('Glossary Linker: no occurrences found'); return; }
    if (linkAs && linkAs !== canonical) matches = matches.map((m) => ({ ...m, canonical: linkAs }));
    const { newText } = this.applyLinks(text, matches);
    await this.app.vault.modify(file, newText);
    new Notice(`Glossary Linker: ${matches.length} link(s) created`);
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
    if (!files.length) { new Notice('Glossary Linker: no occurrences found'); return; }
    this.openMaterializePreview(files, (results) => this.writeScopeResults(results));
  },

  // Keys and literals of a term's existing forms, so harvesting can skip what already matches.
  termFormKeys(file) {
    const forms = [file.basename, ...this.aliasesOf(file)].filter((x) => typeof x === 'string' && x.trim());
    const keys = new Set();
    const literals = new Set();
    for (const form of forms) {
      literals.add(form.toLowerCase());
      const words = this.tokenizeForm(form);
      if (words.length === 1) for (const k of words[0].keys) keys.add(k);
    }
    return { keys, literals };
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

  async harvestFiles(files, silent) {
    const perTerm = new Map();

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache || !cache.links) continue;
      for (const link of cache.links) {
        const display = link.displayText;
        if (!display) continue;
        const targetFile = this.app.metadataCache.getFirstLinkpathDest(link.link, file.path);
        if (!targetFile || !this.isGlossaryFile(targetFile)) continue;
        if (display.toLowerCase() === targetFile.basename.toLowerCase()) continue;

        let entry = perTerm.get(targetFile.path);
        if (!entry) { entry = { file: targetFile, add: new Map(), skip: new Set(), info: this.termFormKeys(targetFile) }; perTerm.set(targetFile.path, entry); }

        for (const cand of this.harvestCandidates(display)) {
          if (entry.info.literals.has(cand)) { entry.skip.add(cand); continue; }                 // already the title or an alias
          if (entry.add.has(cand)) continue;                                                     // already queued
          if (this.keysFor(cand).some((k) => entry.info.keys.has(k))) { entry.skip.add(cand); continue; } // already matched
          // Would adding this alias make the word point at more than one term?
          const collidesWith = this.settings.aliasCollisionWarnings ? this.termsMatchingText(cand, entry.file.basename) : [];
          entry.add.set(cand, { source: display, collidesWith });
        }
      }
    }

    const additions = [];
    for (const entry of perTerm.values()) {
      if (!entry.add.size) continue;
      const aliases = [...entry.add.entries()].map(([text, meta]) => ({ text, collidesWith: meta.collidesWith }));
      additions.push({ file: entry.file, aliases, skipped: [...entry.skip] });
    }
    if (!additions.length) { if (!silent) new Notice('Glossary Linker: no new aliases found'); return; }

    const apply = async (selected) => {
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
      new Notice(`Glossary Linker: ${total} alias(es) added`);
    };

    if (silent) { await apply(additions); return; }
    new HarvestPreviewModal(this.app, additions, apply).open();
  },
};
