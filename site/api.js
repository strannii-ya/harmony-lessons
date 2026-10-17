/** Supabase REST client. Only publishable credentials are public; authorisation must be enforced by RLS. */
export class LibraryAPI {
 constructor(config){this.url=config.supabaseUrl?.replace(/\/$/,'');this.key=config.publishableKey;this.session=null;this.refreshing=null;}
 get configured(){return Boolean(this.url&&this.key);}
 async request(path,{body,method='GET',auth=false,prefer}={}){
  if(!this.configured)throw new Error('Подключение частной библиотеки ещё не настроено.');
  if(auth)await this.ensureSession();
  const headers={'apikey':this.key,'Content-Type':'application/json'};if(auth)headers.Authorization='Bearer '+this.session.access_token;if(prefer)headers.Prefer=prefer;
  const response=await fetch(this.url+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
  const text=await response.text();let value;try{value=text?JSON.parse(text):null;}catch{throw new Error('Некорректный ответ сервера');}
  if(!response.ok){if(auth&&response.status===401)this.clear();throw new Error(value?.message||value?.error_description||value?.msg||`Ошибка соединения (${response.status})`);}
  return value;
 }
 store(session){if(!session?.access_token||!session?.refresh_token)throw new Error('Нет действительной сессии');session.expires_at??=Math.floor(Date.now()/1000)+(session.expires_in||3600);this.session=session;sessionStorage.setItem('harmony.session',JSON.stringify(session));}
 clear(){this.session=null;sessionStorage.removeItem('harmony.session');}
 async ensureSession(){if(!this.session)throw new Error('Войдите в свой кабинет');if(this.session.expires_at>Date.now()/1000+60)return;
  this.refreshing??=this.request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:this.session.refresh_token}}).then(s=>this.store(s)).finally(()=>{this.refreshing=null;});await this.refreshing;
 }
 async restore(){
  const p=new URLSearchParams(location.hash.slice(1));
  if(p.has('access_token')){const s={access_token:p.get('access_token'),refresh_token:p.get('refresh_token'),expires_in:Number(p.get('expires_in'))||3600};history.replaceState(null,'',location.pathname+location.search);this.store(s);}
  else{try{const s=JSON.parse(sessionStorage.getItem('harmony.session')||'null');if(s)this.session=s;}catch{this.clear();}}
  if(!this.session)return null;try{return await this.identity();}catch{this.clear();return null;}
 }
 async identity(){const user=await this.request('/auth/v1/user',{auth:true});if(!user?.id||!user.email_confirmed_at)throw new Error('Подтвердите адрес электронной почты');
  const access=await this.request('/rest/v1/members?select=user_id&user_id=eq.'+encodeURIComponent(user.id),{auth:true});if(!access?.length)throw new Error('Этот аккаунт не имеет доступа к учебнику');return user;
 }
 async send(email){const redirect=location.origin+location.pathname;return this.request('/auth/v1/otp?redirect_to='+encodeURIComponent(redirect),{method:'POST',body:{email:email.trim().toLowerCase(),create_user:false}});}
 async verify(email,token){const s=await this.request('/auth/v1/verify',{method:'POST',body:{email:email.trim().toLowerCase(),token,type:'email'}});this.store(s);try{return await this.identity();}catch(e){this.clear();throw e;}}
 async load(){const [lessons,exercises,progress,favorites]=await Promise.all(['lessons?select=*&order=position.asc','exercises?select=*&order=position.asc','progress?select=*','favorites?select=*'].map(x=>this.request('/rest/v1/'+x,{auth:true})));return {lessons,exercises,progress,favorites};}
 async saveProgress(userId,lessonId,patch){return this.request('/rest/v1/progress?on_conflict=user_id,lesson_id',{method:'POST',auth:true,prefer:'resolution=merge-duplicates,return=representation',body:{user_id:userId,lesson_id:lessonId,...patch}});}
 async favorite(userId,id,enabled){return enabled?this.request('/rest/v1/favorites',{method:'POST',auth:true,prefer:'resolution=ignore-duplicates',body:{user_id:userId,exercise_id:id}}):this.request('/rest/v1/favorites?user_id=eq.'+encodeURIComponent(userId)+'&exercise_id=eq.'+encodeURIComponent(id),{method:'DELETE',auth:true});}
 async signOut(){try{if(this.session)await this.request('/auth/v1/logout',{auth:true,method:'POST'});}finally{this.clear();}}
}
