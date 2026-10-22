import { LibraryAPI } from './api.js';
// Login controls and the notebook use one session owner and one configuration request.
let pending;
export function getLibraryAPI(){
 if(!pending)pending=(async()=>{
  let response;
  try{response=await fetch('./config.json',{cache:'no-store',signal:AbortSignal.timeout(20000)});}
  catch{throw Object.assign(new Error('Не удалось загрузить настройки. Проверьте интернет и повторите попытку.'),{status:0});}
  if(!response.ok)throw Object.assign(new Error('Настройки сайта временно недоступны.'),{status:response.status});
  try{return new LibraryAPI(await response.json());}
  catch{throw Object.assign(new Error('Не удалось прочитать настройки сайта.'),{status:502});}
 })().catch(e=>{pending=null;throw e;});
 return pending;
}
