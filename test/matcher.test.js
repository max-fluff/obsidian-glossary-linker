'use strict';

// The term index and matching engine.
//
// The scan now lives in shared/prose/matcher.js and is driven by this plugin's config, so
// these cover the glossary side of it: what a term is, what counts as the note's own term,
// and the two rules that are ours alone — excluded words, and which spans are off limits.
// They lean on observable results (what matched, where, which term) rather than internals.

const { describe, it, assert } = require('../src/shared/testing/harness');
const matcher = require('../src/matcher');
const en = require('../src/shared/morphology/languages/en.js');

// A stand-in for the plugin object the matcher mixin is applied to: just the state its
// methods reach for. Vault access is stubbed by handing it the notes directly.
function makePlugin({ notes = [], settings = {} } = {}) {
  const p = Object.assign({}, matcher);
  // The real plugin gets this from the api mixin; rebuildIndex tells subscribers the index
  // moved, and nothing here is subscribing.
  p.notifyIndexChange = () => {};
  p.settings = Object.assign(
    {
      matchMode: 'stemmer',
      minTermLength: 2,
      skipHeadings: true,
      excludeTerms: '',
      excludeWords: '',
      smartCase: true, // as shipped — a test that wants it off says so
    },
    settings
  );
  p.activeLanguages = [en];
  p.keysCache = new Map();
  p.index = { byKey: new Map(), termCount: 0 };
  p.terms = [];
  p.aliasFingerprints = new Map();
  p.app = { vault: { getMarkdownFiles: () => notes.map((n) => ({ basename: n.title, path: `${n.title}.md`, extension: 'md' })) } };
  p.isGlossaryFile = () => true;
  p.aliasesOf = (file) => {
    const found = notes.find((n) => n.title === file.basename);
    return (found && found.aliases) || [];
  };
  p.rebuildIndex();
  return p;
}

const spawn = { title: 'Spawn' };

describe('rebuildIndex', () => {
  it('indexes a note as a term under its title', () => {
    const p = makePlugin({ notes: [spawn] });
    assert.strictEqual(p.index.termCount, 1);
    assert.deepStrictEqual(p.terms.map((t) => t.canonical), ['Spawn']);
  });

  it('matches an alias as well as the title', () => {
    const p = makePlugin({ notes: [{ title: 'Spawn', aliases: ['respawn'] }] });
    const m = p.findMatches('a respawn here', null);
    assert.strictEqual(m.length, 1);
    assert.strictEqual(m[0].canonical, 'Spawn');
  });

  it('drops the whole entry when its title is excluded', () => {
    const p = makePlugin({ notes: [spawn], settings: { excludeTerms: 'spawn' } });
    assert.strictEqual(p.index.termCount, 0);
  });
});

describe('findMatches', () => {
  it('matches an inflected form of a term', () => {
    const p = makePlugin({ notes: [spawn] });
    const m = p.findMatches('two spawns here', null);
    assert.strictEqual(m.length, 1);
    assert.strictEqual(m[0].display, 'spawns', 'the note keeps its own wording');
    assert.strictEqual(m[0].canonical, 'Spawn');
  });

  it('does not link a note to its own term', () => {
    const p = makePlugin({ notes: [spawn] });
    assert.deepStrictEqual(p.findMatches('about spawn', 'Spawn'), []);
  });

  it('reports the other terms matching the same span', () => {
    // A collision the reader resolves, rather than one the index resolves silently.
    const p = makePlugin({ notes: [{ title: 'Spawn' }, { title: 'Origin', aliases: ['spawn'] }] });
    const m = p.findMatches('the spawn', null);
    assert.strictEqual(m.length, 1);
    assert.ok(m[0].alts && m[0].alts.length === 1, `expected one alternative, got ${JSON.stringify(m[0].alts)}`);
  });
});

describe('excluded words', () => {
  it('never links an excluded word on its own', () => {
    const p = makePlugin({ notes: [spawn], settings: { excludeWords: 'spawn' } });
    assert.deepStrictEqual(p.findMatches('a spawn here', null), []);
  });

  it('still links a longer term that contains it', () => {
    // Excluding "spawn" should not cost you "spawn point".
    const p = makePlugin({ notes: [{ title: 'Spawn point' }], settings: { excludeWords: 'spawn' } });
    const m = p.findMatches('at the spawn point', null);
    assert.strictEqual(m.length, 1);
    assert.strictEqual(m[0].canonical, 'Spawn point');
  });
});

describe('protected ranges', () => {
  const matched = (text) => makePlugin({ notes: [spawn] }).findMatches(text, null, { protect: true });

  it('links plain prose', () => {
    assert.strictEqual(matched('a spawn here').length, 1);
  });

  it('leaves code, links and urls alone', () => {
    assert.deepStrictEqual(matched('`spawn`'), []);
    assert.deepStrictEqual(matched('[[spawn]]'), []);
    assert.deepStrictEqual(matched('https://example.com/spawn'), []);
  });

  it('leaves an Obsidian comment alone', () => {
    // The heading linker keeps its aliases in `%% alias: … %%`, so linking inside a comment
    // would corrupt a sibling's declaration.
    assert.deepStrictEqual(matched('%% alias: spawn %%'), []);
    assert.strictEqual(makePlugin({ notes: [spawn] }).isProtectedAt('%% alias: spawn %%', 12), true);
  });
});

describe('smart case', () => {
  // The rule itself is pinned in the shared suite; these cover this plugin's half of it —
  // that a note title is indexed with its case marks and that the config asks for the rule
  // at all. Without either, an acronym note silently links every lowercase spelling.
  const hits = (p, text) => p.findMatches(text, null).map((m) => m.canonical);

  it('keeps an acronym note off the ordinary word', () => {
    const p = makePlugin({ notes: [{ title: 'IT' }] });
    assert.deepStrictEqual(hits(p, 'the IT department'), ['IT']);
    assert.deepStrictEqual(hits(p, 'it depends'), [], 'the pronoun was linked to the note');
  });

  it('leaves an ordinary note title case-insensitive', () => {
    const p = makePlugin({ notes: [spawn] });
    assert.deepStrictEqual(hits(p, 'a spawn here'), ['Spawn']);
    assert.deepStrictEqual(hits(p, 'A Spawn here'), ['Spawn']);
  });

  it('cases an acronym alias without casing its note title', () => {
    const p = makePlugin({ notes: [{ title: 'Central nervous system', aliases: ['CNS'] }] });
    assert.deepStrictEqual(hits(p, 'the CNS is'), ['Central nervous system']);
    assert.deepStrictEqual(hits(p, 'the cns is'), [], 'the alias matched lowercase');
    assert.deepStrictEqual(hits(p, 'the central nervous system is'), ['Central nervous system']);
  });

  it('turns the rule off with the setting', () => {
    const p = makePlugin({ notes: [{ title: 'IT' }], settings: { smartCase: false } });
    assert.deepStrictEqual(hits(p, 'it depends'), ['IT']);
  });
});
