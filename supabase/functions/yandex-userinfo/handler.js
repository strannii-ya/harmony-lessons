/** Server-to-server userinfo adapter for Supabase's custom:yandex provider.
 * No database credentials, session minting, client secrets, or profile logging.
 * client_id is fixed in the protected provider's UserInfo URL, not supplied by
 * the browser to Supabase's authorization flow. Check it against Yandex's reply.
 */
const YANDEX_INFO='https://login.yandex.ru/info?format=json';
const MAIL_DOMAINS=new Set(['yandex.ru','ya.ru','yandex.com','yandex.by','yandex.kz']);
const HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Vary':'Authorization'};
function reply(status,value){return new Response(JSON.stringify(value),{status,headers:HEADERS});}
class ProfileError extends Error {}
export function normalizeProfile(data,expectedClientId){
 if(!data||typeof data!=='object'||data.client_id!==expectedClientId)throw new ProfileError('wrong_application');
 const id=typeof data.id==='number'&&Number.isSafeInteger(data.id)?String(data.id):data.id;
 if(typeof id!=='string'||!/^\d{1,32}$/.test(id))throw new ProfileError('invalid_subject');
 const email=typeof data.default_email==='string'?data.default_email.trim().toLowerCase():'';
 const login=typeof data.login==='string'?data.login.trim().toLowerCase():'';
 if(email.length>254||! /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,63}$/.test(email))throw new ProfileError('missing_email');
 const at=email.lastIndexOf('@'),local=email.slice(0,at),domain=email.slice(at+1);
 // A native Yandex mailbox must belong to this login (dot/hyphen aliases are
 // documented by Yandex). Lite accounts use their verified external email as
 // their actual login. Do NOT trust an arbitrary recovery/contact email.
 const native=MAIL_DOMAINS.has(domain)&&login.replace(/\./g,'-')===local.replace(/\./g,'-');
 const emailLogin=login===email;
 if(!native&&!emailLogin)throw new ProfileError('email_verification_required');
 return {sub:id,email,email_verified:true,preferred_username:login};
}
async function limitedJSON(response){
 if(!response.headers.get('content-type')?.toLowerCase().includes('application/json'))throw new Error('Invalid upstream type');
 const reader=response.body?.getReader();if(!reader)throw new Error('Empty upstream response');
 const chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>32768)throw new Error('Oversized upstream response');chunks.push(value);}}
 catch(e){await reader.cancel().catch(()=>{});throw e;}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 return JSON.parse(new TextDecoder().decode(bytes));
}
export async function handler(request,fetcher=fetch){
 if(request.method!=='GET')return reply(405,{error:'method_not_allowed'});
 const url=new URL(request.url);
 if([...url.searchParams.keys()].some(k=>k!=='client_id')||url.searchParams.getAll('client_id').length>1)return reply(400,{error:'invalid_request'});
 const auth=request.headers.get('authorization')||'',match=/^(?:Bearer|OAuth) ([A-Za-z0-9._~-]{16,8192})$/i.exec(auth);
 if(!match)return reply(401,{error:'invalid_token'});
 const expected=url.searchParams.get('client_id')||'';
 if(!/^[a-f0-9]{32}$/.test(expected))return reply(400,{error:'invalid_client_configuration'});
 let upstream;
 try{upstream=await fetcher(YANDEX_INFO,{method:'GET',headers:{Authorization:'OAuth '+match[1],Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(8000)});}
 catch{return reply(502,{error:'identity_service_unavailable'});}
 if(upstream.status===401||upstream.status===403)return reply(401,{error:'invalid_token'});
 if(!upstream.ok)return reply(502,{error:'identity_service_unavailable'});
 try{return reply(200,normalizeProfile(await limitedJSON(upstream),expected));}
 catch(e){return reply(e instanceof ProfileError?403:502,{error:e instanceof ProfileError?e.message:'invalid_identity_response'});}
}
