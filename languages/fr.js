'use strict';

// French morphology for Glossary Linker.
//
// stem()/norm() are a JavaScript port of Apache Lucene's FrenchLightStemmer
// (org.apache.lucene.analysis.fr), implementing the UniNE light-stemming
// algorithm by J. Savoy. Original code is licensed under the Apache License 2.0
// (free for commercial and non-commercial use); ported to JS and adapted to this
// plugin's language-module interface.
//   https://www.apache.org/licenses/LICENSE-2.0
//   https://github.com/apache/lucene/blob/main/lucene/analysis/common/src/java/org/apache/lucene/analysis/fr/FrenchLightStemmer.java
// strip()/lemma() are this plugin's own light helpers.

function endsWith(s, len, suffix) {
  const sl = suffix.length;
  if (sl > len) return false;
  for (let i = 0; i < sl; i++) if (s[len - sl + i] !== suffix[i]) return false;
  return true;
}

function deleteAt(s, pos, len) {
  for (let i = pos; i < len - 1; i++) s[i] = s[i + 1];
  return len - 1;
}

function norm(s, len) {
  if (len > 4) {
    for (let i = 0; i < len; i++) {
      switch (s[i]) {
        case 'à': case 'á': case 'â': s[i] = 'a'; break;
        case 'ô': s[i] = 'o'; break;
        case 'è': case 'é': case 'ê': s[i] = 'e'; break;
        case 'ù': case 'û': s[i] = 'u'; break;
        case 'î': s[i] = 'i'; break;
        case 'ç': s[i] = 'c'; break;
      }
    }
    let ch = s[0];
    for (let i = 1; i < len; i++) {
      if (s[i] === ch && /[a-z]/.test(ch)) len = deleteAt(s, i--, len);
      else ch = s[i];
    }
  }
  if (len > 4 && endsWith(s, len, 'ie')) len -= 2;
  if (len > 4) {
    if (s[len - 1] === 'r') len--;
    if (s[len - 1] === 'e') len--;
    if (s[len - 1] === 'e') len--;
    if (s[len - 1] === s[len - 2] && /[a-z]/.test(s[len - 1])) len--;
  }
  return len;
}

// UniNE French light stemmer (operates on a char array, returns the new length).
function stemArr(s, len) {
  if (len > 5 && s[len - 1] === 'x') {
    if (s[len - 3] === 'a' && s[len - 2] === 'u' && s[len - 4] !== 'e') s[len - 2] = 'l';
    len--;
  }
  if (len > 3 && s[len - 1] === 'x') len--;
  if (len > 3 && s[len - 1] === 's') len--;
  if (len > 9 && endsWith(s, len, 'issement')) { len -= 6; s[len - 1] = 'r'; return norm(s, len); }
  if (len > 8 && endsWith(s, len, 'issant')) { len -= 4; s[len - 1] = 'r'; return norm(s, len); }
  if (len > 6 && endsWith(s, len, 'ement')) {
    len -= 4;
    if (len > 3 && endsWith(s, len, 'ive')) { len--; s[len - 1] = 'f'; }
    return norm(s, len);
  }
  if (len > 11 && endsWith(s, len, 'ficatrice')) { len -= 5; s[len - 2] = 'e'; s[len - 1] = 'r'; return norm(s, len); }
  if (len > 10 && endsWith(s, len, 'ficateur')) { len -= 4; s[len - 2] = 'e'; s[len - 1] = 'r'; return norm(s, len); }
  if (len > 9 && endsWith(s, len, 'catrice')) { len -= 3; s[len - 4] = 'q'; s[len - 3] = 'u'; s[len - 2] = 'e'; return norm(s, len); }
  if (len > 8 && endsWith(s, len, 'cateur')) { len -= 2; s[len - 4] = 'q'; s[len - 3] = 'u'; s[len - 2] = 'e'; s[len - 1] = 'r'; return norm(s, len); }
  if (len > 8 && endsWith(s, len, 'atrice')) { len -= 4; s[len - 2] = 'e'; s[len - 1] = 'r'; return norm(s, len); }
  if (len > 7 && endsWith(s, len, 'ateur')) { len -= 3; s[len - 2] = 'e'; s[len - 1] = 'r'; return norm(s, len); }
  if (len > 6 && endsWith(s, len, 'trice')) { len--; s[len - 3] = 'e'; s[len - 2] = 'u'; s[len - 1] = 'r'; }
  if (len > 5 && endsWith(s, len, 'ième')) return norm(s, len - 4);
  if (len > 7 && endsWith(s, len, 'teuse')) { len -= 2; s[len - 1] = 'r'; return norm(s, len); }
  if (len > 6 && endsWith(s, len, 'teur')) { len--; s[len - 1] = 'r'; return norm(s, len); }
  if (len > 5 && endsWith(s, len, 'euse')) return norm(s, len - 2);
  if (len > 8 && endsWith(s, len, 'ère')) { len--; s[len - 2] = 'e'; return norm(s, len); }
  if (len > 7 && endsWith(s, len, 'ive')) { len--; s[len - 1] = 'f'; return norm(s, len); }
  if (len > 4 && (endsWith(s, len, 'folle') || endsWith(s, len, 'molle'))) { len -= 2; s[len - 1] = 'u'; return norm(s, len); }
  if (len > 9 && endsWith(s, len, 'nnelle')) return norm(s, len - 5);
  if (len > 9 && endsWith(s, len, 'nnel')) return norm(s, len - 3);
  if (len > 4 && endsWith(s, len, 'ète')) { len--; s[len - 2] = 'e'; }
  if (len > 8 && endsWith(s, len, 'ique')) len -= 4;
  if (len > 8 && endsWith(s, len, 'esse')) return norm(s, len - 3);
  if (len > 7 && endsWith(s, len, 'inage')) return norm(s, len - 3);
  if (len > 9 && endsWith(s, len, 'isation')) {
    len -= 7;
    if (len > 5 && endsWith(s, len, 'ual')) s[len - 2] = 'e';
    return norm(s, len);
  }
  if (len > 9 && endsWith(s, len, 'isateur')) return norm(s, len - 7);
  if (len > 8 && endsWith(s, len, 'ation')) return norm(s, len - 5);
  if (len > 8 && endsWith(s, len, 'ition')) return norm(s, len - 5);
  return norm(s, len);
}

function stem(word) {
  const arr = word.toLowerCase().split('');
  const len = stemArr(arr, arr.length);
  return arr.slice(0, len).join('');
}

function fold(word) {
  return word.toLowerCase()
    .replace(/[àâä]/g, 'a').replace(/[ôö]/g, 'o').replace(/[èéêë]/g, 'e')
    .replace(/[ùûü]/g, 'u').replace(/[îï]/g, 'i').replace(/ç/g, 'c').replace(/ÿ/g, 'y');
}

// Light plural strip (endingStrip mode).
function strip(word) {
  const s = fold(word);
  if (s.length > 3 && (s.endsWith('s') || s.endsWith('x'))) return s.slice(0, -1);
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
  id: 'fr',
  name: 'French',
  priority: 0,
  match: (word) => /[a-zàâäçéèêëîïôöùûüÿ]/i.test(word),
  keys(word, mode) {
    const w = word.toLowerCase();
    if (mode === 'exact') return [w];
    if (mode === 'endingStrip') return [strip(w)];
    return stemKeys(w);
  },
  lemma,
};
