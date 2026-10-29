// Plurals for the extension's messages.
// The browser's i18n system (_locales/<lang>/messages.json) has no plural support,
// so a message that depends on a number has two keys, <base>_one and <base>_other,
// and this function picks the right one with the language's own plural rules.
// Italian and English both use "one" for 1 and "other" for everything else, 0 included
// ("0 siti", "0 sites"); Intl.PluralRules makes adding other languages safe.

export function pluralKey(base: string, n: number, locale: string): string {
  let category: Intl.LDMLPluralRule;
  try {
    category = new Intl.PluralRules(locale).select(n);
  } catch {
    category = new Intl.PluralRules('en').select(n); // unknown locale tag
  }
  return `${base}_${category === 'one' ? 'one' : 'other'}`;
}
