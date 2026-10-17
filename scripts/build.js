import { cp, mkdir, rm, readFile } from 'node:fs/promises';
await rm('dist', {recursive:true, force:true});
await mkdir('dist', {recursive:true});
// Publish ONLY the interface. Private lesson exports never enter this directory.
await cp('site', 'dist', {recursive:true});
const config=JSON.parse(await readFile('dist/config.json','utf8'));
if(config.publishableKey && !config.publishableKey.startsWith('sb_publishable_')) throw new Error('Only a Supabase publishable key is allowed.');
if(config.supabaseUrl && !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.supabaseUrl)) throw new Error('Invalid Supabase project URL.');
console.log('Built public interface only. Private course content is supplied after authentication.');
