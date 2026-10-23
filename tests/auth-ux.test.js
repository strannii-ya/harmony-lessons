import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LibraryAPI} from '../site/api.js';
import {isTransientAuthError} from '../site/oauth-session.js';
const CONFIG={supabaseUrl:'https://synthetic.supabase.co',publishableKey:'sb_publishable_test'};
const BASE='https://example.test/harmony-lessons/';
class Storage{constructor(){this.data=new Map();}getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}}
function at(url){const u=new URL(url,BASE);globalThis.location={href:u.href,origin:u.origin,pathname:u.pathname,search:u.search,hash:u.hash};}
const pair=(s='old',expires_at=Date.now()/1000+3600)=>({access_token:s,refresh_token:s+'-refresh',expires_at});
const json=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{'Content-Type':'application/json'}});
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function logged(expires){const api=new LibraryAPI(CONFIG);api.setRemember(true);api.store(pair('old',expires));return api;}
beforeEach(()=>{globalThis.sessionStorage=new Storage();globalThis.localStorage=new Storage();at(BASE);globalThis.history={replaceState(_a,_b,url){at(url);}};globalThis.fetch=async()=>{throw new Error('Unexpected network');};});
test('a rejected access token rotates once and retries without deleting the remembered login',async()=>{
 const api=logged();let refresh=0,requests=0;
 globalThis.fetch=async(url,o)=>{
  if(url.includes('grant_type=refresh_token')){refresh++;assert.equal(JSON.parse(o.body).refresh_token,'old-refresh');return json({...pair('new'),provider_token:'never-store'});}
  requests++;return o.headers.Authorization==='Bearer old'?json({code:'bad_jwt'},401):json([{ok:true}]);
 };
 assert.deepEqual(await api.request('/rest/v1/progress',{auth:true}),[{ok:true}]);
 assert.equal(refresh,1);assert.equal(requests,2);assert.equal(api.session.access_token,'new');assert(!localStorage.getItem(api.sessionKey).includes('never-store'));
});
test('concurrent old 401 responses share a refresh and do not rotate the new token again',async()=>{
 const api=logged();let refresh=0;const held=defer();
 globalThis.fetch=async(url,o)=>{
  if(url.includes('grant_type=refresh_token')){refresh++;await held.promise;return json(pair('new'));}
  if(o.headers.Authorization==='Bearer old'){if(url.endsWith('/late'))await held.promise;return json({},401);}
  return json([]);
 };
 const promises=['a','b','late'].map(p=>api.request('/rest/v1/'+p,{auth:true}));
 await new Promise(r=>setTimeout(r,10));held.resolve();await Promise.all(promises);assert.equal(refresh,1);
});
test('network errors, rate limits, server errors and malformed replies preserve credentials',async()=>{
 for(const status of [0,408,429,500,502,503]){
  const api=logged(),saved=localStorage.getItem(api.sessionKey);
  globalThis.fetch=async()=>{if(status===0)throw new Error('offline');return json({},status);};
  await assert.rejects(api.restore(),isTransientAuthError);assert.equal(localStorage.getItem(api.sessionKey),saved);
 }
 const api=logged();globalThis.fetch=async()=>new Response('<html>temporary proxy</html>',{status:200});
 await assert.rejects(api.restore(),e=>e.status===502);assert(api.saved());
});
test('invalid refresh is terminal; a revoked membership is never treated as a successful login',async()=>{
 const api=logged(1);let calls=0;globalThis.fetch=async()=>{calls++;return json({code:'refresh_token_not_found'},400);};
 await assert.rejects(api.ensureSession(),e=>e.authExpired);assert.equal(api.saved(),null);assert.equal(calls,1);
 const denied=logged();globalThis.fetch=async url=>url.includes('/user')?json({id:'u',email_confirmed_at:'2026-01-01'}):json([]);
 await assert.rejects(denied.restore(),e=>e.status===403);assert.equal(denied.saved(),null);
});
test('a second 401 stops retrying instead of looping',async()=>{
 const api=logged();let refresh=0;
 globalThis.fetch=async url=>{if(url.includes('grant_type')){refresh++;return json(pair('new'));}return json({},401);};
 await assert.rejects(api.request('/rest/v1/progress',{auth:true}),e=>e.authExpired);assert.equal(refresh,1);assert.equal(api.saved(),null);
});
test('logout during a refresh cannot resurrect a stored session',async()=>{
 const api=logged(1),held=defer();globalThis.fetch=async()=>{await held.promise;return json(pair('late'));};
 const request=api.ensureSession();await new Promise(r=>setTimeout(r,1));api.clear();held.resolve();
 await assert.rejects(request,e=>e.authExpired);assert.equal(api.session,null);assert.equal(api.saved(),null);
});
test('logout while data is loading rejects the stale private response',async()=>{
 const api=logged(),held=defer();globalThis.fetch=async()=>{await held.promise;return json([{private:'old-user'}]);};
 const request=api.request('/rest/v1/progress',{auth:true});await new Promise(r=>setTimeout(r,1));api.clear();held.resolve();
 await assert.rejects(request,e=>e.authExpired);
});
test('an expired tab adopts the refreshed stored pair before making any refresh request',async()=>{
 const api=logged(1);localStorage.setItem(api.sessionKey,JSON.stringify(pair('other-tab')));
 await api.ensureSession();assert.equal(api.session.access_token,'other-tab');
});
test('remember choice defaults on in the form, preserves explicit off, and does not silently promote old temporary sessions',()=>{
 const api=new LibraryAPI(CONFIG);assert.equal(api.rememberChoice,true);assert.equal(api.remembers,false);
 api.store(pair());assert(sessionStorage.getItem(api.sessionKey));assert.equal(localStorage.getItem(api.sessionKey),null);
 api.setRemember(false);assert.equal(new LibraryAPI(CONFIG).rememberChoice,false);
 api.setRemember(true);assert(localStorage.getItem(api.sessionKey));assert.equal(sessionStorage.getItem(api.sessionKey),null);
});
test('ordinary logout uses local scope only, leaving other device sessions alone',async()=>{
 const api=logged();let path;
 globalThis.fetch=async(url,o)=>{path=url;assert.equal(o.method,'POST');return new Response(null,{status:204});};
 await api.signOut();assert.equal(path,CONFIG.supabaseUrl+'/auth/v1/logout?scope=local');assert.equal(api.saved(),null);
});
for (const provider of ['google','yandex']) {
 test(`${provider} callback never replays a one-time PKCE code after a lost token response`,async()=>{
  const api=new LibraryAPI(CONFIG);api.setRemember(true);
  sessionStorage.setItem(api.pkceKey,JSON.stringify({verifier:'a'.repeat(43),redirectTo:BASE,startedAt:Date.now(),provider}));
  at(BASE+'?code=short-lived-code');let exchanges=0;
  globalThis.fetch=async(url,o)=>{
   if(url.includes('grant_type=pkce')){exchanges++;assert.equal(JSON.parse(o.body).code_verifier,'a'.repeat(43));throw new Error('Connection closed after server issued tokens');}
   throw new Error('Unexpected request');
  };
  await assert.rejects(api.restore(),e=>!isTransientAuthError(e)&&e.message.includes('одноразовый')&&e.message.includes(provider==='google'?'Google':'Яндекс'));
  assert.equal(location.search,'');assert.equal(sessionStorage.getItem(api.pkceKey),null);
  assert.equal(localStorage.getItem(api.pkceKey),null);
  assert.equal(await api.restore(),null);assert.equal(exchanges,1);
 });
}
test('after successful PKCE exchange a temporary identity failure retries using the saved session, not the code',async()=>{
 const api=new LibraryAPI(CONFIG);api.setRemember(true);
 sessionStorage.setItem(api.pkceKey,JSON.stringify({verifier:'b'.repeat(43),redirectTo:BASE,startedAt:Date.now(),provider:'google'}));
 at(BASE+'?code=one-time-code');let exchanges=0,users=0;
 globalThis.fetch=async url=>{
  if(url.includes('grant_type=pkce')){exchanges++;return json(pair('new'));}
  if(url.includes('/user')){users++;if(users===1)throw new Error('offline');return json({id:'u',email_confirmed_at:'2026-01-01'});}
  return json([{user_id:'u',active:true,is_owner:false}]);
 };
 await assert.rejects(api.restore(),isTransientAuthError);
 assert.equal(location.search,'');assert.equal(sessionStorage.getItem(api.pkceKey),null);
 assert.equal((await api.restore()).id,'u');assert.equal(exchanges,1);assert.equal(users,2);
});
test('initial loading state and shared disclosure size exist without waiting for JavaScript',()=>{
 const html=readFileSync('site/index.html','utf8'),css=readFileSync('site/paper.css','utf8');
 assert.match(html,/<section id="gate" class="gate" hidden>/);assert.match(html,/id="auth-loading"/);
 assert.match(html,/class="yandex-logo"/);assert(!html.includes('class="yandex-mark"'));
 assert.match(css,/--disclosure-title-size: 14px/);assert.match(css,/#content details > summary/);
});
