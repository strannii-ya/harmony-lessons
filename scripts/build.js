import './prepare-engraving.js';
import { cp, mkdir, rm, readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { relative, join } from 'node:path';
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
await cp('site','dist',{recursive:true});
const config=JSON.parse(await readFile('dist/config.json','utf8'));
if(config.publishableKey&&!config.publishableKey.startsWith('sb_publishable_'))throw new Error('Only a Supabase publishable key is allowed.');
if(config.supabaseUrl&&!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.supabaseUrl))throw new Error('Invalid Supabase project URL.');
const entries=await readdir('dist',{withFileTypes:true,recursive:true});
const names=entries.filter(e=>e.isFile()).map(e=>relative('dist',join(e.parentPath||e.path,e.name))).sort();
const hash=createHash('sha256');
for(const name of names)hash.update(name).update(await readFile('dist/'+name));
const version=hash.digest('hex').slice(0,16);
for(const name of names){
 if(name.startsWith('vendor/')||!/\.(js|html)$/.test(name))continue;
 let source=await readFile('dist/'+name,'utf8');
 if(name.endsWith('.js'))source=source.replace(/(['"])(\.\/[a-zA-Z0-9_./-]+\.js)\1/g,(_,quote,path)=>quote+path+'?v='+version+quote);
 else source=source.replace(/(src|href)="(\.\/[a-zA-Z0-9_./-]+\.(?:js|css|svg))"/g,(_,attr,path)=>attr+'="'+path+'?v='+version+'"');
 await writeFile('dist/'+name,source);
}
await writeFile('dist/version.json',JSON.stringify({version,commit:process.env.GITHUB_SHA||null,release:'2026-10-18-vexflow-bravura'})+'\n');
console.log('Built interface '+version+'. Private course content is supplied after authentication.');
