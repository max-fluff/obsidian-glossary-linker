'use strict';

const { Menu, Notice } = require('obsidian');
const { MaterializePreviewModal, HarvestPreviewModal } = require('./modals');

// Mixin: turning terms into links + collecting aliases.
// Methods run with the plugin as `this`.
module.exports = {
  buildMaterialization(text, currentCanonical) {
    const matches = this.findMatches(text, currentCanonical, { protect: true });
    const seen = new Set();
    const chosen = [];
    for (const m of matches) {
      if (this.settings.linkFirstOnly && seen.has(m.canonical)) continue;
      seen.add(m.canonical);
      chosen.push(m);
    }
    return this.applyLinks(text, chosen);
  },

  async materializeCurrent() {
    const file = this.app.workspace.getActiveFile();
    if (!file) { new Notice('No active note'); return; }
    const text = await this.app.vault.read(file);
    const { newText, changes } = this.buildMaterialization(text, this.canonicalForPath(file.path));
    if (!changes.length) { new Notice('Glossary Linker: no matches found'); return; }
    new MaterializePreviewModal(this.app, [{ file, newText, changes }], async (files) => {
      for (const f of files) await this.app.vault.modify(f.file, f.newText);
      new Notice(`Glossary Linker: ${changes.length} link(s) created`);
    }).open();
  },

  materializeSelection(editor) {
    const sel = editor.getSelection();
    if (!sel) { new Notice('No selection'); return; }
    const file = this.app.workspace.getActiveFile();
    const { newText, changes } = this.buildMaterialization(sel, file ? this.canonicalForPath(file.path) : null);
    if (!changes.length) { new Notice('Glossary Linker: no matches found'); return; }
    new MaterializePreviewModal(this.app, [{ file: null, newText, changes, label: 'selection' }], () => {
      editor.replaceSelection(newText);
      new Notice(`Glossary Linker: ${changes.length} link(s) created`);
    }).open();
  },

  async materializeScope() {
    const files = this.getScopeFiles();
    const fileChanges = [];
    for (const file of files) {
      const text = await this.app.vault.read(file);
      const { newText, changes } = this.buildMaterialization(text, this.canonicalForPath(file.path));
      if (changes.length) fileChanges.push({ file, newText, changes });
    }
    if (!fileChanges.length) { new Notice('Glossary Linker: no matches found'); return; }
    new MaterializePreviewModal(this.app, fileChanges, async (selected) => {
      let total = 0;
      for (const f of selected) { await this.app.vault.modify(f.file, f.newText); total += f.changes.length; }
      new Notice(`Glossary Linker: ${selected.length} file(s), ${total} link(s)`);
    }).open();
  },

  showLinkMenu(evt, canonical, display, file, nearOffset) {
    const menu = new Menu();
    if (file) {
      menu.addItem((i) => i.setTitle('Turn into link').setIcon('link')
        .onClick(() => this.materializeSingle(file, canonical, display, nearOffset)));
      menu.addItem((i) => i.setTitle(`Turn all "${canonical}" into links`).setIcon('links-coming-in')
        .onClick(() => this.materializeTerm(file, canonical)));
      menu.addSeparator();
    }
    const sourcePath = file ? file.path : '';
    menu.addItem((i) => i.setTitle('Open glossary note').setIcon('file-text')
      .onClick(() => this.openTerm(canonical, sourcePath, false)));
    menu.addItem((i) => i.setTitle('Open in new tab').setIcon('file-plus')
      .onClick(() => this.openTerm(canonical, sourcePath, true)));
    menu.showAtMouseEvent(evt);
  },

  async materializeSingle(file, canonical, display, nearOffset) {
    const text = await this.app.vault.read(file);
    const matches = this.findMatches(text, this.canonicalForPath(file.path), { protect: true })
      .filter((m) => m.canonical === canonical && m.display === display);
    if (!matches.length) { new Notice('Glossary Linker: occurrence not found'); return; }
    let target = matches[0];
    if (nearOffset != null) {
      target = matches.reduce((best, m) => (Math.abs(m.start - nearOffset) < Math.abs(best.start - nearOffset) ? m : best), matches[0]);
    }
    const { newText } = this.applyLinks(text, [target]);
    await this.app.vault.modify(file, newText);
    new Notice('Glossary Linker: link created');
  },

  async materializeTerm(file, canonical) {
    const text = await this.app.vault.read(file);
    const matches = this.findMatches(text, this.canonicalForPath(file.path), { protect: true })
      .filter((m) => m.canonical === canonical);
    if (!matches.length) { new Notice('Glossary Linker: no occurrences found'); return; }
    const { newText } = this.applyLinks(text, matches);
    await this.app.vault.modify(file, newText);
    new Notice(`Glossary Linker: ${matches.length} link(s) created`);
  },

  // Keys and literals of every existing form of a term (to skip what highlighting already matches).
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
        if (!entry) { entry = { file: targetFile, add: new Map(), info: this.termFormKeys(targetFile) }; perTerm.set(targetFile.path, entry); }

        for (const cand of this.harvestCandidates(display)) {
          if (entry.info.literals.has(cand)) continue;        // already the title or an alias
          if (entry.add.has(cand)) continue;                  // already queued
          if (this.keysFor(cand).some((k) => entry.info.keys.has(k))) continue; // already matched
          entry.add.set(cand, { source: display });
        }
      }
    }

    const additions = [];
    for (const entry of perTerm.values()) {
      if (entry.add.size) additions.push({ file: entry.file, aliases: [...entry.add.keys()] });
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
            if (!existing.has(al.toLowerCase())) { list.push(al); existing.add(al.toLowerCase()); total++; }
          }
          fm.aliases = list;
        });
      }
      this.rebuildIndex();
      new Notice(`Glossary Linker: ${total} alias(es) added`);
    };

    if (silent) { await apply(additions); return; }
    new HarvestPreviewModal(this.app, additions, apply).open();
  },
};
