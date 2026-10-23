import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// The lesson text itself lives in a private database. This audit covers
// the public interface and the public chord/mode dictionaries.
const sources = readdirSync('site')
  .filter(name => name.endsWith('.js') || name.endsWith('.html'))
  .map(name => `site/${name}`);
const romanDegree = /(?<![\p{L}])(?:VII|VI|III|IV|II|I|V)\s+(?:ступен[а-яё]*|лад[а-яё]*|модальный вариант)(?![\p{L}])/iu;
const informal = /(?<![\p{L}])(?:ты|тебя|тебе|тобой|твой|твоя|твоё|твои|твоего|твоему|твоей|сыграй|сравни|попробуй|послушай|найди|проверь|нажми|открой|добавь|выбери|держи|ориентируйся|задержись|сопоставь|замени|понизь|подменяй|путай|смотри|запомни|начни|заметь|представь|разберись|подбирай|пересчитай|определяй|превращай|смешивай|сохраняй|введи|веди|выдержи|своди|удели|вводи|войди|запроси|обнови|отправь|отправляй|подтверди|разреши|добавляй|заменяй|обратись|отключи|скопируй|[\p{L}]{3,}(?:ешь|ишь|ёшь)(?:ся)?)(?![\p{L}])/iu;

test('academic numbering and formal address in all public reader-facing sources', () => {
  for (const path of sources) {
    const s = readFileSync(path, 'utf8');
    assert.doesNotMatch(s, romanDegree, path);
    assert.doesNotMatch(s, informal, path);
  }
});

test('synthetic lesson texts follow the same formal address convention', () => {
  const smokeTests = readdirSync('tests').filter(name => name.endsWith('_smoke.py'));
  for (const name of smokeTests) {
    assert.doesNotMatch(readFileSync(`tests/${name}`, 'utf8'), informal, name);
  }
});

test('secondary dominants keep chord analysis and modes use Arabic ordinals', () => {
  const chord = readFileSync('site/chord-guide.js', 'utf8');
  const modes = readFileSync('site/mode-types.js', 'utf8');
  assert.match(chord, /V7\/ii/);
  assert.match(chord, /2-й ступени/);
  assert.match(modes, /Фригийский доминантовый/);
  assert.match(modes, /7-й лад мелодического минора/);
});
