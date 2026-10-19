/** The neutral loading view is present in HTML before JavaScript or OAuth can run. */
const $=s=>document.querySelector(s);
let warning;
export function loading(message='Открываем учебник…'){
 clearTimeout(warning);
 $('#gate').hidden=true;$('#auth-loading').hidden=false;
 $('#auth-loading').setAttribute('aria-busy','true');
 $('#auth-loading-title').textContent=message;
 $('#auth-loading-message').textContent='';$('#auth-loading-actions').hidden=true;
 warning=setTimeout(()=>{$('#auth-loading-message').textContent='Загрузка занимает больше времени, чем обычно. Проверяем соединение…';},10000);
}
export function ready(){clearTimeout(warning);$('#auth-loading').hidden=true;$('#auth-loading').setAttribute('aria-busy','false');}
export function login(message=''){
 ready();$('#shell').hidden=true;$('#gate').hidden=false;$('#login-status').textContent=message;
}
export function loadingError(message){
 clearTimeout(warning);$('#gate').hidden=true;$('#shell').hidden=true;
 $('#auth-loading').hidden=false;$('#auth-loading').setAttribute('aria-busy','false');
 $('#auth-loading-title').textContent='Не удалось открыть учебник';
 $('#auth-loading-message').textContent=message;
 $('#auth-loading-actions').hidden=false;
}
