import { LibraryAPI } from './api.js';
const button=document.querySelector('#google-signin'),status=document.querySelector('#google-status'),remember=document.querySelector('#remember');
let api;
const say=text=>{status.textContent=text;};
async function init(){
 try {
  const response=await fetch('./config.json',{cache:'no-store'});
  if(!response.ok)throw new Error('Не удалось загрузить настройки входа. Обнови страницу.');
  api=new LibraryAPI(await response.json());
  button.disabled=!api.configured;remember.checked=api.remembers;
  if(!api.configured)say('Подключение библиотеки пока не настроено.');
 }catch(e){say(e.message);button.disabled=true;}
}
button.addEventListener('click',async()=>{
 if(!api)return;
 button.disabled=true;button.setAttribute('aria-busy','true');say('Проверяю Google-вход…');
 try{const url=await api.googleUrl({remember:remember.checked});say('Открываю выбор Google-аккаунта…');location.assign(url);}
 catch(e){say(e.message);button.disabled=false;button.removeAttribute('aria-busy');}
});
remember.addEventListener('change',()=>{try{api?.setRemember(remember.checked);}catch(e){remember.checked=false;say(e.message);}});
// Restore the button if navigation was cancelled or the browser returned from its back-forward cache.
window.addEventListener('pageshow',()=>{if(api?.configured){button.disabled=false;button.removeAttribute('aria-busy');}});
// A logout in another tab removes the persistent session; discard the visible private content here too.
window.addEventListener('storage',e=>{if(api&&e.storageArea===localStorage&&e.key===api.sessionKey&&e.newValue===null&&!document.querySelector('#shell').hidden)location.reload();});
init();
