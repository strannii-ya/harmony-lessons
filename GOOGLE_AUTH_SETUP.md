# Google-вход: разовая настройка

Код поддерживает Google OAuth через Supabase с PKCE. Наличие кнопки не означает, что провайдер включён: перед переходом сайт проверяет `/auth/v1/settings`. Данные существующего пользователя не переносятся и не дублируются.

## Google Cloud / Google Auth Platform

1. В Google Cloud выберите или создайте отдельный проект, например `harmony-lessons`.
2. В Google Auth Platform настройте Branding (название приложения и контакт владельца), Audience: External. Для личного использования можно начать в Testing, добавив владельца в Test users. Список тестовых пользователей не заменяет контроль доступа в базе.
3. Data Access: только `openid`, `userinfo.email`, `userinfo.profile`. Не запрашивайте доступ к Gmail, Drive или Calendar.
4. Clients → Create client → Web application.
5. Authorized JavaScript origins:
   `https://strannii-ya.github.io`
6. Authorized redirect URIs (обратите внимание: адрес Supabase, НЕ GitHub Pages):
   `https://rfsupofzadtgrhjrtrbf.supabase.co/auth/v1/callback`
7. Сохраните Client ID и Client Secret в менеджере паролей. Не добавляйте их в этот репозиторий, Issues, Actions logs или чат.

## Supabase: проект harmony-lessons

1. Authentication → Sign In / Providers → Google (в другом варианте интерфейса: Providers → Google).
2. Включите Google и вставьте Client ID и Client Secret непосредственно в панель Supabase. Проверку nonce не отключайте.
3. Site URL и разрешённый Redirect URL:
   `https://strannii-ya.github.io/harmony-lessons/`
4. Сохраните. Пересборка сайта для этой настройки не нужна.

## Проверка владельцем

Откройте сайт в обычном Safari/Chrome, а не во встроенном браузере мессенджера. Нажмите «Войти через Google» и выберите тот же подтверждённый email, которому уже принадлежит библиотека. Supabase автоматически связывает подтверждённую OAuth identity с существующим пользователем с тем же email. Если библиотека не открылась, не создавайте второго владельца и не ослабляйте RLS — проверьте UUID и журнал Auth.

Критерии: 23 темы и упражнения доступны; заметка сохраняется; с включённым «Запомнить» новый запуск браузера восстанавливает сессию; выход удаляет сохранённую сессию; посторонний аккаунт не получает доступ. Полный реальный Google-вход должен быть проверен владельцем после настройки. CI проверяет синтетический PKCE-переход и UI, не логинится в Google.

## Обработка сессии

По умолчанию сессия хранится только в текущей вкладке. С галочкой «Запомнить на этом устройстве» используются localStorage и обновление сессии при запросах. Google provider tokens не сохраняются. Сессия всегда проверяется через Auth и таблицу members. Как и любое хранилище SPA, localStorage доступно JavaScript того же origin; публичные сторонние проекты на том же GitHub Pages origin должны быть доверенными. Пароли/секреты OAuth в клиенте отсутствуют.

Источники:
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/sessions/pkce-flow
- https://supabase.com/docs/guides/auth/auth-identity-linking
