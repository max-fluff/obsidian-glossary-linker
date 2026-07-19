'use strict';

// Merging a sibling linker's autocomplete candidates into our popup. The case worth
// guarding hardest is the last one: a sibling's candidate must be written by the sibling —
// getting that wrong inserts a fine-looking link pointing at the wrong place.

const { describe, it, assert } = require('../src/shared/testing/harness');
const { installStubs } = require('../src/shared/testing/stubs');

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

  // Our own candidates go through the config handed to createProseSuggest, and the two
  // prose plugins fill it differently — a term links to its title, a heading to
  // "File#Heading". Getting it wrong writes a valid-looking link to the wrong place.
  it('writes our own candidate as a link to the term title', () => {
    const { suggest } = makeSuggest({});
    const written = writeWith(suggest, { kind: 'prefix', canonical: 'Spawn', matchedForm: 'Spawn' });
    assert.strictEqual(written, '[[Spawn|Spawn]]<glossary>');
  });

  it('keeps the reader’s wording when the typed word was an inflection', () => {
    const { suggest } = makeSuggest({});
    const written = writeWith(suggest, { kind: 'form', canonical: 'Spawn', matchedForm: 'Spawn' });
    assert.strictEqual(written, '[[Spawn|spawning]]<glossary>');
  });
});

// selectSuggestion against a fake editor, returning what was written.
function writeWith(suggest, item) {
  let written = null;
  suggest.context = {
    query: 'spawning',
    start: { line: 0, ch: 0 },
    end: { line: 0, ch: 8 },
    editor: {
      getValue: () => 'spawning',
      posToOffset: () => 0,
      offsetToPos: (o) => ({ line: 0, ch: o }),
      replaceRange: (text) => { written = text; },
      setCursor: () => {},
    },
  };
  suggest.selectSuggestion(item);
  return written;
}

describe('plain-text mode', () => {
  // The reader asked for the word, not the link. The wording must be identical to what the
  // link would have shown — an inflection stays the reader's, a prefix still completes — and
  // each row follows the switch of the plugin that owns it, not of whoever holds the popup.
  it('completes a prefix without making a link', () => {
    const { plugin, suggest } = makeSuggest({});
    plugin.settings.suggestPlainText = true;
    assert.strictEqual(writeWith(suggest, { kind: 'prefix', canonical: 'Spawn', matchedForm: 'Spawn' }), 'Spawn');
  });

  it('keeps the reader’s own wording for an inflection', () => {
    const { plugin, suggest } = makeSuggest({});
    plugin.settings.suggestPlainText = true;
    assert.strictEqual(writeWith(suggest, { kind: 'form', canonical: 'Spawn', matchedForm: 'Spawn' }), 'spawning');
  });

  // Two rules at once: our plain-text switch must not rewrite a sibling's row, and `peer()`
  // publishes only linkFor — the way a sibling built before insertFor does — so its rows must
  // still come out as links rather than falling through to nothing.
  it('leaves a sibling’s row to the sibling, falling back to linkFor', () => {
    const { plugin, suggest } = makeSuggest({
      'other-linker': peer('other-linker', 10, [{ label: 'Spawning', note: '', target: 'Spawning', display: 'Spawning' }]),
    });
    plugin.settings.suggestPlainText = true;
    const foreign = suggest.merged('spa').find((i) => i.label === 'Spawning');
    assert.strictEqual(writeWith(suggest, foreign), '[[Spawning|Spawning]]<other-linker>',
      'our switch rewrote a sibling’s row');
  });

  it('honours a sibling that is itself in plain-text mode', () => {
    const plain = peer('other-linker', 10, [{ label: 'Spawning', note: '', target: 'Spawning', display: 'Spawning' }]);
    plain.api.linker.insertFor = (target, display) => display;
    const { plugin, suggest } = makeSuggest({ 'other-linker': plain });
    plugin.settings.suggestPlainText = false;
    const foreign = suggest.merged('spa').find((i) => i.label === 'Spawning');
    assert.strictEqual(writeWith(suggest, foreign), 'Spawning', 'a sibling’s plain text was overridden');
  });

  it('falls back to what was typed when a sibling names no display', () => {
    const { suggest } = makeSuggest({
      'other-linker': peer('other-linker', 10, [{ label: 'Spawning', note: '', target: 'Spawning', display: null }]),
    });
    const foreign = suggest.merged('spa').find((i) => i.label === 'Spawning');
    assert.strictEqual(writeWith(suggest, foreign), '[[Spawning|spawning]]<other-linker>');
  });

  it('still writes links when the switch is off', () => {
    const { plugin, suggest } = makeSuggest({});
    plugin.settings.suggestPlainText = false;
    assert.ok(/^\[\[/.test(writeWith(suggest, { kind: 'prefix', canonical: 'Spawn', matchedForm: 'Spawn' })), 'plain text leaked into link mode');
  });
});
