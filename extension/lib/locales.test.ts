// Every language must have the same messages with the same placeholders.
// A text added in one language only, or a placeholder lost in translation,
// fails here instead of showing up as an empty line in the popup.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

interface Message {
  message: string;
  placeholders?: Record<string, { content: string }>;
}

const dir = new URL('../public/_locales/', import.meta.url);
const langs = readdirSync(dir);
const load = (lang: string) =>
  JSON.parse(readFileSync(new URL(`${lang}/messages.json`, dir), 'utf8')) as Record<string, Message>;

test('there are at least the two expected languages', () => {
  assert.ok(langs.includes('it') && langs.includes('en'), `found: ${langs.join(', ')}`);
});

test('all languages have exactly the same keys', () => {
  const reference = Object.keys(load('en')).sort();
  for (const lang of langs) assert.deepEqual(Object.keys(load(lang)).sort(), reference, lang);
});

test('the same message has the same placeholders in every language', () => {
  const en = load('en');
  for (const lang of langs) {
    const other = load(lang);
    for (const key of Object.keys(en)) {
      const names = (m?: Message) => Object.keys(m?.placeholders ?? {}).sort();
      assert.deepEqual(names(other[key]), names(en[key]), `${lang}: ${key}`);
    }
  }
});

test('every $NAME$ used in a message is declared as a placeholder', () => {
  for (const lang of langs) {
    for (const [key, m] of Object.entries(load(lang))) {
      const used = [...m.message.matchAll(/\$([A-Za-z_]+)\$/g)].map((x) => x[1]!.toLowerCase());
      for (const name of used) assert.ok(m.placeholders?.[name], `${lang}: ${key} uses $${name}$`);
    }
  }
});

test('plural messages come in pairs', () => {
  const keys = Object.keys(load('en'));
  for (const k of keys.filter((k) => k.endsWith('_one'))) {
    assert.ok(keys.includes(k.replace(/_one$/, '_other')), `${k} has no _other`);
  }
});
