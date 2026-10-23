import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCurrentLanguage,
  getLanguage,
  getLanguageOptions,
  setLanguage,
  translate,
} from '../src/i18n.js';

const storedValues = new Map();
globalThis.localStorage = {
  getItem: (key) => storedValues.get(key) ?? null,
  setItem: (key, value) => storedValues.set(key, value),
};

test('provides all requested locales with flag labels', () => {
  assert.deepEqual(
    getLanguageOptions().map(({ code, name }) => [code, name]),
    [
      ['fr', 'Français'],
      ['en', 'English'],
      ['de', 'Deutsch'],
      ['es', 'Español'],
      ['it', 'Italiano'],
      ['zh', '中文'],
    ],
  );
});

test('translates game copy and interpolates values for each locale', () => {
  for (const language of ['fr', 'en', 'de', 'es', 'it', 'zh']) {
    setLanguage(language);
    assert.ok(translate('queensInstructions').length > 0);
    assert.notEqual(translate('patchesDescription'), 'patchesDescription');
    assert.ok(translate('zipGridLabel', { size: 6 }).includes('6'));
    assert.equal(translate('tangoProgress', { filled: 2, total: 36 }).includes('2'), true);
  }
});

test('persists the selected language and rejects unsupported values', () => {
  setLanguage('de');
  assert.equal(getCurrentLanguage(), 'de');
  assert.equal(getLanguage(), 'de');
  assert.throws(() => setLanguage('xx'), RangeError);
  setLanguage('fr');
});
