# Private library and email login

The public website contains application code only. The 23 lessons and exercises live in Supabase, not in this repository or the Pages artifact.

`site/config.json` holds only the project URL and publishable API key. Never add a secret or service-role key to frontend files or CI.

## First login

The database allowlist is stored in `private.library_owner`. It accepts only the configured owner email. A first OTP request may create the account, but lesson ownership is assigned only after Auth verifies that email. RLS protects every public table; a different authenticated user still sees no library. The trigger enforces passwordless access and rejects all other signup addresses.

## One-time email settings

In Supabase Authentication / URL Configuration set the Site URL and an allowed redirect to `https://strannii-ya.github.io/harmony-lessons/`. Do not disable email confirmations.

For numeric codes, add `{{ .Token }}` to BOTH the Confirm signup and Magic link email templates. These settings are not editable through the currently available connector actions.

Until those one-time dashboard settings are updated, the app can also accept the original verification link copied from the email. It verifies the token hash directly with the same Supabase project; it never follows a user-supplied redirect. Paste that link only in the site's login form, never in a chat or public issue.

The built-in Supabase email sender is restricted to organization team addresses and rate-limited. Delivery and the owner's first real login must be verified separately; synthetic UI tests are not authentication tests.

## Mobile verification

The publish workflow tests 320, 375, 390, 768 and 1440 px in Chromium and 390 px in WebKit. Tests use synthetic fixtures only; private lessons and authentication credentials are never included in screenshots or CI artifacts. Production deploy requires all tests to pass.
