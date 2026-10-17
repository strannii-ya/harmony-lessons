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
export class LibraryAPI {
 constructor(config){this.url=config.supabaseUrl?.replace(/\/$/,'');this.key=config.publishableKey;this.session=null;this.refreshing=null;}
 get configured(){return Boolean(this.url&&this.key);}
 async request(path,{body,method='GET',auth=false,prefer}={}){
  if(!this.configured)throw new Error('Подключение частной библиотеки ещё не настроено.');
  if(auth)await this.ensureSession();
  const headers={'apikey':this.key,'Content-Type':'application/json'};if(auth)headers.Authorization='Bearer '+this.session.access_token;if(prefer)headers.Prefer=prefer;
  let response;try{response=await fetch(this.url+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(20000)});}catch{throw new Error('Не удалось связаться с библиотекой. Проверь интернет и повтори попытку.');}
  const text=await response.text();let value;try{value=text?JSON.parse(text):null;}catch{throw new Error('Некорректный ответ сервера');}
  if(!response.ok){if(auth&&response.status===401)this.clear();if(response.status===429)throw new Error('Слишком много запросов. Не запрашивай письмо повторно: используй последнее письмо или повтори позже.');throw new Error(value?.message||value?.error_description||value?.msg||`Ошибка соединения (${response.status})`);}
  return value;
 }
 store(session){if(!session?.access_token||!session?.refresh_token)throw new Error('Нет действительной сессии');session.expires_at??=Math.floor(Date.now()/1000)+(session.expires_in||3600);this.session=session;sessionStorage.setItem('harmony.session',JSON.stringify(session));}
 clear(){this.session=null;sessionStorage.removeItem('harmony.session');}
 async ensureSession(){if(!this.session)throw new Error('Войдите в свой кабинет');if(this.session.expires_at>Date.now()/1000+60)return;this.refreshing??=this.request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:this.session.refresh_token}}).then(s=>this.store(s)).finally(()=>{this.refreshing=null;});await this.refreshing;}
 async restore(){const p=new URLSearchParams(location.hash.slice(1));if(p.has('access_token')){const s={access_token:p.get('access_token'),refresh_token:p.get('refresh_token'),expires_in:Number(p.get('expires_in'))||3600};history.replaceState(null,'',location.pathname+location.search);this.store(s);}else{try{const s=JSON.parse(sessionStorage.getItem('harmony.session')||'null');if(s)this.session=s;}catch{this.clear();}}if(!this.session)return null;try{return await this.identity();}catch{this.clear();return null;}}
 async identity(){const user=await this.request('/auth/v1/user',{auth:true});if(!user?.id||!user.email_confirmed_at)throw new Error('Подтверди адрес электронной почты.');const access=await this.request('/rest/v1/members?select=user_id&user_id=eq.'+encodeURIComponent(user.id),{auth:true});if(!access?.length)throw new Error('Этот аккаунт не имеет доступа к учебнику.');return user;}
 async send(email){const redirect=location.origin+location.pathname;return this.request('/auth/v1/otp?redirect_to='+encodeURIComponent(redirect),{method:'POST',body:{email:email.trim().toLowerCase(),create_user:true}});}
 async verify(email,proof){const input=parseLoginProof(proof,this.url);if(input.token)input.email=email.trim().toLowerCase();const s=await this.request('/auth/v1/verify',{method:'POST',body:input});this.store(s);try{const user=await this.identity();if(user.email.toLowerCase()!==email.trim().toLowerCase()){await this.signOut();throw new Error('Ссылка относится к другому адресу.');}return user;}catch(e){this.clear();throw e;}}
 async load(){const [lessons,exercises,progress,favorites]=await Promise.all(['lessons?select=*&order=position.asc','exercises?select=*&order=position.asc','progress?select=*','favorites?select=*'].map(x=>this.request('/rest/v1/'+x,{auth:true})));return {lessons,exercises,progress,favorites};}
 async saveProgress(userId,lessonId,patch){return this.request('/rest/v1/progress?on_conflict=user_id,lesson_id',{method:'POST',auth:true,prefer:'resolution=merge-duplicates,return=representation',body:{user_id:userId,lesson_id:lessonId,...patch}});}
 async favorite(userId,id,enabled){return enabled?this.request('/rest/v1/favorites',{method:'POST',auth:true,prefer:'resolution=ignore-duplicates',body:{user_id:userId,exercise_id:id}}):this.request('/rest/v1/favorites?user_id=eq.'+encodeURIComponent(userId)+'&exercise_id=eq.'+encodeURIComponent(id),{method:'DELETE',auth:true});}
 async signOut(){try{if(this.session)await this.request('/auth/v1/logout',{auth:true,method:'POST'});}finally{this.clear();}}
}
