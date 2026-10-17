/** Supabase PKCE + opt-in session persistence. Only Supabase sessions are stored, never Google tokens. */
export const OAUTH_SETUP_MESSAGE = 'Google-вход ещё не включён в Supabase. Нужна разовая настройка Google Client ID и Client Secret в Authentication → Sign In / Providers → Google.';
const LEGACY_SESSION = 'harmony.session';
const encode64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export async function pkcePair() {
  if (!globalThis.crypto?.subtle) throw new Error('Для Google-входа открой сайт по HTTPS в обычном браузере.');
  const verifier = encode64(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = encode64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  return {verifier, challenge};
}
export function authFailure(code) {
  if (code === 'access_denied') return 'Google-вход отменён или выбранный аккаунт не разрешён. Нажми «Войти через Google» и выбери аккаунт владельца.';
  if (['provider_disabled','validation_failed','unsupported_provider'].includes(code)) return OAUTH_SETUP_MESSAGE;
  return 'Не удалось завершить Google-вход. Начни заново кнопкой «Войти через Google» в этом браузере.';
}
function storage(name) { try { return globalThis[name]; } catch { return null; } }
function get(store, key) { try { return store?.getItem(key) ?? null; } catch { return null; } }
function remove(store, key) { try { store?.removeItem(key); } catch { /* already unavailable */ } }
function set(store, key, value) {
  try { if (!store) throw new Error(); store.setItem(key, value); }
  catch { throw new Error('Браузер запретил сохранение входа. Разреши данные сайта или отключи «Запомнить на этом устройстве».'); }
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
  }
  get remembers() { return get(storage('localStorage'), this.preferenceKey) === 'true'; }
  setRemember(value) {
    if (value) set(storage('localStorage'), this.preferenceKey, 'true');
    else remove(storage('localStorage'), this.preferenceKey);
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
    this.session = null;
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
  async ensureSession() {
    if (!this.session) throw new Error('Войди в свой кабинет.');
    if (Number(this.session.expires_at) > Date.now()/1000 + 60) return;
    if (!this.refreshing) {
      const refresh = async () => {
        // Use a refresh another tab may have completed while this tab waited for its lock.
        const saved = this.saved();
        if (saved && Number(saved.expires_at) > Date.now()/1000 + 60) { this.session=saved; return; }
        if (saved) this.session=saved;
        try { this.store(await this.request('/auth/v1/token?grant_type=refresh_token', {method:'POST', body:{refresh_token:this.session.refresh_token}})); }
        catch(e) { if ([400,401,403].includes(e.status)) this.clear(); throw e; }
      };
      const locks=globalThis.navigator?.locks;
      this.refreshing=(locks ? locks.request(this.sessionKey+'.refresh', refresh) : refresh()).finally(()=>{this.refreshing=null;});
    }
    await this.refreshing;
  }
  async googleUrl({remember=false}={}) {
    const config = await this.request('/auth/v1/settings');
    if (config?.external?.google !== true) throw new Error(OAUTH_SETUP_MESSAGE);
    this.setRemember(remember);
    const redirectTo = location.origin + location.pathname;
    const {verifier,challenge} = await pkcePair();
    set(storage('sessionStorage'), this.pkceKey, JSON.stringify({verifier,redirectTo,startedAt:Date.now()}));
    const url=new URL(this.url+'/auth/v1/authorize');
    url.search=new URLSearchParams({provider:'google',redirect_to:redirectTo,code_challenge:challenge,code_challenge_method:'s256',scopes:'openid email profile',prompt:'select_account'}).toString();
    return url.href;
  }
  async restore() {
    const query = new URLSearchParams(location.search), hash = new URLSearchParams(location.hash.slice(1));
    const error = query.get('error_code') || query.get('error') || hash.get('error_code') || hash.get('error');
    if (error) { cleanCallback(); remove(storage('sessionStorage'),this.pkceKey); throw new Error(authFailure(error)); }
    const code=query.get('code');
    if (code) {
      let pending; try { pending=JSON.parse(get(storage('sessionStorage'),this.pkceKey)||'null'); } catch { pending=null; }
      cleanCallback();
      remove(storage('sessionStorage'),this.pkceKey);
      if (!pending || !/^[A-Za-z0-9_-]{43}$/.test(pending.verifier) || pending.redirectTo!==location.origin+location.pathname || Date.now()-pending.startedAt>600000 || !Number.isFinite(pending.startedAt) || pending.startedAt>Date.now() || code.length>4096)
        throw new Error('Вход начат в другой вкладке или истёк. Нажми «Войти через Google» здесь заново.');
      try { this.store(await this.request('/auth/v1/token?grant_type=pkce',{method:'POST',body:{auth_code:code,code_verifier:pending.verifier}})); }
      catch(e) { this.clear(); throw new Error(e.status===0 ? e.message : authFailure(e.code)); }
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
      if (e.status!==0 && !(e.status>=500)) this.clear();
      throw e;
    }
  }
}
