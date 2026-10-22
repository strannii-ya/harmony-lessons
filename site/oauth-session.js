/** Supabase PKCE + explicit session persistence. Only Supabase sessions are stored, never upstream provider tokens. */
export const OAUTH_SETUP_MESSAGE = 'Google-вход ещё не включён в Supabase. Нужна разовая настройка Google Client ID и Client Secret в Authentication → Sign In / Providers → Google.';
export const YANDEX_SETUP_MESSAGE = 'Яндекс-вход ещё не настроен. Владелец должен подключить custom:yandex в Supabase. Вход через Google работает отдельно.';
const PROVIDERS = Object.freeze({
  google: {id:'google', label:'Google', scopes:'openid email profile'},
  yandex: {id:'custom:yandex', label:'Яндекс', scopes:'login:email'}
});
function providerInfo(name) {
  if (!Object.hasOwn(PROVIDERS,name)) throw new Error('Неизвестный способ входа.');
  return PROVIDERS[name];
}
const LEGACY_SESSION = 'harmony.session';
const encode64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export async function pkcePair() {
  if (!globalThis.crypto?.subtle) throw new Error('Для входа откройте сайт по HTTPS в обычном браузере.');
  const verifier = encode64(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = encode64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  return {verifier, challenge};
}
export function authFailure(code, provider='google') {
  const label=PROVIDERS[provider]?.label || 'выбранный сервис';
  if (code === 'access_denied') return `Вход через ${label} отменён или аккаунт не приглашён. Начните вход заново и выберите аккаунт, которому выдан доступ.`;
  if (['provider_disabled','validation_failed','unsupported_provider','custom_provider_not_found'].includes(code))
    return provider==='yandex' ? YANDEX_SETUP_MESSAGE : OAUTH_SETUP_MESSAGE;
  if (['email_not_found','email_not_verified','provider_email_needs_verification'].includes(code))
    return 'Сервис не подтвердил подходящий адрес почты. Проверьте основной email аккаунта и приглашение в учебник.';
  return `Не удалось завершить вход через ${label}. Нажмите кнопку входа заново в этом браузере.`;
}
export const isTransientAuthError = e => e?.status === 0 || e?.status === 408 || e?.status === 429 || e?.status >= 500;
function sessionError(message='Сессия завершена. Войди снова.') { return Object.assign(new Error(message), {status:401, authExpired:true}); }
function storage(name) { try { return globalThis[name]; } catch { return null; } }
function get(store, key) { try { return store?.getItem(key) ?? null; } catch { return null; } }
function remove(store, key) { try { store?.removeItem(key); } catch { /* already unavailable */ } }
function set(store, key, value) {
  try { if (!store) throw new Error(); store.setItem(key, value); }
  catch { throw Object.assign(new Error('Браузер запретил сохранение входа. Разреши данные сайта или отключи «Запомнить на этом устройстве».'), {status:0}); }
}
function cleanCallback() {
  const url = new URL(location.href);
  for (const field of ['code','error','error_code','error_description','state']) url.searchParams.delete(field);
  if (/access_token=|refresh_token=|error=|error_code=/.test(url.hash)) url.hash = '';
  history.replaceState(null, '', url.pathname + url.search + url.hash);
}
export class AuthSession {
  constructor(config) {
    this.url = config.supabaseUrl?.replace(/\/$/, '');
    this.key = config.publishableKey;
    const project = this.url ? new URL(this.url).hostname : 'unconfigured';
    this.sessionKey = 'harmony.' + project + '.session';
    this.preferenceKey = this.sessionKey + '.remember';
    this.pkceKey = this.sessionKey + '.pkce';
    this.session = null;
    this.refreshing = null;
    this.epoch = 0;
    this.stopRefresh = null;
  }
  get remembers() { return get(storage('localStorage'), this.preferenceKey) === 'true'; }
  // The login form recommends persistence, but existing temporary sessions are never promoted silently.
  get rememberChoice() { return get(storage('localStorage'), this.preferenceKey) !== 'false'; }
  setRemember(value) {
    if (value) set(storage('localStorage'), this.preferenceKey, 'true');
    else { try { set(storage('localStorage'), this.preferenceKey, 'false'); } catch { remove(storage('localStorage'), this.preferenceKey); } }
    if (this.session) this.store(this.session);
  }
  store(input) {
    if (!input?.access_token || !input?.refresh_token) throw new Error('Нет действительной сессии. Войди заново.');
    const expires = Number(input.expires_at) || Math.floor(Date.now()/1000) + (Number(input.expires_in) || 3600);
    // Deliberately discard provider_token, provider_refresh_token, user metadata and all unknown fields.
    const session = {access_token:input.access_token, refresh_token:input.refresh_token, expires_at:expires, token_type:'bearer'};
    const target = this.remembers ? storage('localStorage') : storage('sessionStorage');
    set(target, this.sessionKey, JSON.stringify(session));
    remove(this.remembers ? storage('sessionStorage') : storage('localStorage'), this.sessionKey);
    remove(storage('sessionStorage'), LEGACY_SESSION);
    this.session = session;
  }
  clear() {
    this.epoch++;this.stopAutoRefresh();
    this.session = null;this.membership=null;
    remove(storage('sessionStorage'), this.sessionKey);
    remove(storage('localStorage'), this.sessionKey);
    remove(storage('sessionStorage'), LEGACY_SESSION);
    remove(storage('sessionStorage'), this.pkceKey);
  }
  saved() {
    const raw = get(storage('sessionStorage'), this.sessionKey) || get(storage('localStorage'), this.sessionKey) || get(storage('sessionStorage'), LEGACY_SESSION);
    try { const s = raw ? JSON.parse(raw) : null; return s?.access_token && s?.refresh_token ? s : null; }
    catch { this.clear(); return null; }
  }
  async ensureSession({force=false,rejectedToken=null}={}) {
    if (!this.session) throw sessionError();
    const fresh=s=>Number(s?.expires_at)>Date.now()/1000+60;
    if (!force && fresh(this.session)) return;
    if (!this.refreshing) {
      const epoch=this.epoch;
      const refresh=async()=>{
        if(epoch!==this.epoch || !this.session)throw sessionError();
        // Read after taking the cross-tab lock: rotating a stale refresh token can revoke a session.
        const saved=this.saved();
        if(saved)this.session=saved;
        if(epoch!==this.epoch || !this.session)throw sessionError();
        if(fresh(this.session)&&(!force||(rejectedToken&&this.session.access_token!==rejectedToken)))return;
        const previous=this.session;
        try {
          const next=await this.request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:previous.refresh_token}});
          if(epoch!==this.epoch || !this.session)throw sessionError();
          if(this.session.refresh_token===previous.refresh_token)this.store(next);
        } catch(e) {
          // A failed old request must never erase a newer session, or revive a logged-out one.
          const latest=this.saved();
          if(epoch===this.epoch&&latest&&latest.refresh_token!==previous.refresh_token&&fresh(latest)){this.session=latest;return;}
          if(epoch===this.epoch&&[400,401,403].includes(e.status)){this.clear();e.authExpired=true;}
          throw e;
        }
      };
      const locks=globalThis.navigator?.locks;
      this.refreshing=(locks?locks.request(this.sessionKey+'.refresh',refresh):refresh()).finally(()=>{this.refreshing=null;});
    }
    await this.refreshing;
  }
  startAutoRefresh(onExpired=()=>{}) {
    this.stopAutoRefresh();
    const env=globalThis,doc=env.document;
    if(!doc||!env.addEventListener)return;
    let busy=false,stopped=false;
    const check=async()=>{
      if(stopped||busy||!this.session||doc.visibilityState==='hidden'||env.navigator?.onLine===false)return;
      busy=true;
      try{await this.ensureSession();}catch(e){if(e.authExpired&&!this.session)onExpired(e);}
      finally{busy=false;}
    };
    const timer=setInterval(check,30000);timer.unref?.();
    for(const name of ['focus','online','pageshow'])env.addEventListener(name,check);
    doc.addEventListener('visibilitychange',check);
    this.stopRefresh=()=>{stopped=true;clearInterval(timer);for(const name of ['focus','online','pageshow'])env.removeEventListener(name,check);doc.removeEventListener('visibilitychange',check);};
    return this.stopRefresh;
  }
  stopAutoRefresh(){this.stopRefresh?.();this.stopRefresh=null;}
  async googleUrl(options={}) { return this.oauthUrl('google',options); }
  async yandexUrl(options={}) { return this.oauthUrl('yandex',options); }
  async oauthUrl(provider,{remember=false}={}) {
    const spec=providerInfo(provider);
    if (!this.url || !this.key) throw new Error('Подключение библиотеки пока не настроено.');
    if (provider==='google') {
      const config=await this.request('/auth/v1/settings');
      if (config?.external?.google !== true) throw new Error(OAUTH_SETUP_MESSAGE);
    }
    const redirectTo=location.origin+location.pathname;
    const {verifier,challenge}=await pkcePair();
    const url=new URL(this.url+'/auth/v1/authorize');
    url.search=new URLSearchParams({provider:spec.id,redirect_to:redirectTo,
      code_challenge:challenge,code_challenge_method:'s256',scopes:spec.scopes,
      ...(provider==='google'?{prompt:'select_account'}:{force_confirm:'yes'})}).toString();
    if (provider==='yandex') {
      // /settings lists built-in providers only. Probe our Auth server without
      // following its redirect. No provider token, email or session is sent.
      // An enabled provider gives an opaque redirect; a missing one gives JSON.
      let response;
      try { response=await fetch(url.href,{redirect:'manual',cache:'no-store',credentials:'omit',
        headers:{apikey:this.key},signal:AbortSignal.timeout(15000)}); }
      catch { throw new Error('Не удалось проверить Яндекс-вход. Проверьте интернет и повторите попытку.'); }
      if(response.type!=='opaqueredirect') {
        if ([400,404].includes(response.status)) throw new Error(YANDEX_SETUP_MESSAGE);
        if (response.status===429) throw new Error('Слишком много попыток входа. Повторите немного позже.');
        throw new Error('Сервис входа временно недоступен. Попробуйте ещё раз позже.');
      }
    }
    this.setRemember(remember);
    set(storage('sessionStorage'),this.pkceKey,JSON.stringify({verifier,redirectTo,startedAt:Date.now(),provider}));
    return url.href;
  }
  async restore() {
    const query = new URLSearchParams(location.search), hash = new URLSearchParams(location.hash.slice(1));
    const error = query.get('error_code') || query.get('error') || hash.get('error_code') || hash.get('error');
    if (error) {
      let provider='google';
      try { const value=JSON.parse(get(storage('sessionStorage'),this.pkceKey)||'null');if(PROVIDERS[value?.provider])provider=value.provider; } catch {}
      cleanCallback();remove(storage('sessionStorage'),this.pkceKey);throw new Error(authFailure(error,provider));
    }
    let pending; try { pending=JSON.parse(get(storage('sessionStorage'),this.pkceKey)||'null'); } catch { pending=null; }
    const code=query.get('code')||pending?.authCode;
    if (code) {
      cleanCallback();
      if (!pending || !/^[A-Za-z0-9_-]{43}$/.test(pending.verifier) || pending.redirectTo!==location.origin+location.pathname || Date.now()-pending.startedAt>600000 || !Number.isFinite(pending.startedAt) || pending.startedAt>Date.now() || typeof code!=='string' || code.length>4096 || (pending.provider!==undefined&&!Object.hasOwn(PROVIDERS,pending.provider))) {
        remove(storage('sessionStorage'),this.pkceKey);
        throw new Error('Вход начат в другой вкладке или истёк. Нажмите нужную кнопку входа здесь заново.');
      }
      set(storage('sessionStorage'),this.pkceKey,JSON.stringify({...pending,authCode:code}));
      try { this.store(await this.request('/auth/v1/token?grant_type=pkce',{method:'POST',body:{auth_code:code,code_verifier:pending.verifier}}));remove(storage('sessionStorage'),this.pkceKey); }
      catch(e) { if(isTransientAuthError(e))throw e;this.clear();throw new Error(authFailure(e.code,pending.provider||'google')); }
    } else if (hash.has('access_token')) {
      // Compatibility for the existing email-link flow; it still needs server-side identity and membership checks.
      cleanCallback();
      this.store({access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token'),expires_in:Number(hash.get('expires_in'))||3600});
    } else this.session=this.saved();
    if (!this.session) return null;
    try {
      const user=await this.identity();
      this.store(this.session);
      return user;
    } catch(e) {
      // A temporary network error must not destroy a valid remembered session.
      if (!isTransientAuthError(e)) this.clear();
      throw e;
    }
  }
}
