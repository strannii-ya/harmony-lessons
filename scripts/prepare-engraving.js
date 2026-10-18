import { mkdir, copyFile, readFile } from 'node:fs/promises';
const version=JSON.parse(await readFile('node_modules/vexflow/package.json','utf8')).version;
if(version!=='4.2.5')throw new Error('Unexpected engraving dependency version');
await mkdir('site/vendor',{recursive:true});
// Bravura vector outlines are included in this build: no remote fonts or scripts.
await copyFile('node_modules/vexflow/build/cjs/vexflow-bravura.js','site/vendor/vexflow-bravura.js');
await copyFile('node_modules/vexflow/LICENSE','site/vendor/VEXFLOW-LICENSE.txt');
console.log('Prepared VexFlow '+version+' / Bravura vector engraving');
