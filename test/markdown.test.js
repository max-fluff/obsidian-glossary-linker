'use strict';

// Shared markdown helpers. Every linker plugin bundles this module, and the planned
// {root}-token migration rewrites links through rewriteLinks, so its "skip code" rule
// is load-bearing: rewriting an example inside a fence would edit someone's illustration.

const { describe, it, assert } = require('./harness');
const md = require('../src/shared/markdown');

describe('splitLines', () => {
  it('trims entries and drops blanks', () => {
    assert.deepStrictEqual(md.splitLines(' a \n\n  b\n'), ['a', 'b']);
  });

  it('treats empty input as an empty list', () => {
    assert.deepStrictEqual(md.splitLines(''), []);
    assert.deepStrictEqual(md.splitLines(null), []);
  });
});

describe('linkRegex', () => {
  it('captures the text and the destination', () => {
    const m = md.linkRegex().exec('see [the docs](Guide.md) here');
    assert.strictEqual(m[1], 'the docs');
    assert.strictEqual(m[2], 'Guide.md');
  });

  it('hands back a fresh instance so scanners do not share lastIndex', () => {
    const a = md.linkRegex();
    a.exec('[x](y) [z](w)');
    assert.strictEqual(md.linkRegex().lastIndex, 0);
  });

  it('keeps a destination holding spaces intact', () => {
    const m = md.linkRegex().exec('[doc](file:///a b/c.pdf "sec:Intro")');
    assert.strictEqual(m[2], 'file:///a b/c.pdf "sec:Intro"');
  });
});

describe('splitTarget / withTitle', () => {
  it('splits a quoted title off the end', () => {
    assert.deepStrictEqual(md.splitTarget('file:///root/Player.cs "sym:Player"'), { url: 'file:///root/Player.cs', title: 'sym:Player' });
  });

  it('accepts single quotes', () => {
    assert.deepStrictEqual(md.splitTarget("Guide.md 'a note'"), { url: 'Guide.md', title: 'a note' });
  });

  it('leaves a bare url alone', () => {
    assert.deepStrictEqual(md.splitTarget('Guide.md'), { url: 'Guide.md', title: '' });
  });

  it('keeps spaces that belong to the url', () => {
    assert.deepStrictEqual(md.splitTarget('file:///a b/c.pdf "sec:Intro"'), { url: 'file:///a b/c.pdf', title: 'sec:Intro' });
  });

  it('round-trips through withTitle', () => {
    const { url, title } = md.splitTarget('u/v.cs "sym:A kind:class"');
    assert.strictEqual(md.withTitle(url, title), 'u/v.cs "sym:A kind:class"');
  });

  it('omits the quotes when there is no title', () => {
    assert.strictEqual(md.withTitle('u/v.cs', ''), 'u/v.cs');
  });
});

describe('isProtected', () => {
  const at = (text, needle) => md.isProtected(text, text.indexOf(needle) + 1);

  it('protects inline and fenced code', () => {
    assert.ok(at('text `spawn` text', 'spawn'));
    assert.ok(at('```\nspawn\n```', 'spawn'));
  });

  it('protects frontmatter', () => {
    assert.ok(at('---\ntitle: spawn\n---\nbody', 'spawn'));
  });

  it('protects the inside of an existing link', () => {
    assert.ok(at('see [spawn](Other.md) here', 'spawn'));
  });

  it('allows plain prose, headings and tables on purpose', () => {
    assert.ok(!at('a spawn in prose', 'spawn'));
    assert.ok(!at('## spawn', 'spawn'));
  });
});

describe('inTableCell', () => {
  const table = 'x\n\n| a | b |\n| --- | --- |\n| spawn | y |\n\nafter';

  it('is true inside a real GFM table', () => {
    assert.ok(md.inTableCell(table, table.indexOf('spawn') + 1));
  });

  it('is false for a lone pipe with no delimiter row', () => {
    const text = 'a | spawn | b';
    assert.ok(!md.inTableCell(text, text.indexOf('spawn') + 1));
  });

  it('is false outside the table block', () => {
    assert.ok(!md.inTableCell(table, table.indexOf('after') + 1));
  });
});

describe('rewriteLinks', () => {
  it('rewrites the links the callback claims and counts them', () => {
    const out = md.rewriteLinks('see [a](one.md) and [b](two.md)', (name, target) => (target === 'one.md' ? `[${name}](ONE.md)` : null));
    assert.strictEqual(out.count, 1);
    assert.strictEqual(out.text, 'see [a](ONE.md) and [b](two.md)');
  });

  it('leaves links inside a fenced block alone', () => {
    const text = '```\n[a](one.md)\n```';
    const out = md.rewriteLinks(text, () => '[x](CHANGED)');
    assert.strictEqual(out.count, 0);
    assert.strictEqual(out.text, text);
  });

  it('leaves links inside inline code alone', () => {
    const text = 'like `[a](one.md)` here';
    const out = md.rewriteLinks(text, () => '[x](CHANGED)');
    assert.strictEqual(out.count, 0);
    assert.strictEqual(out.text, text);
  });

  it('can migrate a token in the destination — the {root} case', () => {
    const text = 'a [doc](file:///{root}/Spec.pdf "sec:Intro") b';
    const out = md.rewriteLinks(text, (name, target) => `[${name}](${target.replace('{root}', '{ref-root}')})`);
    assert.strictEqual(out.count, 1);
    assert.ok(out.text.includes('{ref-root}'), out.text);
    assert.ok(out.text.includes('"sec:Intro"'), 'the title must survive the rewrite');
  });
});

describe('rewriteFences', () => {
  it('replaces the body of a matching fence', () => {
    const text = 'x\n```linker\nold\n```\ny';
    const out = md.rewriteFences(text, 'linker', () => ['new']);
    assert.strictEqual(out.count, 1);
    assert.ok(out.text.includes('new'));
    assert.ok(!out.text.includes('old'));
  });

  it('ignores fences with a different info string', () => {
    const text = '```js\nold\n```';
    const out = md.rewriteFences(text, 'linker', () => ['new']);
    assert.strictEqual(out.count, 0);
    assert.strictEqual(out.text, text);
  });

  it('leaves the body untouched when the callback declines', () => {
    const text = '```linker\nold\n```';
    assert.strictEqual(md.rewriteFences(text, 'linker', () => null).text, text);
  });
});
