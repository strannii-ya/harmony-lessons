import { AuthSession } from './oauth-session.js';
/** Public credentials only. Auth confirms email; database policies grant access, never client-side comparisons. */
export function parseLoginProof(value,projectUrl){
 const text=String(value||'').trim();
 if(/^\d{6,8}$/.test(text))return {token:text,type:'email'};
 let url;try{url=new URL(text);}catch{throw new Error('Введи код или вставь ссылку из письма целиком.');}
 if(url.origin!==new URL(projectUrl).origin||url.pathname!=='/auth/v1/verify')throw new Error('Нужна ссылка для входа из письма этого учебника.');
 const token=url.searchParams.get('token')||url.searchParams.get('token_hash');
 if(!token||token.length>256||!['signup','magiclink','email'].includes(url.searchParams.get('type')||'email'))throw new Error('Ссылка не подходит для входа. Запроси новое письмо.');
 return {token_hash:token,type:'email'};
}
export class LibraryAPI extends AuthSession {
 get configured(){return Boolean(this.url&&this.key);}
 async request(path,{body,method='GET',auth=false,prefer}={}){
  if(!this.configured)throw new Error('Подключение частной библиотеки ещё не настроено.');
  if(auth)await this.ensureSession();
  const headers={'apikey':this.key,'Content-Type':'application/json'};if(auth)headers.Authorization='Bearer '+this.session.access_token;if(prefer)headers.Prefer=prefer;
  let response;try{response=await fetch(this.url+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(20000)});}catch{const e=new Error('Не удалось связаться с библиотекой. Проверь интернет и повтори попытку.');e.status=0;throw e;}
  const text=await response.text();let value;try{value=text?JSON.parse(text):null;}catch{throw new Error('Некорректный ответ сервера');}
  if(!response.ok){if(auth&&response.status===401)this.clear();const e=new Error(response.status===429?'Достигнут лимит запросов. Google-вход не требует почтового письма.':value?.message||value?.error_description||value?.msg||`Ошибка соединения (${response.status})`);e.status=response.status;e.code=value?.error_code||value?.code;throw e;}
  return value;
 }
 get isOwner(){return this.membership?.is_owner===true && this.membership?.active===true;}
 async identity(){const user=await this.request('/auth/v1/user',{auth:true});if(!user?.id||!user.email_confirmed_at)throw new Error('Подтверди адрес электронной почты.');const access=await this.request('/rest/v1/members?select=user_id,is_owner,active&user_id=eq.'+encodeURIComponent(user.id),{auth:true});this.membership=access?.[0]||null;if(!this.membership||this.membership.active===false){this.membership=null;const e=new Error('Этот аккаунт не имеет доступа к учебнику. Доступ не выдан или отозван — обратись к владельцу.');e.status=403;throw e;}return user;}
 async send(email){const redirect=location.origin+location.pathname;return this.request('/auth/v1/otp?redirect_to='+encodeURIComponent(redirect),{method:'POST',body:{email:email.trim().toLowerCase(),create_user:false}});}
 async verify(email,proof){const input=parseLoginProof(proof,this.url);if(input.token)input.email=email.trim().toLowerCase();const s=await this.request('/auth/v1/verify',{method:'POST',body:input});this.store(s);try{const user=await this.identity();if(user.email.toLowerCase()!==email.trim().toLowerCase()){await this.signOut();throw new Error('Ссылка относится к другому адресу.');}return user;}catch(e){this.clear();throw e;}}
 async load(){const [lessons,exercises,progress,favorites]=await Promise.all(['lessons?select=*&order=position.asc','exercises?select=*&order=position.asc','progress?select=*','favorites?select=*'].map(x=>this.request('/rest/v1/'+x,{auth:true})));return {lessons,exercises,progress,favorites};}
 async saveProgress(userId,lessonId,patch){return this.request('/rest/v1/progress?on_conflict=user_id,lesson_id',{method:'POST',auth:true,prefer:'resolution=merge-duplicates,return=representation',body:{user_id:userId,lesson_id:lessonId,...patch}});}
 async favorite(userId,id,enabled){return enabled?this.request('/rest/v1/favorites',{method:'POST',auth:true,prefer:'resolution=ignore-duplicates',body:{user_id:userId,exercise_id:id}}):this.request('/rest/v1/favorites?user_id=eq.'+encodeURIComponent(userId)+'&exercise_id=eq.'+encodeURIComponent(id),{method:'DELETE',auth:true});}
 async listAccess(){return this.request('/rest/v1/library_access?select=id,email,active,created_at,joined_at&order=created_at.desc',{auth:true});}
 async inviteAccount(email){const normalized=String(email).trim().toLowerCase();if(normalized.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))throw new Error('Укажи корректный email.');return this.request('/rest/v1/library_access',{method:'POST',auth:true,prefer:'return=representation',body:{email:normalized}});}
 async setAccess(id,active){if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)||typeof active!=='boolean')throw new Error('Некорректное изменение доступа.');const rows=await this.request('/rest/v1/library_access?id=eq.'+encodeURIComponent(id),{method:'PATCH',auth:true,prefer:'return=representation',body:{active}});if(!rows?.length)throw new Error('Запись недоступна. Обнови список.');return rows;}
 async signOut(){try{if(this.session)await this.request('/auth/v1/logout',{auth:true,method:'POST'});}finally{this.membership=null;this.clear();}}
}
