// A modal navigation drawer in portrait and phone landscape. No fixed top bar in landscape.
const body=document.body,sidebar=document.querySelector('#sidebar');
const menu=document.querySelector('#menu'),landscapeMenu=document.querySelector('#landscape-menu');
const landscape=matchMedia('(orientation: landscape) and (max-height: 520px) and (max-width: 1024px)');
const mobile=matchMedia('(max-width: 900px), (orientation: landscape) and (max-height: 520px) and (max-width: 1024px)');
const buttons=[menu,landscapeMenu];
const scrim=document.createElement('button');scrim.type='button';scrim.className='nav-scrim';scrim.hidden=true;scrim.tabIndex=-1;scrim.setAttribute('aria-label','Закрыть навигацию');body.append(scrim);
const closeButton=document.createElement('button');closeButton.type='button';closeButton.className='nav-close';closeButton.textContent='Закрыть ×';sidebar.prepend(closeButton);
buttons.forEach(b=>b.setAttribute('aria-controls','sidebar'));let wasOpen=false;
function close(){body.classList.remove('menu-open');}
scrim.addEventListener('click',close);closeButton.addEventListener('click',close);
function sync(){
 const signedIn=!document.querySelector('#shell').hidden;
 const open=mobile.matches&&signedIn&&body.classList.contains('menu-open');
 buttons.forEach(b=>b.setAttribute('aria-expanded',String(open)));
 sidebar.inert=mobile.matches&&!open;sidebar.setAttribute('aria-hidden',String(mobile.matches&&!open));scrim.hidden=!open;
 document.querySelector('.workspace').inert=open;landscapeMenu.inert=open;
 if(open){sidebar.setAttribute('role','dialog');sidebar.setAttribute('aria-modal','true');sidebar.setAttribute('aria-label','Навигация по учебнику');if(!wasOpen)closeButton.focus();}
 else{sidebar.removeAttribute('role');sidebar.removeAttribute('aria-modal');if(wasOpen&&signedIn)(landscape.matches?landscapeMenu:menu).focus();}
 wasOpen=open;
}
new MutationObserver(sync).observe(body,{attributes:true,attributeFilter:['class']});
for(const id of ['#shell'])new MutationObserver(sync).observe(document.querySelector(id),{attributes:true,attributeFilter:['hidden']});
mobile.addEventListener('change',()=>{if(!mobile.matches)close();sync();});landscape.addEventListener('change',sync);
document.addEventListener('keydown',e=>{if(e.key==='Escape')close();if(e.key!=='Tab'||!wasOpen)return;const nodes=[...sidebar.querySelectorAll('a,button,select,input')].filter(n=>!n.disabled&&n.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
sync();
const existingEmail=document.createElement('button');existingEmail.type='button';existingEmail.textContent='Уже есть письмо или код';existingEmail.className='existing-email';existingEmail.addEventListener('click',()=>{document.querySelector('#code-form').hidden=false;document.querySelector('#code').focus();});document.querySelector('#login-form').after(existingEmail);
