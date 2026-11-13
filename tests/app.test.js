const test = require('node:test');
const assert = require('node:assert/strict');
const { translations, STORAGE_KEY } = require('../app.js');

test('all five initial locales include core screens', () => {
  for (const locale of ['en', 'ru', 'de', 'fr', 'es']) {
    assert.ok(translations[locale].headline, `${locale} headline`);
    assert.ok(translations[locale].thinkTitle, `${locale} Think First title`);
    assert.ok(translations[locale].privacyTitle, `${locale} privacy title`);
  }
});

test('storage key is versioned', () => {
  assert.equal(STORAGE_KEY, 'independence.reflections.v1');
});

test('translations provide the save and deletion safeguards', () => {
  for (const locale of Object.keys(translations)) {
    assert.ok(translations[locale].saved);
    assert.ok(translations[locale].confirmDelete);
    assert.ok(translations[locale].required);
  }
});
