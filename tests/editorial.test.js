import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Guard shared public UI and reference text against reverting to informal
// imperatives or conflating scale-degree labels with chord symbols.
const sources=[
 'site/access.js','site/api.js','site/app.js','site/auth-client.js',
 'site/chord-guide.js','site/chord-types.js','site/index.html',
 'site/mode-types.js','site/modes.js','site/music.js','site/oauth-session.js'
];
const romanDegree=/(?<![\\p{L}])(?:VII|VI|III|IV|II|I|V)\\s+(?:ступен[а-яё]*|лад[а-яё]*|модальный вариант)(?![\\p{L}])/iu;
const informal=/(?<![\\p{L}])(?:ты|тебя|тебе|твой|твоя|твоё|сыграй|сравни|попробуй|послушай|найди|проверь|нажми|открой|добавь|выбери|держи|ориентируйся|задержись|сопоставь|замени|понизь|подменяй)(?![\\p{L}])/iu;
test('text uses Arabic degree numbers and Roman chord functions only',()=>{
 for(const path of sources){
  const s=readFileSync(path,'utf8');
  assert.doesNotMatch(s,romanDegree,path);
  assert.doesNotMatch(s,informal,path);
 }
});
test('secondary dominant is not a slash-bass inversion and modes remain labeled',()=>{
 const chord=readFileSync('site/chord-guide.js','utf8');
 const modes=readFileSync('site/mode-types.js','utf8');
 assert.match(chord,/V7\\/ii/);
 assert.match(chord,/2-й ступени/);
 assert.match(modes,/Фригийский доминантовый/);
 assert.match(modes,/7-й лад мелодического минора/);
});
