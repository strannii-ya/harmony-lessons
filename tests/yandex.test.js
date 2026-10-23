import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {AuthSession,YANDEX_SETUP_MESSAGE,authFailure} from '../site/oauth-session.js';
import {handler,normalizeProfile} from '../supabase/functions/yandex-userinfo/handler.js';
class MemoryStorage { constructor(){this.data=new Map();}getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);} }
const BASE='https://example.test/harmony-lessons/',CONFIG={supabaseUrl:'https://synthetic.supabase.co',publishableKey:'sb_publishable_fixture'};
const ID='a'.repeat(32),TOKEN='not-a-real-yandex-token',ENDPOINT=`https://edge.example.test/yandex-userinfo?client_id=${ID}`;
const PROFILE={id:'1234567',client_id:ID,login:'test.user',default_email:'test.user@yandex.ru',display_name:'not needed',birthday:'not needed'};
const savedFetch=globalThis.fetch;
function loc(s){const u=new URL(s);globalThis.location={href:u.href,origin:u.origin,pathname:u.pathname,search:u.search,hash:u.hash};}
beforeEach(()=>{globalThis.sessionStorage=new MemoryStorage();globalThis.localStorage=new MemoryStorage();loc(BASE);globalThis.history={replaceState(a,b,s){loc(new URL(s,BASE));}};});
afterEach(()=>{globalThis.fetch=savedFetch;});
class Fixture extends AuthSession {constructor(){super(CONFIG);this.calls=[];this.allowed=true;}async request(path,options){this.calls.push({path,options});if(path==='/auth/v1/settings')return {external:{google:true}};if(path.includes('grant_type=pkce'))return {access_token:'session-not-yandex',refresh_token:'refresh-not-yandex',expires_in:3600,provider_token:TOKEN};throw Error('unexpected request');}async identity(){if(!this.allowed)throw Object.assign(new Error('Не имеет доступа'),{status:403});return {id:'verified-member'};} }
test('Yandex uses fixed custom provider, email-only scope and a fresh path-bound PKCE verifier',async()=>{
 let requests=0;globalThis.fetch=async()=>{requests++;throw Error('No pre-navigation OAuth fetch allowed');};const api=new Fixture();
 loc(BASE+'?next=https://evil.test/&provider=evil#lesson-4');const url=new URL(await api.yandexUrl({remember:true})),pending=JSON.parse(sessionStorage.getItem(api.pkceKey));
 assert.equal(url.origin,CONFIG.supabaseUrl);assert.equal(url.searchParams.get('provider'),'custom:yandex');assert.equal(url.searchParams.get('scopes'),'login:email');assert.equal(url.searchParams.get('redirect_to'),BASE);assert.equal(url.searchParams.get('code_challenge_method'),'s256');
 assert.equal(url.searchParams.get('code_challenge'),createHash('sha256').update(pending.verifier).digest('base64url'));assert.equal(pending.provider,'yandex');assert.equal(pending.redirectTo,BASE);
 assert.ok(!url.href.includes(TOKEN));assert.ok(!url.href.includes('code_verifier'));
 assert.equal(requests,0,'the actual browser navigation must be the only authorize request');assert.equal(api.calls.length,0);
});
test('Missing Yandex provider is explained after redirect to the auth callback',async()=>{
 const api=new Fixture();await api.yandexUrl({remember:true});
 loc(BASE+'?error=custom_provider_not_found&error_description=PRIVATE-TOKEN');
 await assert.rejects(api.restore(),e=>e.message===YANDEX_SETUP_MESSAGE);
 assert.equal(location.search,'');assert.equal(sessionStorage.getItem(api.pkceKey),null);
});
test('Yandex launch does not depend on a preliminary fetch or consume a callback code',async()=>{
 globalThis.fetch=async()=>{throw Error('Offline fetch should not block OAuth navigation');};
 const api=new Fixture();const url=await api.yandexUrl();
 assert.equal(new URL(url).pathname,'/auth/v1/authorize');assert.ok(sessionStorage.getItem(api.pkceKey));
 loc(BASE+'?code=one-use-code');assert.equal((await new Fixture().restore()).id,'verified-member');
});
test('Yandex callback keeps membership checks, strips provider tokens and restores remembered login',async()=>{
 globalThis.fetch=async()=>({type:'opaqueredirect'});const api=new Fixture();await api.yandexUrl({remember:true});loc(BASE+'?code=one-use-code');assert.equal((await api.restore()).id,'verified-member');assert.equal(location.search,'');assert.equal(sessionStorage.getItem(api.pkceKey),null);assert.ok(!localStorage.getItem(api.sessionKey).includes(TOKEN));
});
test('An uninvited Yandex user receives no stored session',async()=>{
 globalThis.fetch=async()=>({type:'opaqueredirect'});const api=new Fixture();await api.yandexUrl();api.allowed=false;loc(BASE+'?code=one-use-code');await assert.rejects(api.restore(),/доступа/);assert.equal(api.session,null);assert.equal(sessionStorage.getItem(api.sessionKey),null);
});
test('Yandex cancellation mentions the actual provider without exposing callback data',async()=>{
 globalThis.fetch=async()=>({type:'opaqueredirect'});const api=new Fixture();await api.yandexUrl();loc(BASE+'?error=access_denied&error_description='+TOKEN);await assert.rejects(api.restore(),e=>e.message.includes('Яндекс')&&!e.message.includes(TOKEN));assert.equal(location.search,'');assert.equal(sessionStorage.getItem(api.pkceKey),null);assert.ok(authFailure('provider_disabled','yandex').includes('custom:yandex'));
});
test('Client cannot inject an arbitrary provider or malformed pending state',async()=>{
 const api=new Fixture();await assert.rejects(api.oauthUrl('custom:evil'));sessionStorage.setItem(api.pkceKey,JSON.stringify({verifier:'a'.repeat(43),redirectTo:BASE,startedAt:Date.now(),provider:'evil'}));loc(BASE+'?code=evil');await assert.rejects(api.restore());assert.equal(api.calls.length,0);
});
function req(url=ENDPOINT,options={}){return new Request(url,{headers:{Authorization:'Bearer '+TOKEN},...options});}
function upstream(profile=PROFILE){return new Response(JSON.stringify(profile),{headers:{'Content-Type':'application/json'}});}
test('userinfo checks token with Yandex, correct app binding, and returns only minimal standard claims',async()=>{
 let call;const result=await handler(req(),async(url,opts)=>{call={url,opts};return upstream();});assert.equal(result.status,200);
 assert.deepEqual(await result.json(),{sub:'1234567',email:'test.user@yandex.ru',email_verified:true,preferred_username:'test.user'});
 assert.equal(call.url,'https://login.yandex.ru/info?format=json');assert.equal(call.opts.redirect,'error');assert.equal(call.opts.headers.Authorization,'OAuth '+TOKEN);assert.ok(!call.url.includes(TOKEN));
 assert.equal(result.headers.get('cache-control'),'no-store');assert.equal(result.headers.get('access-control-allow-origin'),null);
});
test('userinfo rejects missing credentials, query tokens, duplicated client IDs and wrong methods without network calls',async()=>{
 const nope=async()=>{throw Error('Must not fetch');};
 for(const [request,status] of [[new Request(ENDPOINT),401],[req(ENDPOINT+'&oauth_token='+TOKEN),400],[req(ENDPOINT+'&client_id='+ID),400],[req('https://edge.example.test/'),400],[req(ENDPOINT,{method:'POST'}),405]])assert.equal((await handler(request,nope)).status,status);
});
test('userinfo cannot accept a different app token or client-supplied profile',async()=>{
 for(const profile of [{...PROFILE,client_id:'b'.repeat(32)},{...PROFILE,id:{}},{...PROFILE,default_email:'',email:'owner@gmail.com',email_verified:true},{...PROFILE,default_email:'owner@gmail.com',login:'stranger',email_verified:true}])assert.equal((await handler(req(),async()=>upstream(profile))).status,403);
});
test('Yandex aliases preserve returned address; verified lite login is allowed; recovery email is not proof',()=>{
 assert.equal(normalizeProfile({...PROFILE,default_email:'TEST-USER@YA.RU'},ID).email,'test-user@ya.ru');
 assert.equal(normalizeProfile({...PROFILE,default_email:'lite@example.com',login:'lite@example.com'},ID).email,'lite@example.com');
 assert.throws(()=>normalizeProfile({...PROFILE,default_email:'other@yandex.ru'},ID));
 assert.throws(()=>normalizeProfile({...PROFILE,default_email:'test.user@yandex.ru.evil.test'},ID));
 assert.throws(()=>normalizeProfile({...PROFILE,default_email:'<bad>@yandex.ru'},ID));
});
test('userinfo handles upstream failures without exposing tokens, profile data or exceptions',async()=>{
 for(const upstreamResponse of [new Response(TOKEN,{status:401}),new Response(TOKEN,{status:503}),new Response(TOKEN,{headers:{'Content-Type':'text/html'}}),new Response('a'.repeat(40000),{headers:{'Content-Type':'application/json'}})]){
  const result=await handler(req(),async()=>upstreamResponse);assert.ok(result.status>=400);assert.ok(!(await result.text()).includes(TOKEN));
 }
 const result=await handler(req(),async()=>{throw Error(TOKEN);});assert.equal(result.status,502);assert.ok(!(await result.text()).includes(TOKEN));
});
