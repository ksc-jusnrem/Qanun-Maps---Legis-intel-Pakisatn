/*
 * Supabase project configuration.
 *
 * Both values below are PUBLIC by design. The anon key is meant to be shipped to
 * the browser; it is protected by Row Level Security on the Supabase side, not by
 * secrecy. It is safe to commit.
 *
 * Never put the SERVICE ROLE key here. That one bypasses Row Level Security and
 * belongs only in a server environment variable.
 *
 * To fill these in: Supabase dashboard -> Project Settings -> API.
 *   url     = Project URL
 *   anonKey = Project API keys -> anon / public
 *
 * Until they are set, the site behaves exactly as it does now: no sign-in link
 * appears, and nothing breaks. See SUPABASE-SETUP.md.
 */

window.CODEX_SUPABASE = {
  url: 'https://epilcfzjrstrsregethd.supabase.co',
  // publishable (browser-safe) key; RLS on public.readers is what protects data
  anonKey: 'sb_publishable_egT8Zx4Iu0XTRgdwEdkO8A_0-Gpk3jF',
};
