import { handler } from './handler.js';
// Supabase Auth passes a Yandex bearer credential; handler validates it with Yandex.
// It is not a Supabase JWT. No service-role key or session minting is used here.
Deno.serve((request: Request) => handler(request));
