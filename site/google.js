import { getLibraryAPI } from './auth-client.js';
import { loading,login } from './auth-screen.js';
const google=document.querySelector('#google-signin'),yandex=document.querySelector('#yandex-signin');
const buttons=[google,yandex].filter(Boolean),status=document.querySelector('#google-status'),remember=document.querySelector('#remember');
let api,busy=false;
const say=text=>{status.textContent=text;};
const unlock=()=>{busy=false;for(const b of buttons){b.disabled=!api?.configured;b.removeAttribute('aria-busy');}};
async function init(){
 try {
  api=await getLibraryAPI();
  unlock();remember.checked=api.rememberChoice;
  if(!api.configured)say('Подключение библиотеки пока не настроено.');
 }catch(e){say(e.message);for(const b of buttons)b.disabled=true;}
}
async function start(provider,button){
 if(!api||busy)return;
 busy=true;for(const b of buttons)b.disabled=true;
 button.setAttribute('aria-busy','true');say(provider==='google'?'Проверяю Google-вход…':'Проверяю вход через Яндекс…');
 try{
  const url=await (provider==='google'?api.googleUrl({remember:remember.checked}):api.yandexUrl({remember:remember.checked}));
  loading(provider==='google'?'Открываем Google…':'Открываем Яндекс ID…');location.assign(url);
 }catch(e){say(e.message);unlock();}
}
// Email fallback must honour the same visible persistence choice as OAuth.
document.querySelector('#code-form').addEventListener('submit',event=>{
 try{api?.setRemember(remember.checked);}
 catch(e){event.preventDefault();event.stopImmediatePropagation();say(e.message);}
},{capture:true});
google?.addEventListener('click',()=>start('google',google));
yandex?.addEventListener('click',()=>start('yandex',yandex));
remember.addEventListener('change',()=>{try{api?.setRemember(remember.checked);}catch(e){remember.checked=false;say(e.message);}});
window.addEventListener('pageshow',event=>{if(api?.configured){unlock();if(event.persisted&&document.querySelector('#shell').hidden)login();}});
for(const id of ['retry-auth','choose-login'])document.getElementById(id)?.addEventListener('click',()=>{if(!api)init();});
window.addEventListener('online',()=>{if(!api)init();});
init();
