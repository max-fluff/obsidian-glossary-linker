'use strict';

// The term index and matching engine.
//
// The scan now lives in shared/prose/matcher.js and is driven by this plugin's config, so
// these cover the glossary side of it: what a term is, what counts as the note's own term,
// and the two rules that are ours alone — excluded words, and which spans are off limits.
// They lean on observable results (what matched, where, which term) rather than internals.

const { describe, it, assert } = require('../src/shared/testing/harness');
const matcher = require('../src/matcher');
const actions = require('../src/actions');
const { TFile } = require('obsidian');
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
  p.app = { vault: { getMarkdownFiles: () => notes.map((n) => ({ basename: n.title, path: n.path || `${n.title}.md`, extension: 'md' })) } };
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

  it('addresses a term by its title while the title names one note', () => {
    const p = makePlugin({ notes: [spawn] });
    assert.deepStrictEqual(p.terms.map((t) => t.linktext), ['Spawn']);
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

  it('leaves the other forms of the term linking', () => {
    // The list holds spellings: excluding "spawn" is not a wish to lose the term.
    const p = makePlugin({ notes: [spawn], settings: { excludeWords: 'spawn' } });
    assert.deepStrictEqual(p.findMatches('two spawns here', null).map((m) => m.canonical), ['Spawn']);
  });

  it('keeps a term whose stem an excluded word shares', () => {
    // Reported against the heading linker as issue #1: "specifically" and "specification"
    // reduce to one stem, and silencing the first must not cost the term.
    const p = makePlugin({ notes: [{ title: 'Specification' }], settings: { excludeWords: 'specifically' } });
    assert.deepStrictEqual(p.findMatches('specifically about the specification', null).map((m) => m.canonical), ['Specification']);
  });

  it('silences every form behind a starred line', () => {
    const p = makePlugin({ notes: [spawn], settings: { excludeWords: 'spawn*' } });
    assert.deepStrictEqual(p.findMatches('a spawn and two spawns', null), []);
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

// Two notes under one title used to collapse into a single term, so the reader never
// learned the second one existed.
describe('a title two notes share', () => {
  const twice = [
    { title: 'Collision', path: 'glossary/Collision' },
    { title: 'Collision', path: 'encyclopedia/Collision' },
  ];

  it('addresses each note by its path instead', () => {
    const p = makePlugin({ notes: twice });
    assert.deepStrictEqual(p.terms.map((t) => t.linktext), ['glossary/Collision', 'encyclopedia/Collision']);
  });

  it('offers both notes on the word, as alternatives to pick between', () => {
    const p = makePlugin({ notes: twice });
    const m = p.findMatches('a collision here', null);
    assert.strictEqual(m.length, 1);
    assert.deepStrictEqual([m[0].linktext, ...(m[0].alts || [])], ['glossary/Collision', 'encyclopedia/Collision']);
  });

  it('leaves the notes that keep a title of their own addressed by it', () => {
    const p = makePlugin({ notes: [...twice, spawn] });
    assert.strictEqual(p.terms.find((t) => t.canonical === 'Spawn').linktext, 'Spawn');
  });
});

describe('an alias with punctuation between its words (#5)', () => {
  it('links the text written the same way', () => {
    const p = makePlugin({ notes: [{ title: 'Ticket', aliases: ['1234/1234'] }] });
    const m = p.findMatches('see 1234/1234 for details', null);
    assert.deepStrictEqual(m.map((x) => [x.display, x.canonical]), [['1234/1234', 'Ticket']]);
  });

  it('still inflects the words around the punctuation', () => {
    const p = makePlugin({ notes: [{ title: 'Client/server model' }] });
    const m = p.findMatches('two client/server models', null);
    assert.deepStrictEqual(m.map((x) => x.display), ['client/server models']);
  });
});

describe('a new term containing an existing one (#6)', () => {
  const notes = [{ title: 'language' }];

  it('is not taken for the shorter term it contains', () => {
    const p = makePlugin({ notes });
    assert.deepStrictEqual(p.termsMatchingWhole('natural language'), []);
    assert.deepStrictEqual(p.termsMatchingWhole('large language models'), []);
  });

  it('is still caught when it is only another form of an existing term', () => {
    const p = makePlugin({ notes });
    assert.deepStrictEqual(p.termsMatchingWhole('languages'), ['language']);
  });

  // The create-term action over the matcher, with the two ways out of it recorded: making
  // the note, or opening the term the selection already is.
  const createFrom = async (sel) => {
    const settings = { aliasCollisionWarnings: true };
    const p = Object.assign(makePlugin({ notes, settings }), actions);
    const made = [];
    const opened = [];
    p.createTermNote = async (editor, text) => { made.push(text); };
    p.openTerm = (linktext) => { opened.push(linktext); };
    p.labelFor = (linktext) => linktext;
    p.app.workspace = { getActiveFile: () => null };
    await p.createTermFromSelection({ getSelection: () => sel }, true);
    return { made, opened };
  };

  it('is created from a selection rather than opening the shorter term', async () => {
    const got = await createFrom('natural language');
    assert.deepStrictEqual(got, { made: ['natural language'], opened: [] });
  });

  it('is not created from a selection that is the existing term in another form', async () => {
    assert.deepStrictEqual(await createFrom('languages'), { made: [], opened: ['language'] });
  });

  it('is no collision as an alias collected for another term', () => {
    // [[NLP|natural language]] collects "natural language" for NLP; "language" inside it
    // is no other term on the same wording, so there is nothing to warn about.
    const settings = {
      aliasCollisionWarnings: true, aliasHarvestMode: 'literal',
      harvestSingleWordOnly: false, harvestMinLength: 2,
    };
    const p = Object.assign(makePlugin({ notes: [...notes, { title: 'NLP' }], settings }), actions);
    p.linktextForPath = () => 'NLP';
    p.labelFor = (linktext) => linktext;
    const add = new Map();
    const file = { path: 'NLP.md', basename: 'NLP' };
    p.collectAliasesFromDisplay(file, 'natural language', new Set(), add, new Set());
    assert.deepStrictEqual([...add], [['natural language', []]]);
  });

  // Adding an alias by hand: which other terms it is reported to collide with, as the
  // labels asked for — the notice itself is a stub that shows nothing.
  const collisionsOf = async (alias) => {
    const p = Object.assign(makePlugin({ notes: [...notes, { title: 'NLP' }] }), actions);
    const labelled = [];
    p.labelFor = (linktext) => { labelled.push(linktext); return linktext; };
    p.updateStatusBar = () => {};
    p.app.vault.getAbstractFileByPath = () => Object.assign(new TFile(), { basename: 'NLP' });
    p.app.fileManager = { processFrontMatter: async () => {} };
    await p.writeAlias(p.terms.find((x) => x.canonical === 'NLP'), alias);
    return labelled;
  };

  it('is no collision as an alias added by hand', async () => {
    assert.deepStrictEqual(await collisionsOf('natural language'), []);
    assert.deepStrictEqual(await collisionsOf('languages'), ['language']);
  });

  it('wins over the shorter term once it exists', () => {
    const p = makePlugin({ notes: [{ title: 'language' }, { title: 'natural language' }] });
    const m = p.findMatches('a natural language and a language', null);
    assert.deepStrictEqual(m.map((x) => [x.display, x.canonical]), [
      ['natural language', 'natural language'],
      ['language', 'language'],
    ]);
  });
});
