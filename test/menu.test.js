'use strict';

// What the editor menu offers on a word, and what its items actually do. Both cases below
// broke in a vault while the suite stayed green: nothing exercised the menu handler.

const { describe, it, assert } = require('../src/shared/testing/harness');
const path = require('path');
const { fakeApp, installStubs, recordingMenu, fakeEditor } = require('../src/shared/testing/stubs');

installStubs();

const load = async () => {
  const Plugin = require(path.join(__dirname, '..', 'src', 'main.js'));
  const plugin = new Plugin(fakeApp, { version: '0.0.0', id: 'glossary-linker' });
  await plugin.onload();
  plugin.inScope = () => true;
  fakeApp.workspace.getActiveFile = () => ({ path: 'Note.md', basename: 'Note', extension: 'md' });
  return plugin;
};

const hitWith = (foreign = []) => ({
  line: 0,
  match: { start: 0, end: 5, display: 'spawn', alts: [], canonical: 'Spawn', linktext: 'Spawn' },
  foreign,
});

const menuFor = () => {
  const menu = recordingMenu();
  fakeApp.handlers.get('editor-menu')(menu, fakeEditor('spawn here', 2));
  return menu;
};

describe('editor menu', () => {
  it('links the word rather than opening a peer’s note', async () => {
    // A link is written by the linker that owns it, so a peer's reading in a Link action
    // could only open its note. A term note usually carries a heading of the same name, so
    // this contested case is the ordinary one.
    const plugin = await load();
    let opened = 0;
    let linked = null;
    plugin.matchAtCursor = () => hitWith([{ label: 'Guide#Spawn', open: () => { opened++; } }]);
    plugin.materializeSingle = (...a) => { linked = a[1]; };

    const item = menuFor().items.find((e) => /here/i.test(e.title) && e.click);
    assert.ok(item, 'no "link here" item');
    await item.click();
    assert.strictEqual(linked, 'Spawn');
    assert.strictEqual(opened, 0, 'a Link action opened the peer’s note');
  });

  it('still offers the peer’s reading when opening', async () => {
    const plugin = await load();
    plugin.matchAtCursor = () => hitWith([{ label: 'Guide#Spawn', open: () => {} }]);
    let handed = null;
    plugin.chooseTerm = (cands) => { handed = cands; };

    const item = menuFor().items.find((e) => /^Open/.test(e.title) && e.click);
    assert.ok(item, 'no "open" item');
    await item.click();
    assert.strictEqual(handed.length, 2, 'the peer’s reading was dropped from Open');
  });

  it('offers to undo an exclusion once the word is excluded', async () => {
    const plugin = await load();
    plugin.matchAtCursor = () => null;
    plugin.wordAtCursor = () => null;
    plugin.settings.excludeTerms = 'spawn';

    const titles = menuFor().titles();
    assert.ok(titles.some((x) => /^Remove/.test(x)), `no undo item: ${JSON.stringify(titles)}`);
  });

  it('undoes an exclusion from whichever list holds the word', async () => {
    // The glossary keeps two lists, and only the one the word is actually on should offer
    // to take it off.
    const plugin = await load();
    plugin.matchAtCursor = () => null;
    plugin.wordAtCursor = () => null;
    plugin.settings.excludeWords = 'spawn';
    plugin.settings.excludeTerms = '';

    const titles = menuFor().titles();
    assert.strictEqual(titles.length, 1, `expected one undo item, got ${JSON.stringify(titles)}`);
    assert.ok(/words/.test(titles[0]), titles[0]);
  });

  it('gathers the three ways to stop one word under it', async () => {
    // All three act on the word under the cursor — the term item too, even though what it
    // writes is the term's title — so they read as one set rather than a line plus a menu.
    const plugin = await load();
    fakeApp.plugins.plugins = {};
    plugin.matchAtCursor = () => null;
    plugin.wordAtCursor = () => null;
    plugin.glossaryLinkAt = () => ({ display: 'spawning', canonical: 'Spawn', targetFile: null });

    const titles = menuFor().titles();
    assert.ok(titles.includes('Stop linking “spawning” ▸ this spelling'), JSON.stringify(titles));
    assert.ok(titles.includes('Stop linking “spawning” ▸ every form of it'), JSON.stringify(titles));
    assert.ok(titles.includes('Add "Spawn" to excluded terms'), JSON.stringify(titles));
  });

  it('offers the word lists on the term’s own title too', async () => {
    // Reported on a term named for an everyday word: excluding the term takes it out of the
    // index and the autocomplete, which is not what "stop linking this word" means.
    const plugin = await load();
    plugin.matchAtCursor = () => ({
      line: 0,
      match: { start: 0, end: 5, display: 'Наряд', alts: [], canonical: 'Наряд', linktext: 'Наряд' },
      foreign: [],
    });

    const titles = menuFor().titles();
    assert.ok(titles.includes('Stop linking “Наряд” ▸ this spelling'), JSON.stringify(titles));
    assert.ok(titles.includes('Stop linking “Наряд” ▸ every form of it'), JSON.stringify(titles));
    assert.ok(titles.includes('Add "Наряд" to excluded terms'), JSON.stringify(titles));
  });

  it('writes the base form when the reader asks for every form', async () => {
    const plugin = await load();
    plugin.matchAtCursor = () => ({
      line: 0,
      match: { start: 0, end: 8, display: 'spawning', alts: [], canonical: 'Spawn', linktext: 'Spawn' },
      foreign: [],
    });

    await menuFor().items.find((e) => e.title === 'every form of it').click();
    assert.strictEqual(plugin.settings.excludeWords, 'spawn*');
  });

  it('offers nothing on a word it neither matches nor excludes', async () => {
    const plugin = await load();
    plugin.matchAtCursor = () => null;
    plugin.wordAtCursor = () => null;
    plugin.settings.excludeWords = '';
    plugin.settings.excludeTerms = '';
    assert.deepStrictEqual(menuFor().titles(), []);
  });
});
