import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLoginProof } from '../site/api.js';
const project='https://example.supabase.co';
test('login accepts numeric OTP',()=>assert.deepEqual(parseLoginProof(' 123456 ',project),{token:'123456',type:'email'}));
test('email link is verified directly; redirect URL is never followed',()=>assert.deepEqual(parseLoginProof(project+'/auth/v1/verify?token=one-time-hash&type=signup&redirect_to=http://localhost:3000',project),{token_hash:'one-time-hash',type:'email'}));
test('reject other projects and unrelated links',()=>{for(const value of ['https://evil.example/auth/v1/verify?token=x','https://other.supabase.co/auth/v1/verify?token=x',project+'/not-a-login?token=x',project+'/auth/v1/verify?token=x&type=recovery','javascript:alert(1)'])assert.throws(()=>parseLoginProof(value,project));});
