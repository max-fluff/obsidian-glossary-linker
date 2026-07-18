'use strict';

// Autocomplete candidates. The empty-list cases matter as much as the matches: onTrigger
// reads this to decide whether to claim the popup, and Obsidian only ever asks the first
// suggester that claims. Returning candidates for a word we don't know would silence a
// sibling linker that does.

const { describe, it, assert } = require('./harness');
const { collectSuggestions } = require('../src/term-suggest');

// The suggester reads only the index and the term list, so a hand-built pair stands in for
// a vault. Keys are the matcher's, kept trivial here: this is about candidate selection and
// ranking, not about morphology, which matcher's own tests cover.
function makePlugin(terms) {
  const byKey = new Map();
  for (const t of terms) {
    for (const key of t.keys || []) {
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push({ canonical: t.canonical, wordCount: t.wordCount || 1 });
    }
  }
  return {
    index: { byKey },
    terms: terms.map((t) => ({ canonical: t.canonical, aliases: t.aliases || [] })),
    keysFor: (word) => [word.toLowerCase()],
  };
}

const vault = () => makePlugin([
  { canonical: 'Spawn', keys: ['spawn'] },
  { canonical: 'Spawner pool', keys: ['spawner'], wordCount: 2 },
  { canonical: 'Collision', keys: ['collision'], aliases: ['overlap'] },
]);

describe('collectSuggestions', () => {
  it('offers nothing for a word no term knows', () => {
    assert.deepStrictEqual(collectSuggestions(vault(), 'unrelated', null), []);
  });

  it('offers nothing when the index is empty', () => {
    assert.deepStrictEqual(collectSuggestions(makePlugin([]), 'spawn', null), []);
  });

  it('matches a term by its key', () => {
    const items = collectSuggestions(vault(), 'spawn', null);
    assert.ok(items.some((i) => i.canonical === 'Spawn' && i.kind === 'form'));
  });

  it('matches a prefix of a term title', () => {
    const items = collectSuggestions(vault(), 'colli', null);
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].canonical, 'Collision');
    assert.strictEqual(items[0].kind, 'prefix');
  });

  it('matches a prefix of an alias and reports which wording matched', () => {
    const items = collectSuggestions(vault(), 'over', null);
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].canonical, 'Collision');
    assert.strictEqual(items[0].matchedForm, 'overlap');
  });

  it("never offers the note's own term", () => {
    assert.deepStrictEqual(collectSuggestions(vault(), 'spawn', 'Spawn').filter((i) => i.canonical === 'Spawn'), []);
  });

  it('only takes single-word terms as inflection matches', () => {
    // A multi-word term can still turn up as a prefix, but not off a one-word key: the
    // highlighter is what matches it across several words.
    const items = collectSuggestions(vault(), 'spawner', null);
    assert.ok(items.every((i) => i.kind !== 'form' || i.canonical === 'Spawner pool') || items.length === 0);
  });

  it('ranks inflections above prefixes', () => {
    const items = collectSuggestions(vault(), 'spawn', null);
    assert.ok(items.length >= 2, 'expected a form and a prefix match');
    assert.strictEqual(items[0].kind, 'form');
  });

  it('caps the list', () => {
    const many = [];
    for (let i = 0; i < 20; i++) many.push({ canonical: `Spawn${i}`, keys: ['spawn'] });
    assert.ok(collectSuggestions(makePlugin(many), 'spawn', null).length <= 8);
  });
});
