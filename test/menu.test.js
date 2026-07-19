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
  match: { start: 0, end: 5, display: 'spawn', alts: [], canonical: 'Spawn' },
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

  it('groups its own two lists even with no sibling installed', async () => {
    // Words and terms are separate lists, so on a link we alone contribute two lines.
    const plugin = await load();
    fakeApp.plugins.plugins = {};
    plugin.matchAtCursor = () => null;
    plugin.wordAtCursor = () => null;
    plugin.glossaryLinkAt = () => ({ display: 'Spawn', targetFile: null });

    const menu = menuFor();
    assert.ok(menu.groups().includes('Exclude “Spawn”'), JSON.stringify(menu.groups()));
    const inGroup = menu.titles().filter((x) => /^Exclude/.test(x));
    assert.strictEqual(inGroup.length, 2, JSON.stringify(menu.titles()));
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
