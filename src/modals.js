'use strict';

const { Modal, FuzzySuggestModal } = require('obsidian');
const { t } = require('./shared/i18n');
const { createProseModals } = require('./shared/prose/modals');

// The preview and picker dialogs shared with the heading linker; a glossary match names its
// target in `canonical` (the term title).
const { MaterializePreviewModal, UnlinkPreviewModal, ChooseTermModal } = createProseModals({
  cls: 'glossary',
  targetOf: (m) => m.canonical,
  withTarget: (m, canonical) => ({ ...m, canonical }),
});

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

// Fuzzy-pick a glossary term to attach an alias to. items: this.plugin.terms.
class TermPickerModal extends FuzzySuggestModal {
  constructor(app, terms, onChoose) {
    super(app);
    this.terms = terms;
    this.onChoose = onChoose;
    this.setPlaceholder(t('modal.alias.pickTerm'));
  }

  getItems() { return this.terms; }
  getItemText(item) { return item.canonical; }
  onChooseItem(item) { this.onChoose(item); }
}

// Free-text entry for the alias itself (e.g. "ЦНС" for "Центральная нервная система").
class AliasTextModal extends Modal {
  constructor(app, termName, onSubmit) {
    super(app);
    this.termName = termName;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: t('modal.alias.title', { term: this.termName }) });
    contentEl.createEl('p', { cls: 'glossary-section-desc', text: t('modal.alias.body') });
    const input = contentEl.createEl('input', { type: 'text', cls: 'glossary-alias-input' });
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
  TermPickerModal, AliasTextModal,
};
