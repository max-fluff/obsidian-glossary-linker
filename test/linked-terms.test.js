'use strict';

const { describe, it, assert } = require('../src/shared/testing/harness');
const path = require('path');
const { fakeApp, installStubs } = require('../src/shared/testing/stubs');

installStubs();

const make = (settings) => {
  const Plugin = require(path.join(__dirname, '..', 'src', 'main.js'));
  const p = new Plugin(fakeApp, { version: '0.0.0', id: 'glossary-linker' });
  p.settings = { glossaryFolders: 'Glossary', ...settings };
  p.terms = [{ canonical: 'Nikki', linktext: 'Nikki', path: 'Glossary/Nikki.md', aliases: [] }];
  const files = {
    Nikki: { path: 'Glossary/Nikki.md', basename: 'Nikki', extension: 'md' },
    'Glossary/00-index': { path: 'Glossary/00-index.md', basename: '00-index', extension: 'md' },
  };
  p.app = { ...fakeApp, metadataCache: { ...fakeApp.metadataCache, getFirstLinkpathDest: (t) => files[t] || null } };
  return p;
};

describe('glossary links and the term index', () => {
  it('leaves a link to an excluded note alone when unlinking', () => {
    const p = make({});
    const text = 'On [[Nikki]]. See [[Glossary/00-index|contents]].';
    assert.deepStrictEqual(p.findGlossaryLinks(text, 'Note.md').map((l) => l.canonical), ['Nikki']);
  });

  it('counts an existing link as the first occurrence', () => {
    const p = make({ linkFirstOnly: true });
    const text = '[[Nikki]] runs on the router.\nLater Nikki comes up again.';
    assert.deepStrictEqual(p.firstUnlinked([{ linktext: 'Nikki' }], text, 'Note.md'), []);
  });

  it('drops every match of a term already linked above when collecting', () => {
    const p = make({ linkFirstOnly: true });
    p.findMatches = () => [{ linktext: 'Nikki', start: 20 }, { linktext: 'Other', start: 30 }];
    assert.deepStrictEqual(p.collectMatches('[[Nikki]] and Nikki and Other', null, 'Note.md').map((m) => m.linktext), ['Other']);
  });

  it('checks the term it will link to, not the one it matched', () => {
    const p = make({ linkFirstOnly: true });
    assert.deepStrictEqual(p.firstUnlinked([{ linktext: 'Spawn' }], '[[Nikki]] then Spawn', 'Note.md', 'Nikki'), []);
  });

  it('still takes the first plain mention when nothing is linked yet', () => {
    const p = make({ linkFirstOnly: true });
    const matches = [{ linktext: 'Nikki' }, { linktext: 'Nikki' }];
    assert.strictEqual(p.firstUnlinked(matches, 'Nikki and Nikki.', 'Note.md').length, 1);
  });
});
