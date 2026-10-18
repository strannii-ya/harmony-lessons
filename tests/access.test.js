import test from 'node:test';
import assert from 'node:assert/strict';
import { LibraryAPI } from '../site/api.js';
const config={supabaseUrl:'https://fixture.supabase.co',publishableKey:'sb_publishable_fixture'};
test('owner capability comes from the verified membership, never editable metadata',async()=>{
 for(const role of [true,false]){
  const api=new LibraryAPI(config);
  const user={id:'fixture-user',email_confirmed_at:'2026-01-01',user_metadata:{is_owner:true}};
  api.request=async(path)=>path==='/auth/v1/user'?user:[{user_id:user.id,is_owner:role,active:true}];
  assert.equal(api.isOwner,false);assert.equal(await api.identity(),user);assert.equal(api.isOwner,role);
 }
 const api=new LibraryAPI(config);api.membership={is_owner:true};assert.equal(api.isOwner,false);
});
test('absent or revoked membership does not enter the course',async()=>{
 for(const result of [[],[{user_id:'fixture-user',active:false,is_owner:true}]]){
  const api=new LibraryAPI(config);
  api.request=async(path)=>path==='/auth/v1/user'?{id:'fixture-user',email_confirmed_at:'2026-01-01'}:result;
  await assert.rejects(()=>api.identity(),{status:403});assert.equal(api.isOwner,false);
 }
});
test('invitation writes only normalized email; no client-selected owner or binding',async()=>{
 const api=new LibraryAPI(config);let call;
 api.request=async(...args)=>{call=args;return [];};
 await api.inviteAccount(' Friend@Example.COM ');
 assert.equal(call[0],'/rest/v1/library_access');assert.equal(call[1].method,'POST');assert.equal(call[1].auth,true);assert.deepEqual(call[1].body,{email:'friend@example.com'});
 for(const bad of ['', 'not-email','a@b','bad @example.com','x'.repeat(260)+'@example.com']) await assert.rejects(()=>api.inviteAccount(bad));
});
test('revoke and restore write only active and reject ambiguous or malformed targets',async()=>{
 const api=new LibraryAPI(config);let call;
 api.request=async(...args)=>{call=args;return [{id:'fixture'}];};
 const id='11111111-1111-4111-8111-111111111111';await api.setAccess(id,false);
 assert.equal(call[0],'/rest/v1/library_access?id=eq.'+id);assert.equal(call[1].method,'PATCH');assert.deepEqual(call[1].body,{active:false});assert.equal(call[1].auth,true);
 await assert.rejects(()=>api.setAccess('x&email=evil',false));await assert.rejects(()=>api.setAccess(id,'false'));
 api.request=async()=>[];await assert.rejects(()=>api.setAccess(id,true));
});
