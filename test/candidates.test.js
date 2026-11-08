'use strict';

const { describe, it, assert } = require('../src/shared/testing/harness');
const path = require('path');
const { fakeApp, installStubs } = require('../src/shared/testing/stubs');

installStubs();

const load = async () => {
  const Plugin = require(path.join(__dirname, '..', 'src', 'main.js'));
  const plugin = new Plugin(fakeApp, { version: '0.0.0', id: 'glossary-linker' });
  await plugin.onload();
  plugin.settings.excludeWords = '';
  plugin.rebuildIndex();
  return plugin;
};

const excluded = (plugin) => plugin.settings.excludeWords.split('\n').filter(Boolean);

describe('dismissing a candidate', () => {
  it('silences every spelling folded into it, even ones that reduce apart', async () => {
    const plugin = await load();
    await plugin.dismissCandidate({ display: 'dormice', forms: ['dormice', 'dormouse'] });
    assert.ok(plugin.wordSilenced('dormice'), 'dormice');
    assert.ok(plugin.wordSilenced('dormouse'), 'dormouse');
  });

  it('adds one line when the shown spelling already covers the rest', async () => {
    const plugin = await load();
    await plugin.dismissCandidate({ display: 'tetrahedra', forms: ['tetrahedra', 'tetrahedron'] });
    assert.deepStrictEqual(excluded(plugin), ['tetrahedra*']);
    assert.ok(plugin.wordSilenced('tetrahedron'));
  });

  it('silences a word whose stem stems again to something else', async () => {
    const plugin = await load();
    await plugin.dismissCandidate({ display: 'universe', forms: ['universe'] });
    assert.ok(plugin.wordSilenced('universe'));
  });

  it('leaves unrelated words alone', async () => {
    const plugin = await load();
    await plugin.dismissCandidate({ display: 'dormice', forms: ['dormice', 'dormouse'] });
    assert.ok(!plugin.wordSilenced('mouse'));
    assert.ok(!plugin.wordSilenced('dorm'));
  });
});
