'use strict';

// Spanish morphology for Glossary Linker.
//
// stem() is a JavaScript port of Apache Lucene's SpanishLightStemmer
// (org.apache.lucene.analysis.es), implementing the UniNE light-stemming
// algorithm by J. Savoy. Original code is licensed under the Apache License 2.0
// (free for commercial and non-commercial use); ported to JS and adapted to this
// plugin's language-module interface.
//   https://www.apache.org/licenses/LICENSE-2.0
//   https://github.com/apache/lucene/blob/main/lucene/analysis/common/src/java/org/apache/lucene/analysis/es/SpanishLightStemmer.java
// strip()/lemma() are this plugin's own light helpers.

function fold(word) {
  return word.toLowerCase()
    .replace(/[àáâä]/g, 'a').replace(/[òóôö]/g, 'o')
    .replace(/[èéêë]/g, 'e').replace(/[ùúûü]/g, 'u').replace(/[ìíîï]/g, 'i');
}

// UniNE Spanish light stemmer.
function stem(word) {
  const s = fold(word);
  const len = s.length;
  if (len < 5) return s;
  const last = s[len - 1];
  if (last === 'o' || last === 'a' || last === 'e') return s.slice(0, len - 1);
  if (last === 's') {
    if (s[len - 2] === 'e' && s[len - 3] === 's' && s[len - 4] === 'e') return s.slice(0, len - 2);
    if (s[len - 2] === 'e' && s[len - 3] === 'c') return s.slice(0, len - 3) + 'z';
    if (s[len - 2] === 'o' || s[len - 2] === 'a' || s[len - 2] === 'e') return s.slice(0, len - 2);
  }
  return s;
}

// Light plural strip (endingStrip mode).
function strip(word) {
  const s = fold(word);
  if (s.length > 4 && s.endsWith('ces')) return s.slice(0, -3) + 'z';
  if (s.length > 3 && s.endsWith('es')) return s.slice(0, -2);
  if (s.length > 3 && s.endsWith('s')) return s.slice(0, -1);
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
  id: 'es',
  name: 'Spanish',
  priority: 0,
  match: (word) => /[a-záéíóúüñ]/i.test(word),
  keys(word, mode) {
    const w = word.toLowerCase();
    if (mode === 'exact') return [w];
    if (mode === 'endingStrip') return [strip(w)];
    return stemKeys(w);
  },
  lemma,
};
