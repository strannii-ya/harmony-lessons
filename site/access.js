/** Owner UI only. Authorization and account binding are enforced by database policies and triggers. */
export const accessHTML = () => `<section class="page-heading"><h1>Доступ</h1><p class="access-lead">Добавьте email аккаунта друга в Google или Яндексе и отправь ему ссылку на учебник.</p></section>
<section class="access-panel" aria-labelledby="invite-title"><h2 id="invite-title">Добавить аккаунт</h2>
<form id="invite-form"><label for="invite-email">Email для входа</label><div class="invite-input-row"><input id="invite-email" type="email" inputmode="email" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="254" placeholder="friend@example.com" required><button type="submit" class="primary">Добавить</button></div></form>
<p class="access-help">Письмо не отправляется. Друг выбирает Google или Яндекс и входит с приглашённым email. Разные адреса считаются разными аккаунтами; @ya.ru и @yandex.ru здесь не заменяются автоматически. Уроки общие; заметки, избранное и прогресс у каждого свои.</p>
<p id="access-status" role="status" aria-live="polite"></p>
</section>
<section class="access-panel" aria-labelledby="share-title"><h2 id="share-title">Ссылка для друзей</h2><div class="invite-input-row"><input id="share-url" type="url" readonly aria-label="Ссылка на учебник"><button id="copy-share" type="button">Скопировать</button></div></section>
<section class="access-panel" aria-labelledby="members-title"><div class="access-list-heading"><h2 id="members-title">Приглашённые</h2><button id="refresh-access" type="button" aria-label="Обновить список приглашённых">Обновить</button></div><div id="access-list" aria-live="polite"></div></section>`;

export function mountAccess(root, api) {
  if (!api.isOwner) { root.textContent = 'Управление доступом доступно только владельцу.'; return; }
  root.innerHTML = accessHTML();
  const $ = selector => root.querySelector(selector);
  const form = $('#invite-form'), input = $('#invite-email'), list = $('#access-list'), status = $('#access-status');
  const alive = () => root.isConnected && form.isConnected;
  let rows = [], refreshTask = null;
  const say = message => { if (alive()) status.textContent = message; };
  $('#share-url').value = location.origin + location.pathname;
  function renderList() {
    list.replaceChildren();
    if (!rows.length) { const p = document.createElement('p'); p.className = 'access-empty'; p.textContent = 'Пока никого нет. Добавьте первый адрес выше.'; list.append(p); return; }
    for (const entry of rows) {
      const row = document.createElement('article'); row.className = 'access-person'; row.dataset.accessId = entry.id;
      const info = document.createElement('div'); info.className = 'access-person-info';
      const email = document.createElement('strong'); email.textContent = entry.email;
      const badge = document.createElement('span'); badge.className = 'access-badge' + (!entry.active ? ' revoked' : '');
      badge.textContent = !entry.active ? 'Доступ отключён' : entry.joined_at ? 'Доступ открыт' : 'Ожидает первого входа';
      info.append(email, badge);
      const action = document.createElement('button'); action.type = 'button'; action.dataset.accessToggle = entry.id;
      action.textContent = entry.active ? 'Отозвать доступ' : 'Вернуть доступ';
      action.setAttribute('aria-label', `${action.textContent}: ${entry.email}`);
      row.append(info, action); list.append(row);
    }
  }
  function refresh() {
    const task = (refreshTask || Promise.resolve()).catch(() => {}).then(async () => {
      if (!alive()) return;
      $('#refresh-access').disabled = true; list.setAttribute('aria-busy', 'true');
      try { const result = await api.listAccess(); if (alive()) { rows = result; renderList(); } }
      finally { if (alive()) { $('#refresh-access').disabled = false; list.removeAttribute('aria-busy'); } }
    });
    refreshTask = task;
    return task.finally(() => { if (refreshTask === task) refreshTask = null; });
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button'); button.disabled = true; say('');
    try {
      const email = input.value.trim().toLowerCase();
      const existing = rows.find(row => row.email === email);
      if (existing) { say(existing.active ? 'Этот аккаунт уже имеет доступ.' : 'Этот адрес уже в списке. Нажмите «Вернуть доступ» рядом с ним.'); return; }
      await api.inviteAccount(email);
      if (!alive()) return;
      input.value = ''; say('Доступ добавлен. Отправь другу ссылку на учебник.'); await refresh(); input.focus();
    } catch (error) {
      say(error.code === '23505' ? 'Этот адрес уже добавлен. Обнови список.' : error.message);
    } finally { if (alive()) button.disabled = false; }
  });
  list.addEventListener('click', async event => {
    const button = event.target.closest('[data-access-toggle]'); if (!button || button.disabled) return;
    const entry = rows.find(row => row.id === button.dataset.accessToggle); if (!entry) return;
    if (entry.active && !window.confirm(`Отозвать доступ у ${entry.email}? Его заметки и прогресс сохранятся.`)) return;
    button.disabled = true; say('');
    try { await api.setAccess(entry.id, !entry.active); say(entry.active ? 'Доступ отозван.' : 'Доступ восстановлен.'); await refresh(); }
    catch (error) { say(error.message); }
    finally { if (button.isConnected) button.disabled = false; }
  });
  $('#refresh-access').addEventListener('click', () => { say(''); refresh().catch(error => say(error.message)); });
  $('#copy-share').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('#share-url').value); say('Ссылка скопирована.'); }
    catch { if (!alive()) return; $('#share-url').focus(); $('#share-url').select(); say('Ссылка выделена — скопируй её из поля.'); }
  });
  refresh().catch(error => say(error.message));
}
