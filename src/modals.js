'use strict';

const { Modal, FuzzySuggestModal } = require('obsidian');
const { t } = require('./i18n');
const { inTableCell } = require('./constants');

// files: [{ file, original, matches: [{ start, end, display, canonical, alts }], label? }].
// Ambiguous matches (alts present) are resolved once per surface word in a top panel
// (the choice applies to every occurrence everywhere); "skip" leaves them as text.
// plugin supplies applyLinks / wikiLink. onApply receives
// [{ file, label, original, newText, count }].
const SKIP = ' skip';

class MaterializePreviewModal extends Modal {
  constructor(app, files, plugin, onApply) {
    super(app);
    this.files = files;
    this.plugin = plugin;
    this.onApply = onApply;
    // One resolution group per ambiguous surface word (case-insensitive).
    this.groups = new Map();
    for (const fc of files) {
      for (const m of fc.matches) {
        if (!(m.alts && m.alts.length)) continue;
        const key = m.display.toLowerCase();
        if (!this.groups.has(key)) this.groups.set(key, { display: m.display, candidates: [m.canonical, ...m.alts], choice: m.canonical, spans: [] });
      }
    }
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: t('modal.materialize.title') });
    const total = this.files.reduce((n, f) => n + f.matches.length, 0);
    contentEl.createEl('p', { text: t('modal.materialize.summary', { files: this.files.length, replacements: total }) });

    // Resolve-ambiguity panel: one selector per word, applied to all its occurrences.
    if (this.groups.size) {
      contentEl.createEl('p', { cls: 'glossary-section-desc', text: t('modal.materialize.ambiguous', { n: this.groups.size }) });
      const panel = contentEl.createDiv({ cls: 'glossary-resolve-panel' });
      for (const g of this.groups.values()) {
        const row = panel.createDiv({ cls: 'glossary-resolve-row' });
        row.createSpan({ cls: 'glossary-resolve-word', text: g.display });
        row.createSpan({ text: '→' });
        const sel = row.createEl('select', { cls: 'glossary-term-select' });
        for (const term of g.candidates) sel.createEl('option', { text: term, value: term });
        sel.createEl('option', { text: t('modal.skipOption'), value: SKIP });
        sel.value = g.choice;
        sel.onchange = () => { g.choice = sel.value === SKIP ? null : sel.value; g.spans.forEach((upd) => upd()); };
      }
    }

    this.files.forEach((fc) => {
      contentEl.createDiv({ cls: 'glossary-preview-file', text: fc.file ? fc.file.path : (fc.label || t('label.selection')) });
      const table = contentEl.createEl('table', { cls: 'glossary-preview-table' });
      fc.matches.slice(0, 50).forEach((m) => {
        const inTable = inTableCell(fc.original, m.start);
        const tr = table.createEl('tr');
        tr.createEl('td', { text: m.display });
        tr.createEl('td', { text: '→' });
        const after = tr.createEl('td');
        if (m.alts && m.alts.length) {
          tr.addClass('glossary-ambiguous-row');
          const g = this.groups.get(m.display.toLowerCase());
          const render = () => after.setText(g.choice == null ? t('modal.leftAsText') : this.plugin.wikiLink(g.choice, m.display, inTable));
          g.spans.push(render);
          render();
        } else {
          after.setText(this.plugin.wikiLink(m.canonical, m.display, inTable));
        }
      });
      if (fc.matches.length > 50) contentEl.createEl('div', { cls: 'glossary-preview-empty', text: t('modal.andMore', { n: fc.matches.length - 50 }) });
    });

    const buttons = contentEl.createDiv({ cls: 'glossary-preview-buttons' });
    const apply = buttons.createEl('button', { text: t('btn.apply'), cls: 'mod-cta' });
    apply.onclick = async () => {
      const results = this.files.map((fc) => {
        const chosen = [];
        for (const m of fc.matches) {
          if (m.alts && m.alts.length) {
            const g = this.groups.get(m.display.toLowerCase());
            if (!g || g.choice == null) continue; // skipped — leave as plain text
            chosen.push(g.choice === m.canonical ? m : { ...m, canonical: g.choice });
          } else {
            chosen.push(m);
          }
        }
        const { newText } = this.plugin.applyLinks(fc.original, chosen);
        return { file: fc.file, label: fc.label, original: fc.original, newText, count: chosen.length };
      });
      await this.onApply(results);
      this.close();
    };
    buttons.createEl('button', { text: t('btn.cancel') }).onclick = () => this.close();
  }

  onClose() { this.contentEl.empty(); }
}

