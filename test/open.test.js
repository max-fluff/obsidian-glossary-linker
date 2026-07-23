'use strict';

// Opening a term must reach the note it names, not whichever the case-insensitive link
// resolver ranks first — the bug where Term and term both opened the same file.

const { describe, it, assert } = require('../src/shared/testing/harness');
const path = require('path');
const { fakeApp, installStubs } = require('../src/shared/testing/stubs');

installStubs();

const load = () => {
  const Plugin = require(path.join(__dirname, '..', 'src', 'main.js'));
  const plugin = new Plugin(fakeApp, { version: '0.0.0', id: 'glossary-linker' });
  plugin.terms = [
    { canonical: 'Term', path: 'glossary/Term.md', aliases: [] },
    { canonical: 'term', path: 'templates/term.md', aliases: [] },
  ];
  return plugin;
};

describe('openTerm', () => {
  it('opens each case-variant term by its own path', () => {
    const plugin = load();
    const opened = [];
    fakeApp.workspace.openLinkText = (linktext) => opened.push(linktext);

    plugin.openTerm('Term', 'Note.md', false);
    plugin.openTerm('term', 'Note.md', false);

    assert.deepStrictEqual(opened, ['glossary/Term.md', 'templates/term.md']);
  });

  it('falls back to the bare name for a target it does not index', () => {
    const plugin = load();
    let opened = null;
    fakeApp.workspace.openLinkText = (linktext) => { opened = linktext; };

    plugin.openTerm('Elsewhere', 'Note.md', false);

    assert.strictEqual(opened, 'Elsewhere');
  });

  it('previews the path, so the preview matches the click', () => {
    const plugin = load();
    let hovered = null;
    fakeApp.workspace.trigger = (name, payload) => { if (name === 'hover-link') hovered = payload.linktext; };

    plugin.hoverTerm({}, {}, 'term', 'Note.md', null);

    assert.strictEqual(hovered, 'templates/term.md');
  });
});
