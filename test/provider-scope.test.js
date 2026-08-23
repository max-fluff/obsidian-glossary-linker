'use strict';

// What this plugin tells a sibling about a note. Both members are asked by whichever plugin
// happens to be doing the work — the popup owner, or the linker that outranks us — and that
// plugin cannot see our scope or our switches. If we answer for a note we do not cover, a
// sibling stands down on a word we will never draw, and it ends up linked by nobody.
//
// Every check here pairs a gated call with an ungated one. The plugin under test loads with
// an empty index, so an assertion that only looked for an empty answer would pass whether or
// not the gate exists at all.

const { describe, it, assert } = require('../src/shared/testing/harness');
const path = require('path');
const { fakeApp, installStubs } = require('../src/shared/testing/stubs');

installStubs();

const SPAN = { start: 2, end: 7, canonical: 'Spawn', linktext: 'Spawn' };

const load = async () => {
  const Plugin = require(path.join(__dirname, '..', 'src', 'main.js'));
  const plugin = new Plugin(fakeApp, { version: '0.0.0', id: 'glossary-linker' });
  await plugin.onload();
  // Something to answer with: the harness vault is empty, so the real index never fills.
  plugin.findMatches = () => [SPAN];
  plugin.terms = [{ canonical: 'Spawn', linktext: 'Spawn', path: 'Spawn.md', aliases: [] }];
  plugin.settings.linkSuggest = true;
  plugin.settings.suggestMinChars = 1;
  return plugin;
};

// Folder mode with an empty folder list covers nothing — the cheapest way to be definitively
// out of scope without building a vault.
const outOfScope = (plugin) => {
  plugin.settings.scopeMode = 'folders';
  plugin.settings.scopeFolders = '';
};

describe('what we tell a sibling', () => {
  it('answers what it knows, whatever the note', async () => {
    // matches is the index question only; where we are switched on is drawsIn's answer.
    const plugin = await load();
    outOfScope(plugin);
    assert.strictEqual(plugin.api.linker.matches('a spawn here').length, 1);
  });

  it('draws in a note we cover', async () => {
    const provider = (await load()).api.linker;
    assert.strictEqual(provider.drawsIn('Any/note.md', 'editing'), true);
  });

  it('draws nothing in a note outside our scope', async () => {
    const plugin = await load();
    outOfScope(plugin);
    assert.strictEqual(plugin.api.linker.drawsIn('Any/note.md', 'editing'), false);
    assert.strictEqual(plugin.api.linker.drawsIn('Any/note.md', 'reading'), false);
    assert.strictEqual(plugin.api.linker.drawsIn('Any/note.md', 'menu'), false);
  });

  it('draws nothing on a surface whose highlight is switched off', async () => {
    const plugin = await load();
    plugin.settings.highlightInReading = false;
    plugin.settings.editingHighlight = 'off';
    assert.strictEqual(plugin.api.linker.drawsIn('Any/note.md', 'reading'), false);
    assert.strictEqual(plugin.api.linker.drawsIn('Any/note.md', 'editing'), false);
    // Acting on a word is not drawing it, so the menu still owns its words.
    assert.strictEqual(plugin.api.linker.drawsIn('Any/note.md', 'menu'), true);
  });

  it('offers a suggestion in a note we cover', async () => {
    const provider = (await load()).api.linker;
    assert.strictEqual(provider.suggest('spa', 'Any/note.md').length, 1);
  });

  it('offers none once our own autocomplete is off', async () => {
    const plugin = await load();
    plugin.settings.linkSuggest = false;
    assert.deepStrictEqual(plugin.api.linker.suggest('spa', 'Any/note.md'), []);
  });

  it('offers none in a note outside our scope', async () => {
    const plugin = await load();
    outOfScope(plugin);
    assert.deepStrictEqual(plugin.api.linker.suggest('spa', 'Any/note.md'), []);
  });

  it('applies our own minimum typed length, not the popup owner’s', async () => {
    const plugin = await load();
    plugin.settings.suggestMinChars = 5;
    assert.deepStrictEqual(plugin.api.linker.suggest('spa', 'Any/note.md'), []);
    assert.strictEqual(plugin.api.linker.suggest('spawn', 'Any/note.md').length, 1,
      'the threshold rejected a long enough word too');
  });
});

describe('what we tell peers while drawing', () => {
  // The reading view knows which note it is rendering — it may not even be the active one,
  // when Obsidian draws an embed or a preview pane. If it does not pass that on, every peer
  // answers for the whole vault and the scope check above is never reached.
  it('names the note and the surface when asking who claims a span', async () => {
    const plugin = await load();
    const seen = [];
    plugin.ownSpans = (text, matches, where) => { seen.push(where); return []; };
    plugin.decorateTextNode({ textContent: 'a spawn here' }, null, 'Deep/inside.md');
    assert.deepStrictEqual(seen, [{ path: 'Deep/inside.md', surface: 'reading' }],
      'peers were asked without knowing where');
  });
});

// Two notes under one title used to reach a sibling as one row, under a title naming neither.
describe('a shared title as a sibling sees it', () => {
  const clashing = async () => {
    const plugin = await load();
    plugin.findMatches = () => [{ start: 2, end: 11, canonical: 'Collision', linktext: 'glossary/Collision', alts: ['encyclopedia/Collision'] }];
    plugin.terms = [
      { canonical: 'Collision', linktext: 'glossary/Collision', path: 'glossary/Collision.md', aliases: [] },
      { canonical: 'Collision', linktext: 'encyclopedia/Collision', path: 'encyclopedia/Collision.md', aliases: [] },
    ];
    return plugin;
  };

  it('carries every note the span could mean', async () => {
    const plugin = await clashing();
    const [span] = plugin.api.linker.matches('a collision here');
    assert.strictEqual(span.target, 'glossary/Collision');
    assert.deepStrictEqual(span.alts, [{ label: 'Collision', target: 'encyclopedia/Collision' }]);
  });

  it('tells the two apart by where they live, since the title cannot', async () => {
    const plugin = await clashing();
    const [span] = plugin.api.linker.matches('a collision here');
    const notes = [span.target, ...span.alts.map((a) => a.target)].map((t) => plugin.api.linker.describe(t, 'collision'));
    assert.deepStrictEqual(notes.map((n) => n.title), ['Collision', 'Collision']);
    assert.deepStrictEqual(notes.map((n) => n.note), ['Term · glossary', 'Term · encyclopedia']);
  });

  it('writes the link to the note picked, not to the title they share', async () => {
    const plugin = await clashing();
    assert.strictEqual(plugin.api.linker.linkFor('encyclopedia/Collision', 'collision'), '[[encyclopedia/Collision|collision]]');
  });
});
