# Яндекс ID рядом с Google

Кнопка и адаптер userinfo реализованы. Настоящий вход требует регистрации приложения от имени владельца в Яндекс OAuth и настройки Custom OAuth Provider в панели Supabase. Без реквизитов приложения кнопка показывает сообщение о незавершённой настройке. Google остаётся независимым способом входа.

## Разовая настройка

1. В https://oauth.yandex.ru/ создайте **приложение для авторизации пользователей**, не приложение для доступа к API. Название: «Гармония — учебник». Веб-адрес: https://strannii-ya.github.io/harmony-lessons/ . Разрешение: только **Адрес электронной почты** (`login:email`). Доступ к письмам, диску, телефону и другим персональным полям не нужен.
2. В Supabase, проект harmony-lessons → Authentication → Sign In / Providers → **New Provider** → **Manual configuration (OAuth2)**. Не используйте Third-Party Auth, OIDC Discovery или OAuth Server.
3. Скопируйте Callback URL из формы Supabase в Redirect URI приложения Яндекса. Для этого проекта ожидаемый адрес: `https://rfsupofzadtgrhjrtrbf.supabase.co/auth/v1/callback`. Если панель показывает другой адрес, используйте её фактический Callback URL.
4. Сохраните приложение Яндекса. **Client ID и Client Secret вставляйте прямо в поля Supabase. Client Secret не публикуйте в GitHub и не присылайте в чат.**
5. Настройте провайдер:

| Поле | Значение |
|---|---|
| Identifier | `custom:yandex` |
| Name | `Яндекс` |
| Provider type | `OAuth2` |
| Client ID | Client ID приложения Яндекса |
| Client Secret | Client Secret приложения Яндекса |
| Authorization URL | `https://oauth.yandex.ru/authorize` |
| Token URL | `https://oauth.yandex.ru/token` |
| UserInfo URL | `https://rfsupofzadtgrhjrtrbf.supabase.co/functions/v1/yandex-userinfo?client_id=ВАШ_CLIENT_ID` |
| Scopes | `login:email` |
| PKCE | Включён |
| Email optional | Выключен: email обязателен |
| Attribute mapping | Не требуется |

В UserInfo URL замените `ВАШ_CLIENT_ID` на тот же публичный Client ID, что указан в отдельном поле; без кавычек и пробелов. Это не Client Secret и не OAuth-токен. Включите провайдер и сохраните настройки.

Site URL и разрешённый Redirect URL в Supabase остаются `https://strannii-ya.github.io/harmony-lessons/`. Повторный деплой после сохранения реквизитов не нужен: кнопка проверяет доступность провайдера при нажатии.

## Доступ к учебнику

Владелец по-прежнему входит через существующий Google-аккаунт. В «Доступ» добавляйте точный основной email, который передаёт аккаунт Яндекса. Разрешение на вход через провайдера не заменяет приглашение в учебник.

Разные email не объединяются автоматически. Gmail и Яндекс с разными адресами — разные пользователи и отдельный прогресс. Алиасы @ya.ru и @yandex.ru не нормализуются в списке приглашений. Привязка второго адреса к кабинету владельца этой доработкой не выполняется.

## Как устроена защита

Браузер использует Supabase PKCE и хранит только сессию Supabase. Обмен кода Яндекса и хранение Client Secret выполняет Supabase Auth. Проверка членства, отзыв доступа, личные заметки и избранное остаются под существующими RLS-политиками.

Небольшой `yandex-userinfo` преобразует ответ API Яндекса (`id`, `default_email`) в стандартные поля `sub`, `email`, `email_verified`. Он проверяет токен обращением только к `https://login.yandex.ru/info?format=json` и сверяет приложение по `client_id`. У функции нет ключей базы данных, доступа к урокам или возможности выпускать сессии. Она не пишет профили или токены в логи, запрещает токены в URL и отдаёт `Cache-Control: no-store`.

Для этой функции `verify_jwt=false` намеренно: полученный credential — токен Яндекса, а не JWT Supabase. Проверка этого credential выполняется внутри обработчика. Остальные функции и защита базы не меняются.

### Проверка email

API Яндекса не возвращает булево подтверждение произвольного контактного адреса. Поэтому нельзя безусловно присвоить `email_verified=true` любому `default_email`.

Адаптер принимает собственный почтовый адрес Яндекса, соответствующий логину (включая документированные доменные и точка/дефис алиасы), либо внешний адрес, который сам является логином аккаунта. Для регистрации внешнего email-логина Яндекс требует код из письма. Произвольный внешний адрес для связи/восстановления, не совпадающий с логином, отвергается: `email_verification_required`. Не ослабляйте эту проверку ради неподтверждённых адресов.

## Проверка перед использованием

Проверьте один приглашённый Яндекс-аккаунт на компьютере и телефоне. Должны работать возврат в курс, повторный вход, сохранение собственной заметки, выход и отказ неприглашённому аккаунту. Не создавайте тестовые реальные аккаунты и не запрашивайте письма из CI: проверки репозитория используют синтетические ответы. Реальное согласие пользователя в Яндексе не подменяется тестами.

## Документация

- Supabase Custom OAuth: https://supabase.com/docs/guides/auth/custom-oauth-providers
- Регистрация приложения: https://yandex.ru/dev/id/doc/ru/register-client
- OAuth Authorization Code и PKCE: https://yandex.ru/dev/id/doc/ru/codes/code-url
- API профиля: https://yandex.ru/dev/id/doc/ru/user-information
- Внешний email как подтверждаемый логин: https://yandex.ru/support/id/ru/authorization/lite
- Почтовые алиасы: https://yandex.ru/support/yandex-360/customers/mail/ru/web/preferences/about-sender/additional-addresses
