import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LibraryAPI} from '../site/api.js';
const config={supabaseUrl:'https://storage-fixture.supabase.co',publishableKey:'sb_publishable_fixture'};
class Store {constructor(){this.data=new Map();}getItem(k){return this.data.get(k)||null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}}
const pair={access_token:'synthetic',refresh_token:'synthetic-r',expires_at:1};
test('temporary login still works when the browser blocks persistent storage',()=>{
 globalThis.localStorage={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');},removeItem(){throw new Error('blocked');}};
 globalThis.sessionStorage=new Store();const api=new LibraryAPI(config);api.setRemember(false);api.store(pair);
 assert.equal(api.remembers,false);assert.deepEqual(api.saved().access_token,'synthetic');
});
test('corrupt storage during refresh fails as a logout, not an uncaught type error',async()=>{
 globalThis.localStorage=new Store();globalThis.sessionStorage=new Store();const api=new LibraryAPI(config);api.store(pair);
 sessionStorage.setItem(api.sessionKey,'{broken');await assert.rejects(api.ensureSession(),e=>e.authExpired===true);
 assert.equal(api.session,null);
});
test('email submission explicitly honours persistence before its verification handler',()=>{
 const source=readFileSync('site/google.js','utf8');
 assert.match(source,/#code-form/);assert.match(source,/capture:true/);assert.match(source,/setRemember\(remember.checked\)/);
});
