'use strict';

// Merging a sibling linker's autocomplete candidates into our popup.
//
// Obsidian gives the popup to the first registered suggester whose onTrigger returns a
// context and never asks the rest, so a word both linkers know used to show one plugin's
// answers — and which one depended on load order. Both now build the same complete list.
//
// The case worth guarding hardest is the last one here: a sibling's candidate must be
// written by the sibling. Getting that wrong inserts a syntactically fine link pointing at
// the wrong place, which no build or type check would notice.

const { describe, it, assert } = require('./harness');
const { installStubs } = require('./stubs/app');

installStubs();

const { GlossaryTermSuggest } = require('../src/term-suggest');

const peer = (id, precedence, items) => ({
  api: {
    linker: {
      apiVersion: 1,
      id,
      displayName: id,
      kind: 'prose',
      precedence,
      suggest: () => items,
      linkFor: (target, display) => `[[${target}|${display}]]<${id}>`,
    },
  },
});

// A plugin with an empty index, so `merged` contributes nothing of its own and the test is
// about the merge rather than about the matcher (which has its own tests).
function makeSuggest(peers = {}) {
  const plugin = {
    settings: { linkSuggest: true, suggestMinChars: 1 },
    app: {
      plugins: { plugins: peers },
      workspace: { getActiveFile: () => null },
    },
    api: { linker: { apiVersion: 1, id: 'glossary-linker', kind: 'prose', precedence: 20 } },
    index: { byKey: new Map() },
    terms: [],
    keysFor: () => [],
    activeCanonical: () => null,
    wikiLink: (target, display) => `[[${target}|${display}]]<glossary>`,
  };
  peers['glossary-linker'] = plugin;
  return { plugin, suggest: new GlossaryTermSuggest(plugin.app, plugin) };
}

describe('autocomplete broker', () => {
  it('returns our own list untouched when no sibling is installed', () => {
    const { suggest } = makeSuggest({});
    const items = suggest.merged('spa');
    assert.deepStrictEqual(items, [], 'a solo vault must not gain or lose candidates');
  });

  it('adds a sibling’s candidates to the popup', () => {
    const { suggest } = makeSuggest({
      'heading-linker': peer('heading-linker', 10, [{ label: 'Spawning', note: 'a term', target: 'Spawning', display: 'Spawning' }]),
    });
    const labels = suggest.merged('spa').map((i) => i.label);
    assert.ok(labels.includes('Spawning'), `sibling candidate missing: ${labels.join(', ')}`);
  });

  it('lists a higher-ranked sibling first', () => {
    // Where the priority setting becomes visible in the popup.
    const { suggest } = makeSuggest({
      'heading-linker': peer('heading-linker', 99, [{ label: 'Spawning', note: '', target: 'Spawning', display: 'Spawning' }]),
    });
    assert.strictEqual(suggest.merged('spa')[0].label, 'Spawning');
  });

  it('survives a sibling whose suggest throws', () => {
    const broken = peer('heading-linker', 10, []);
    broken.api.linker.suggest = () => { throw new Error('boom'); };
    const { suggest } = makeSuggest({ 'heading-linker': broken });
    assert.deepStrictEqual(suggest.merged('spa'), [], 'a broken peer took our popup down with it');
  });

  it('lets the sibling write its own link text', () => {
    // The whole point of handing insert() back rather than reading the target ourselves.
    const { suggest } = makeSuggest({
      'heading-linker': peer('heading-linker', 10, [{ label: 'Spawning', note: '', target: 'Spawning', display: 'Spawning' }]),
    });
    const foreign = suggest.merged('spa').find((i) => i.label === 'Spawning');
    assert.ok(foreign && typeof foreign.insert === 'function', 'no insert on the foreign candidate');

    let written = null;
    suggest.context = {
      query: 'spa',
      start: { line: 0, ch: 0 },
      end: { line: 0, ch: 3 },
      editor: {
        getValue: () => 'spa',
        posToOffset: () => 0,
        offsetToPos: (o) => ({ line: 0, ch: o }),
        replaceRange: (text) => { written = text; },
        setCursor: () => {},
      },
    };
    suggest.selectSuggestion(foreign);
    assert.strictEqual(written, '[[Spawning|Spawning]]<heading-linker>');
    assert.ok(!/<glossary>/.test(written), 'wrote our own link format for a sibling’s target');
  });
});
