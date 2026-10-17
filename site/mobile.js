// Accessible drawer, score zoom and safe touch controls. No private data or auth shortcuts.
const body=document.body, sidebar=document.querySelector('#sidebar'),menu=document.querySelector('#menu');
const mobile=matchMedia('(max-width: 900px)');
const scrim=document.createElement('button');scrim.type='button';scrim.className='nav-scrim';scrim.hidden=true;scrim.tabIndex=-1;scrim.setAttribute('aria-label','Закрыть навигацию');body.append(scrim);
const closeButton=document.createElement('button');closeButton.type='button';closeButton.className='nav-close';closeButton.textContent='Закрыть ×';sidebar.prepend(closeButton);
menu.setAttribute('aria-controls','sidebar');let wasOpen=false;
function close(){body.classList.remove('menu-open');}
scrim.addEventListener('click',close);closeButton.addEventListener('click',close);
function sync(){
 const signedIn=!document.querySelector('#shell').hidden;
 const open=mobile.matches&&signedIn&&body.classList.contains('menu-open');
 menu.setAttribute('aria-expanded',String(open));sidebar.inert=mobile.matches&&!open;
 sidebar.setAttribute('aria-hidden',String(mobile.matches&&!open));scrim.hidden=!open;
 const workspace=document.querySelector('.workspace'),player=document.querySelector('#player');workspace.inert=open;player.inert=open;
 if(open){sidebar.setAttribute('role','dialog');sidebar.setAttribute('aria-modal','true');sidebar.setAttribute('aria-label','Навигация по учебнику');if(!wasOpen)closeButton.focus();}
 else {sidebar.removeAttribute('role');sidebar.removeAttribute('aria-modal');if(wasOpen&&signedIn)menu.focus();}
 wasOpen=open;
 const playing=!player.hidden&&signedIn;
 if(body.classList.contains('player-visible')!==playing)body.classList.toggle('player-visible',playing);
}
new MutationObserver(sync).observe(body,{attributes:true,attributeFilter:['class']});
new MutationObserver(sync).observe(document.querySelector('#player'),{attributes:true,attributeFilter:['hidden']});
new MutationObserver(sync).observe(document.querySelector('#shell'),{attributes:true,attributeFilter:['hidden']});
mobile.addEventListener('change',()=>{if(!mobile.matches)close();sync();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')close();if(e.key!=='Tab'||!wasOpen)return;const nodes=[...sidebar.querySelectorAll('a,button,select,input')].filter(n=>!n.disabled&&n.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
sync();
// Let a user use an already received email without consuming another mail request.
const existingEmail=document.createElement('button');existingEmail.type='button';existingEmail.textContent='Уже есть письмо или код';existingEmail.className='existing-email';existingEmail.addEventListener('click',()=>{document.querySelector('#code-form').hidden=false;document.querySelector('#code').focus();});document.querySelector('#login-form').after(existingEmail);
