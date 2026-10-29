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

// A message no code uses is dead text that translators would keep maintaining.
// A key counts as used when the code names it, or names its plural base (key_one,
// key_other), or builds it from a known prefix (group_, verdictHeading_).
test('every message is used by the code', async () => {
  const { readdirSync: list, statSync } = await import('node:fs');
  // Only the folders that hold the extension's code: anything else in the project
  // (a stray virtual environment, build output) is none of this test's business.
  const sources: string[] = [];
  const walk = (dir: URL) => {
    for (const name of list(dir)) {
      const child = new URL(name, dir);
      if (statSync(child).isDirectory()) {
        if (name !== 'fixtures') walk(new URL(`${name}/`, dir));
      } else if (/\.ts$/.test(name) && !name.endsWith('.test.ts')) {
        sources.push(readFileSync(child, 'utf8'));
      }
    }
  };
  for (const folder of ['../entrypoints/', '../lib/']) walk(new URL(folder, import.meta.url));
  const code = sources.join('\n');
  const dynamicPrefixes = ['group_', 'groupExplain_', 'verdictHeading_', 'extName', 'extDescription'];
  const unused = Object.keys(load('en')).filter((key) => {
    const base = key.replace(/_(one|other)$/, '');
    return !code.includes(`'${key}'`) && !code.includes(`'${base}'`)
      && !dynamicPrefixes.some((p) => key.startsWith(p));
  });
  assert.deepEqual(unused, []);
});

// A checklist item followed by names ("…: Criteo, Nielsen") must end with a colon,
// otherwise the names end up glued after a full stop.
test('messages followed by a list of names end with a colon', () => {
  const verdict = readFileSync(new URL('./verdict.ts', import.meta.url), 'utf8').replace(/\s+/g, ' ');
  const named = new Set([...verdict.matchAll(/key: '(\w+)',[^}]*names:/g)].map((m) => m[1]!));
  assert.ok(named.size > 0);
  for (const lang of langs) {
    for (const [key, m] of Object.entries(load(lang))) {
      if (named.has(key.replace(/_(one|other)$/, ''))) assert.ok(m.message.endsWith(':'), `${lang}: ${key}`);
    }
  }
});
