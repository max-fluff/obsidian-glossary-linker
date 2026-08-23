'use strict';

// One glossary spread over several folders. The list replaced a single-folder setting, so
// the migration off that setting is covered here too.

const { describe, it, assert } = require('../src/shared/testing/harness');
const path = require('path');
const { fakeApp, installStubs } = require('../src/shared/testing/stubs');

installStubs();

// Required when a test runs, not when this file loads: `require` caches by filename, and
// the settings tabs are recorded through an obsidian stub the later test files install.
const construct = () => {
  const Plugin = require(path.join(__dirname, '..', 'src', 'main.js'));
  return new Plugin(fakeApp, { version: '0.0.0', id: 'glossary-linker' });
};

const withFolders = (glossaryFolders) => {
  const plugin = construct();
  plugin.settings = { glossaryFolders };
  return plugin;
};

describe('glossary folders', () => {
  it('takes terms from every folder listed', () => {
    const p = withFolders('99 System/Knowledge Base\n02 Encyclopedia');
    assert.ok(p.isGlossaryPath('99 System/Knowledge Base/Status.md'));
    assert.ok(p.isGlossaryPath('02 Encyclopedia/Status.md'));
    assert.ok(!p.isGlossaryPath('Journal/2026-08-23.md'));
  });

  it('reads an empty list as the whole vault', () => {
    assert.ok(withFolders('').isGlossaryPath('anywhere/at/all.md'));
  });

  it('drops blank lines and a stray trailing slash', () => {
    const p = withFolders('  glossary/  \n\n');
    assert.deepStrictEqual(p.glossaryFolderList(), ['glossary']);
    assert.ok(p.isGlossaryPath('glossary/Spawn.md'));
  });

  it('creates a new term in the first folder listed', () => {
    assert.strictEqual(withFolders('02 Encyclopedia\n99 System').newTermFolder(), '02 Encyclopedia');
    assert.strictEqual(withFolders('').newTermFolder(), '');
  });

  it('groups the notes sharing a title, so the clash has something to show', () => {
    const p = withFolders('a\nb');
    p.terms = [
      { canonical: 'Status', linktext: 'a/Status', path: 'a/Status.md' },
      { canonical: 'Spawn', linktext: 'Spawn', path: 'a/Spawn.md' },
      { canonical: 'Status', linktext: 'b/Status', path: 'b/Status.md' },
    ];
    const groups = [...p.termGroups()].map(([canonical, group]) => [canonical, group.map((x) => x.path)]);
    assert.deepStrictEqual(groups, [
      ['Status', ['a/Status.md', 'b/Status.md']],
      ['Spawn', ['a/Spawn.md']],
    ]);
  });

  it('carries a vault set up under the single-folder setting over to the list', async () => {
    const plugin = construct();
    plugin.loadData = async () => ({ glossaryFolder: '02 Encyclopedia' });
    await plugin.onload();
    assert.strictEqual(plugin.settings.glossaryFolders, '02 Encyclopedia');
  });
});
