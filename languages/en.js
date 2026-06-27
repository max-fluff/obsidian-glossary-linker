'use strict';

// English morphology for Glossary Linker.
//
// stem() implements the Porter stemming algorithm (M. F. Porter, 1980), released
// by the author for free use (commercial and non-commercial):
//   https://tartarus.org/martin/PorterStemmer/
//   https://snowballstem.org/algorithms/porter/stemmer.html
// strip()/lemma() are this plugin's own light helpers.

const STEP2 = { ational: 'ate', tional: 'tion', enci: 'ence', anci: 'ance', izer: 'ize', bli: 'ble', alli: 'al', entli: 'ent', eli: 'e', ousli: 'ous', ization: 'ize', ation: 'ate', ator: 'ate', alism: 'al', iveness: 'ive', fulness: 'ful', ousness: 'ous', aliti: 'al', iviti: 'ive', biliti: 'ble', logi: 'log' };
const STEP3 = { icate: 'ic', ative: '', alize: 'al', iciti: 'ic', ical: 'ic', ful: '', ness: '' };
const C = '[^aeiou]', V = '[aeiouy]', CC = C + '[^aeiouy]*', VV = V + '[aeiou]*';
const MGR0 = new RegExp('^(' + CC + ')?' + VV + CC);
const MEQ1 = new RegExp('^(' + CC + ')?' + VV + CC + '(' + VV + ')?$');
const MGR1 = new RegExp('^(' + CC + ')?' + VV + CC + VV + CC);
const S_V = new RegExp('^(' + CC + ')?' + V);

// Aggressive root (stemmer mode).
function stem(word) {
  let w = word.toLowerCase();
  if (w.length < 3) return w;
  let st, suffix, fp, re, re2, re3, re4;
  const firstch = w.substr(0, 1);
  if (firstch === 'y') w = firstch.toUpperCase() + w.substr(1);

  re = /^(.+?)(ss|i)es$/; re2 = /^(.+?)([^s])s$/;
  if (re.test(w)) w = w.replace(re, '$1$2'); else if (re2.test(w)) w = w.replace(re2, '$1$2');

  re = /^(.+?)eed$/; re2 = /^(.+?)(ed|ing)$/;
  if (re.test(w)) { fp = re.exec(w); if (MGR0.test(fp[1])) w = w.replace(/.$/, ''); }
  else if (re2.test(w)) {
    fp = re2.exec(w); st = fp[1];
    if (S_V.test(st)) {
      w = st;
      re2 = /(at|bl|iz)$/; re3 = /([^aeiouylsz])\1$/; re4 = new RegExp('^' + CC + V + '[^aeiouwxy]$');
      if (re2.test(w)) w = w + 'e'; else if (re3.test(w)) w = w.replace(/.$/, ''); else if (re4.test(w)) w = w + 'e';
    }
  }

  re = /^(.+?)y$/;
  if (re.test(w)) { fp = re.exec(w); st = fp[1]; if (S_V.test(st)) w = st + 'i'; }

  re = /^(.+?)(ational|tional|enci|anci|izer|bli|alli|entli|eli|ousli|ization|ation|ator|alism|iveness|fulness|ousness|aliti|iviti|biliti|logi)$/;
  if (re.test(w)) { fp = re.exec(w); st = fp[1]; suffix = fp[2]; if (MGR0.test(st)) w = st + STEP2[suffix]; }

  re = /^(.+?)(icate|ative|alize|iciti|ical|ful|ness)$/;
  if (re.test(w)) { fp = re.exec(w); st = fp[1]; suffix = fp[2]; if (MGR0.test(st)) w = st + STEP3[suffix]; }

  re = /^(.+?)(al|ance|ence|er|ic|able|ible|ant|ement|ment|ent|ou|ism|ate|iti|ous|ive|ize)$/; re2 = /^(.+?)(s|t)(ion)$/;
  if (re.test(w)) { fp = re.exec(w); st = fp[1]; if (MGR1.test(st)) w = st; }
  else if (re2.test(w)) { fp = re2.exec(w); st = fp[1] + fp[2]; if (MGR1.test(st)) w = st; }

  re = /^(.+?)e$/;
  if (re.test(w)) { fp = re.exec(w); st = fp[1]; re3 = new RegExp('^' + CC + V + '[^aeiouwxy]$'); if (MGR1.test(st) || (MEQ1.test(st) && !re3.test(st))) w = st; }

  if (/ll$/.test(w) && MGR1.test(w)) w = w.replace(/.$/, '');

  if (firstch === 'y') w = firstch.toLowerCase() + w.substr(1);
  return w;
}

// Light plural strip (endingStrip mode).
function strip(word) {
  const w = word.toLowerCase();
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 3 && w.endsWith('es')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

// Comparison keys for stemmer mode.
function stemKeys(word) {
  return [stem(word)];
}

// Base (dictionary) form for collected aliases.
function lemma(word) {
  return stem(word.toLowerCase());
}

module.exports = {
  id: 'en',
  name: 'English',
  priority: 0,
  match: (word) => /[A-Za-z]/.test(word),
  keys(word, mode) {
    const w = word.toLowerCase();
    if (mode === 'exact') return [w];
    if (mode === 'endingStrip') return [strip(w)];
    return stemKeys(w);
  },
  lemma,
};
