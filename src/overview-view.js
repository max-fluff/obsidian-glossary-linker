'use strict';

const { ItemView } = require('obsidian');
const { t, plural } = require('./i18n');

const OVERVIEW_VIEW_TYPE = 'glossary-overview';

// Right-sidebar panel: indexed terms (with usage / orphans) and candidate words
// worth defining. Both lists come from heavy scans, so they refresh on demand.
class GlossaryOverviewView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.terms = [];
    this.candidates = [];
  }

  getViewType() { return OVERVIEW_VIEW_TYPE; }
  getDisplayText() { return t('view.title'); }
  getIcon() { return 'book-a'; }

  async onOpen() {
    this.contentEl.addClass('glossary-overview');
    this.renderShell();
    this.unsubscribe = this.plugin.onIndexChange(() => this.refreshTerms());
    await this.refresh();
  }

  async onClose() {
    if (this.unsubscribe) this.unsubscribe();
  }

  renderShell() {
    const root = this.contentEl;
    root.empty();
    const bar = root.createDiv({ cls: 'glossary-overview-bar' });
    bar.createEl('button', { text: t('overview.rescan'), cls: 'mod-cta' }).onclick = () => this.refresh();

    const scope = bar.createEl('label', { cls: 'glossary-overview-check' });
    const sc = scope.createEl('input', { type: 'checkbox' });
    sc.checked = this.plugin.settings.overviewWholeVault;
    scope.createSpan({ text: t('overview.wholeVault') });
    scope.setAttribute('aria-label', t('overview.wholeVaultAria'));
    sc.onchange = async () => {
      this.plugin.settings.overviewWholeVault = sc.checked;
      await this.plugin.saveSettings();
      await this.refresh();
    };

    this.termsSection = root.createDiv();
    this.candidatesSection = root.createDiv();
  }

  foldHeader(el, label, count, collapsed, onToggle) {
    const head = el.createDiv({ cls: 'glossary-overview-head is-toggle' });
    head.createSpan({ cls: 'glossary-overview-caret', text: collapsed ? '▸' : '▾' });
    head.createSpan({ text: collapsed ? label : `${label} (${count})` });
    head.onclick = onToggle;
  }

  sortControl(controls, options, value, onChange) {
    controls.createSpan({ text: t('overview.sort') });
    const sel = controls.createEl('select');
    for (const [text, val] of options) sel.createEl('option', { text, value: val });
    sel.value = value;
    sel.onchange = () => onChange(sel.value);
  }

  async refresh() {
    await this.loadUsage();
    this.renderTerms();
    await this.refreshCandidates();
  }

  async loadUsage() {
    this.terms = await this.plugin.getUsageReport({
      includeLinks: this.plugin.settings.overviewCountLinks,
      wholeVault: this.plugin.settings.overviewWholeVault,
    });
  }

  // Index changes (new/renamed/excluded terms) only change membership, not counts —
  // carry counts over and let an explicit Rescan recompute them.
  refreshTerms() {
    const prev = new Map(this.terms.map((t) => [t.canonical, t.count]));
    this.terms = this.plugin.getTerms().map((t) => ({ canonical: t.canonical, path: t.path, count: prev.get(t.canonical) || 0 }));
    this.renderTerms();
  }

  async refreshCandidates() {
    if (!this.plugin.settings.overviewCandidatesCollapsed) {
      this.candidates = await this.plugin.collectCandidates({ wholeVault: this.plugin.settings.overviewWholeVault });
    }
    this.renderCandidates();
  }

  renderTerms() {
    const el = this.termsSection;
    el.empty();
    const collapsed = this.plugin.settings.overviewTermsCollapsed;
    this.foldHeader(el, t('overview.terms'), this.terms.length, collapsed, () => this.toggleTerms());
    if (collapsed) return;

    const controls = el.createDiv({ cls: 'glossary-overview-controls' });
    this.sortControl(controls, [[t('overview.sortMostUsed'), 'usage'], [t('overview.sortName'), 'name']], this.plugin.settings.overviewSort, async (v) => {
      this.plugin.settings.overviewSort = v;
      await this.plugin.saveSettings();
      this.renderTerms();
    });

    const check = controls.createEl('label', { cls: 'glossary-overview-check' });
    const cb = check.createEl('input', { type: 'checkbox' });
    cb.checked = this.plugin.settings.overviewCountLinks;
    check.createSpan({ text: t('overview.countLinks') });
    check.setAttribute('aria-label', t('overview.countLinksAria'));
    cb.onchange = async () => {
      this.plugin.settings.overviewCountLinks = cb.checked;
      await this.plugin.saveSettings();
      await this.loadUsage();
      this.renderTerms();
    };

    const list = el.createDiv({ cls: 'glossary-overview-list' });
    if (!this.terms.length) { list.createDiv({ cls: 'glossary-overview-empty', text: t('overview.noTerms') }); return; }
    const byName = this.plugin.settings.overviewSort === 'name';
    const sorted = this.terms.slice().sort((a, b) =>
      byName ? a.canonical.localeCompare(b.canonical) : (b.count - a.count || a.canonical.localeCompare(b.canonical)));
    for (const term of sorted) {
      const row = list.createDiv({ cls: 'glossary-overview-row' });
      if (term.count === 0) row.addClass('is-orphan');
      const name = row.createSpan({ cls: 'glossary-overview-name is-link', text: term.canonical });
      name.setAttribute('aria-label', t('overview.openAria'));
      name.addEventListener('click', () => this.plugin.openTerm(term.canonical, '', false));
      name.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); }); // suppress autoscroll
      name.addEventListener('auxclick', (e) => { if (e.button === 1) { e.preventDefault(); this.plugin.openTerm(term.canonical, '', true); } });
      row.createSpan({ cls: 'glossary-overview-count', text: term.count === 0 ? t('overview.unused') : plural('use', term.count) });
      const actions = row.createSpan({ cls: 'glossary-overview-actions' });
      const link = actions.createEl('a', { cls: 'glossary-overview-act', text: t('overview.linkAll') });
      link.onclick = () => this.plugin.materializeTermScope(term.canonical);
    }
  }

  renderCandidates() {
    const el = this.candidatesSection;
    el.empty();
    const collapsed = this.plugin.settings.overviewCandidatesCollapsed;
    this.foldHeader(el, t('overview.candidates'), this.candidates.length, collapsed, () => this.toggleCandidates());
    if (collapsed) return;

    const controls = el.createDiv({ cls: 'glossary-overview-controls' });
    this.sortControl(controls, [[t('overview.sortNotes'), 'notes'], [t('overview.sortMentions'), 'count']], this.plugin.settings.overviewCandidateSort, async (v) => {
      this.plugin.settings.overviewCandidateSort = v;
      await this.plugin.saveSettings();
      this.renderCandidates();
    });

    controls.createSpan({ text: t('overview.minNotes') });
    const input = controls.createEl('input', { type: 'number' });
    input.min = '1';
    input.value = String(this.plugin.settings.candidateMinNotes);
    input.onchange = async () => {
      const n = Math.max(1, parseInt(input.value, 10) || 1);
      input.value = String(n);
      this.plugin.settings.candidateMinNotes = n;
      await this.plugin.saveSettings();
      await this.refreshCandidates();
    };

    const list = el.createDiv({ cls: 'glossary-overview-list' });
    if (!this.candidates.length) { list.createDiv({ cls: 'glossary-overview-empty', text: t('overview.noCandidates') }); return; }
    const byCount = this.plugin.settings.overviewCandidateSort === 'count';
    const sorted = this.candidates.slice().sort((a, b) =>
      byCount ? (b.count - a.count || b.docFreq - a.docFreq) : (b.docFreq - a.docFreq || b.count - a.count));
    for (const c of sorted) {
      const row = list.createDiv({ cls: 'glossary-overview-row' });
      row.createSpan({ cls: 'glossary-overview-name', text: c.display });
      row.createSpan({ cls: 'glossary-overview-count', text: `${plural('note', c.docFreq)} · ${plural('use', c.count)}` });
      const actions = row.createSpan({ cls: 'glossary-overview-actions' });
      const add = actions.createEl('a', { cls: 'glossary-overview-act', text: t('overview.addTerm') });
      add.onclick = async () => { await this.plugin.createTermNote(null, c.display, false); this.drop(c); };
      const dismiss = actions.createEl('a', { cls: 'glossary-overview-act', text: '✕' });
      dismiss.onclick = async () => { await this.plugin.addToExclusion('excludeWords', c.display.toLowerCase()); this.drop(c); };
    }
  }

  drop(candidate) {
    this.candidates = this.candidates.filter((x) => x !== candidate);
    this.renderCandidates();
  }

  toggleTerms() {
    this.plugin.settings.overviewTermsCollapsed = !this.plugin.settings.overviewTermsCollapsed;
    this.plugin.saveSettings();
    this.renderTerms();
  }

  toggleCandidates() {
    const collapsed = !this.plugin.settings.overviewCandidatesCollapsed;
    this.plugin.settings.overviewCandidatesCollapsed = collapsed;
    this.plugin.saveSettings();
    if (collapsed) this.renderCandidates();
    else this.refreshCandidates();
  }
}

module.exports = { GlossaryOverviewView, OVERVIEW_VIEW_TYPE };
