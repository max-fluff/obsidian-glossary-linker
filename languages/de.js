'use strict';

// German morphology for Glossary Linker.
//
// stem() is a JavaScript port of Apache Lucene's GermanLightStemmer
// (org.apache.lucene.analysis.de), implementing the UniNE light-stemming
// algorithm by J. Savoy (preceded here by ß→ss normalization). Original code is
// licensed under the Apache License 2.0 (free for commercial and non-commercial
// use); ported to JS and adapted to this plugin's language-module interface.
//   https://www.apache.org/licenses/LICENSE-2.0
//   https://github.com/apache/lucene/blob/main/lucene/analysis/common/src/java/org/apache/lucene/analysis/de/GermanLightStemmer.java
// strip()/lemma() are this plugin's own light helpers.

function fold(word) {
  return word.toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[äàáâ]/g, 'a').replace(/[öòóô]/g, 'o')
    .replace(/[ïìíî]/g, 'i').replace(/[üùúû]/g, 'u');
}

function stEnding(ch) {
  return ch === 'b' || ch === 'd' || ch === 'f' || ch === 'g' || ch === 'h'
    || ch === 'k' || ch === 'l' || ch === 'm' || ch === 'n' || ch === 't';
}

function step1(s, len) {
  if (len > 5 && s[len - 3] === 'e' && s[len - 2] === 'r' && s[len - 1] === 'n') return len - 3;
  if (len > 4 && s[len - 2] === 'e') {
    const c = s[len - 1];
    if (c === 'm' || c === 'n' || c === 'r' || c === 's') return len - 2;
  }
  if (len > 3 && s[len - 1] === 'e') return len - 1;
  if (len > 3 && s[len - 1] === 's' && stEnding(s[len - 2])) return len - 1;
  return len;
}

function step2(s, len) {
  if (len > 5 && s[len - 3] === 'e' && s[len - 2] === 's' && s[len - 1] === 't') return len - 3;
  if (len > 4 && s[len - 2] === 'e' && (s[len - 1] === 'r' || s[len - 1] === 'n')) return len - 2;
  if (len > 4 && s[len - 2] === 's' && s[len - 1] === 't' && stEnding(s[len - 3])) return len - 2;
  return len;
}

// UniNE German light stemmer.
function stem(word) {
  const s = fold(word);
  let len = s.length;
  len = step1(s, len);
  len = step2(s, len);
  return s.slice(0, len);
}

// Light plural/case strip (endingStrip mode).
function strip(word) {
  const s = fold(word);
  for (const e of ['en', 'er', 'es', 'e', 'n', 's']) {
    if (s.length - e.length >= 3 && s.endsWith(e)) return s.slice(0, -e.length);
  }
  return s;
}

// Comparison keys for stemmer mode.
function stemKeys(word) {
  const a = stem(word);
  const b = strip(word);
  return a === b ? [a] : [a, b];
}

// Base form for collected aliases.
function lemma(word) {
  return strip(word);
}

module.exports = {
  id: 'de',
  name: 'German',
  priority: 0,
  match: (word) => /[a-zäöüß]/i.test(word),
  keys(word, mode) {
    const w = word.toLowerCase();
    if (mode === 'exact') return [w];
    if (mode === 'endingStrip') return [strip(w)];
    return stemKeys(w);
  },
  lemma,
};
