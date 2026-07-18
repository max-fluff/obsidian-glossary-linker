'use strict';

// The reading-view decoration, run for real. The behaviour is shared; the names come from
// this plugin's config, and the attribute names are template-built — the only way to check
// them is to produce a node and look at it.

const { describe, it, assert } = require('../src/shared/testing/harness');
const path = require('path');
const { fakeApp, installStubs } = require('./stubs/app');

installStubs();

// Just enough DOM to run the decorator and inspect what it built.
function fakeNode(text) {
  const el = () => {
    const e = {
      tagName: 'SPAN', children: [], attrs: {}, className: '', textContent: '',
      classList: { contains: () => false },
      setAttribute(k, v) { this.attrs[k] = v; },
      getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
      appendChild(c) { this.children.push(c); return c; },
      addEventListener() {},
      parentElement: null,
    };
    return e;
  };
  global.document = {
    createElement: () => el(),
    createTextNode: (t) => ({ nodeText: t }),
    createDocumentFragment: () => el(),
  };
  const parent = el();
  const node = { textContent: text, parentNode: parent };
  parent.replaceChild = (frag) => { parent.replaced = frag; };
  return { node, parent };
}

const load = async () => {
  const Plugin = require(path.join(__dirname, '..', 'src', 'main.js'));
  const plugin = new Plugin(fakeApp, { version: '0.0.0', id: 'glossary-linker' });
  await plugin.onload();
  return plugin;
};

// One known match, so the test is about naming rather than about the matcher.
const withMatch = (plugin, match) => {
  plugin.findMatches = () => [match];
  plugin.yieldedIn = () => [];
  return plugin;
};

const anchors = (parent) => (parent.replaced ? parent.replaced.children.filter((c) => c.attrs) : []);

describe('reading-view decoration', () => {
  it('marks a single match as an internal link with our own class', async () => {
    const plugin = withMatch(await load(), { start: 2, end: 7, display: 'Spawn', canonical: 'Spawn' });
    const { node, parent } = fakeNode('a Spawn here');
    plugin.decorateTextNode(node, null, 'Note.md');

    const a = anchors(parent)[0];
    assert.ok(a, 'nothing was decorated');
    assert.strictEqual(a.className, 'internal-link glossary-link');
    assert.strictEqual(a.getAttribute('data-glossary-target'), 'Spawn');
    assert.strictEqual(a.getAttribute('data-href'), 'Spawn');
    assert.strictEqual(a.textContent, 'Spawn');
  });

  it('marks a match with alternatives as ambiguous and gives it no href', async () => {
    // No data-href on purpose: Obsidian would show one page's preview for a word that
    // resolves to several.
    const plugin = withMatch(await load(), { start: 2, end: 7, display: 'Spawn', canonical: 'Spawn', alts: ['Spawning'] });
    const { node, parent } = fakeNode('a Spawn here');
    plugin.decorateTextNode(node, null, 'Note.md');

    const a = anchors(parent)[0];
    assert.strictEqual(a.className, 'glossary-link glossary-ambiguous');
    assert.strictEqual(a.getAttribute('data-href'), null);
    // And no aria-label either: hovering opens the list of meanings, and the app renders an
    // aria-label as a tooltip, so both would say the same thing on top of each other.
    assert.strictEqual(a.getAttribute('aria-label'), null);
  });

  it('never emits the sibling linker’s names', async () => {
    const plugin = withMatch(await load(), { start: 2, end: 7, display: 'Spawn', canonical: 'Spawn' });
    const { node, parent } = fakeNode('a Spawn here');
    plugin.decorateTextNode(node, null, 'Note.md');

    const a = anchors(parent)[0];
    const written = a.className + ' ' + Object.keys(a.attrs).join(' ');
    assert.ok(!/heading/.test(written), `leaked the heading linker's names: ${written}`);
  });
});