// additions: [{ file, aliases: [{ text, collidesWith: [..] }], skipped: [str] }].
// Each alias has a checkbox (on by default); aliases that would collide with
// another term are flagged. onApply receives the checked aliases per term.
class HarvestPreviewModal extends Modal {
  constructor(app, additions, onApply) {
    super(app);
    this.additions = additions;
    this.onApply = onApply;
    this.checked = new Set();
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: t('modal.harvest.title') });
    const total = this.additions.reduce((n, a) => n + a.aliases.length, 0);
    contentEl.createEl('p', { text: t('modal.harvest.summary', { terms: this.additions.length, aliases: total }) });

    for (const a of this.additions) {
      contentEl.createDiv({ cls: 'glossary-preview-file', text: a.file.basename });
      const list = contentEl.createDiv({ cls: 'glossary-harvest-list' });
      for (const al of a.aliases) {
        const collides = al.collidesWith && al.collidesWith.length; // start a colliding alias unchecked
        if (!collides) this.checked.add(al);
        const row = list.createDiv({ cls: 'glossary-harvest-alias' });
        const label = row.createEl('label');
        const cb = label.createEl('input', { type: 'checkbox' });
        cb.checked = !collides;
        cb.onchange = () => { if (cb.checked) this.checked.add(al); else this.checked.delete(al); };
        label.createSpan({ cls: 'glossary-add', text: al.text });
        if (collides) {
          const warn = row.createSpan({ cls: 'glossary-collision', text: '⚠' });
          warn.setAttribute('aria-label', t('modal.harvest.alsoMatches', { terms: al.collidesWith.join(', ') }));
        }
      }
      if (a.skipped && a.skipped.length) {
        contentEl.createDiv({ cls: 'glossary-section-desc', text: t('modal.harvest.alreadyPresent', { items: a.skipped.join(', ') }) });
      }
    }

    const buttons = contentEl.createDiv({ cls: 'glossary-preview-buttons' });
    const apply = buttons.createEl('button', { text: t('btn.write'), cls: 'mod-cta' });
    apply.onclick = async () => {
      const selected = this.additions
        .map((a) => ({ file: a.file, aliases: a.aliases.filter((al) => this.checked.has(al)) }))
        .filter((a) => a.aliases.length);
      await this.onApply(selected);
      this.close();
    };
    buttons.createEl('button', { text: t('btn.cancel') }).onclick = () => this.close();
  }

  onClose() { this.contentEl.empty(); }
}

// files: [{ file, original, matches: [{ start, end, display, canonical, source }], label? }].
// Inverse of the materialize preview: each row shows the link source → its plain display.
// plugin supplies unlinkLinks. onApply receives [{ file, label, original, newText, count }].
class UnlinkPreviewModal extends Modal {
  constructor(app, files, plugin, onApply) {
    super(app);
    this.files = files;
    this.plugin = plugin;
    this.onApply = onApply;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: t('modal.unlink.title') });
    const total = this.files.reduce((n, f) => n + f.matches.length, 0);
    contentEl.createEl('p', { text: t('modal.unlink.summary', { files: this.files.length, links: total }) });

    this.files.forEach((fc) => {
      contentEl.createDiv({ cls: 'glossary-preview-file', text: fc.file ? fc.file.path : (fc.label || t('label.selection')) });
      const table = contentEl.createEl('table', { cls: 'glossary-preview-table' });
      fc.matches.slice(0, 50).forEach((m) => {
        const tr = table.createEl('tr');
        tr.createEl('td', { text: m.source });
        tr.createEl('td', { text: '→' });
        tr.createEl('td', { text: m.display });
      });
      if (fc.matches.length > 50) contentEl.createEl('div', { cls: 'glossary-preview-empty', text: t('modal.andMore', { n: fc.matches.length - 50 }) });
    });

    const buttons = contentEl.createDiv({ cls: 'glossary-preview-buttons' });
    const apply = buttons.createEl('button', { text: t('btn.apply'), cls: 'mod-cta' });
    apply.onclick = async () => {
      const results = this.files.map((fc) => {
        const { newText, count } = this.plugin.unlinkLinks(fc.original, fc.matches);
        return { file: fc.file, label: fc.label, original: fc.original, newText, count };
      });
      await this.onApply(results);
      this.close();
    };
    buttons.createEl('button', { text: t('btn.cancel') }).onclick = () => this.close();
  }

  onClose() { this.contentEl.empty(); }
}

// Pick one term from several (alias collision). opts: { title, terms: [str], onChoose }.
class ChooseTermModal extends Modal {
  constructor(app, opts) {
    super(app);
    this.opts = opts;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: this.opts.title || t('modal.choose.title') });
    contentEl.createEl('p', { text: t('modal.choose.body') });
    const list = contentEl.createDiv({ cls: 'glossary-choose-list' });
    for (const term of this.opts.terms) {
      const b = list.createEl('button', { text: term, cls: 'glossary-choose-item' });
      b.onclick = async () => { await this.opts.onChoose(term); this.close(); };
    }
    contentEl.createDiv({ cls: 'glossary-preview-buttons' })
      .createEl('button', { text: t('btn.cancel') }).onclick = () => this.close();
  }

  onClose() { this.contentEl.empty(); }
}

// Fuzzy-pick a glossary term to attach an abbreviation to. items: this.plugin.terms.
class TermPickerModal extends FuzzySuggestModal {
  constructor(app, terms, onChoose) {
    super(app);
    this.terms = terms;
    this.onChoose = onChoose;
    this.setPlaceholder(t('modal.abbrev.pickTerm'));
  }

  getItems() { return this.terms; }
  getItemText(item) { return item.canonical; }
  onChooseItem(item) { this.onChoose(item); }
}

// Free-text entry for the abbreviation itself (e.g. "ЦНС" for "Центральная нервная система").
class AbbreviationTextModal extends Modal {
  constructor(app, termName, onSubmit) {
    super(app);
    this.termName = termName;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: t('modal.abbrev.title', { term: this.termName }) });
    contentEl.createEl('p', { cls: 'glossary-section-desc', text: t('modal.abbrev.body') });
    const input = contentEl.createEl('input', { type: 'text', cls: 'glossary-abbrev-input' });
    input.style.width = '100%';
    const submit = () => {
      const v = input.value.trim();
      if (v) { this.onSubmit(v); this.close(); }
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    const buttons = contentEl.createDiv({ cls: 'glossary-preview-buttons' });
    buttons.createEl('button', { text: t('btn.write'), cls: 'mod-cta' }).onclick = submit;
    buttons.createEl('button', { text: t('btn.cancel') }).onclick = () => this.close();
    input.focus();
  }

  onClose() { this.contentEl.empty(); }
}

module.exports = {
  MaterializePreviewModal, HarvestPreviewModal, ChooseTermModal, UnlinkPreviewModal,
  TermPickerModal, AbbreviationTextModal,
};
