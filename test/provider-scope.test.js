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

const SPAN = { start: 2, end: 7, canonical: 'Spawn' };

const load = async () => {
  const Plugin = require(path.join(__dirname, '..', 'src', 'main.js'));
  const plugin = new Plugin(fakeApp, { version: '0.0.0', id: 'glossary-linker' });
  await plugin.onload();
  // Something to answer with: the harness vault is empty, so the real index never fills.
  plugin.findMatches = () => [SPAN];
  plugin.terms = [{ canonical: 'Spawn', path: 'Spawn.md', aliases: [] }];
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
