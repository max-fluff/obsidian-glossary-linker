'use strict';

// Interface localization. Visible strings live in src/locales/<lang>.js keyed by a
// stable id; missing keys fall back to English, so a partial locale still works.
// Language follows Obsidian's interface language (same source the morphology uses),
// read once at init — Obsidian reloads on a language change anyway.
const LOCALES = {
  en: require('./locales/en'),
  ru: require('./locales/ru'),
  de: require('./locales/de'),
  es: require('./locales/es'),
  fr: require('./locales/fr'),
  uk: require('./locales/uk'),
};

let dict = LOCALES.en;
let pluralRules = new Intl.PluralRules('en');

function initI18n() {
  const sys = (window.localStorage.getItem('language') || '').split('-')[0].toLowerCase();
  const locale = LOCALES[sys] ? sys : 'en';
  dict = LOCALES[locale];
  try { pluralRules = new Intl.PluralRules(locale); } catch (e) { pluralRules = new Intl.PluralRules('en'); }
}

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

function t(key, vars) {
  let entry = dict[key];
  if (entry === undefined) entry = LOCALES.en[key];
  if (entry === undefined) return key;
  return interpolate(entry, vars);
}

// Localized "N noun" phrase. plural.<noun> holds per-category forms
// ({ one, few, many, other } — a subset is fine, missing ones fall back to other).
// pluralRules may not match the dict's locale on platforms with limited Intl data
// (e.g. mobile), so never assume the selected category exists.
function plural(noun, n) {
  const forms = dict['plural.' + noun] || LOCALES.en['plural.' + noun];
  if (!forms) return n + ' ' + noun;
  let cat;
  try { cat = pluralRules.select(n); } catch (e) { cat = 'other'; }
  const tpl = forms[cat] != null ? forms[cat] : (forms.other != null ? forms.other : Object.values(forms)[0]);
  return interpolate(tpl, { n });
}

module.exports = { initI18n, t, plural };
