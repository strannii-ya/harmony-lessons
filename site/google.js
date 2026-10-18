import { LibraryAPI } from './api.js';
const google=document.querySelector('#google-signin'),yandex=document.querySelector('#yandex-signin');
const buttons=[google,yandex].filter(Boolean),status=document.querySelector('#google-status'),remember=document.querySelector('#remember');
let api,busy=false;
const say=text=>{status.textContent=text;};
const unlock=()=>{busy=false;for(const b of buttons){b.disabled=!api?.configured;b.removeAttribute('aria-busy');}};
async function init(){
 try {
  const response=await fetch('./config.json',{cache:'no-store'});
  if(!response.ok)throw new Error('Не удалось загрузить настройки входа. Обнови страницу.');
  api=new LibraryAPI(await response.json());
  unlock();remember.checked=api.remembers;
  if(!api.configured)say('Подключение библиотеки пока не настроено.');
 }catch(e){say(e.message);for(const b of buttons)b.disabled=true;}
}
async function start(provider,button){
 if(!api||busy)return;
 busy=true;for(const b of buttons)b.disabled=true;
 button.setAttribute('aria-busy','true');say(provider==='google'?'Проверяю Google-вход…':'Проверяю вход через Яндекс…');
 try{
  const url=await (provider==='google'?api.googleUrl({remember:remember.checked}):api.yandexUrl({remember:remember.checked}));
  say(provider==='google'?'Открываю выбор Google-аккаунта…':'Открываю Яндекс ID…');location.assign(url);
 }catch(e){say(e.message);unlock();}
}
google?.addEventListener('click',()=>start('google',google));
yandex?.addEventListener('click',()=>start('yandex',yandex));
remember.addEventListener('change',()=>{try{api?.setRemember(remember.checked);}catch(e){remember.checked=false;say(e.message);}});
window.addEventListener('pageshow',()=>{if(api?.configured)unlock();});
window.addEventListener('storage',e=>{if(api&&e.storageArea===localStorage&&e.key===api.sessionKey&&e.newValue===null&&!document.querySelector('#shell').hidden)location.reload();});
init();
