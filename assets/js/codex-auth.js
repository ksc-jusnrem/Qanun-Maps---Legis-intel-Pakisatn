/*
 * Codex authentication.
 *
 * Deliberately client-side and dependency-light: the Codex is a static site with
 * no build step, and adding one to support a sign-in form would be a poor trade.
 * Supabase's JS client loads from a CDN and holds the session in localStorage.
 *
 * SECURITY NOTE, stated plainly: nothing here gates anything. The anon key below
 * is public by design and is safe to commit — it is protected by Row Level
 * Security on the Supabase side, not by secrecy. This file establishes IDENTITY
 * only. Any actual gate must be enforced server-side, by a function that verifies
 * the JWT before releasing a file. Client-side checks are a convenience for the
 * reader, never a control.
 */

// resolve vendor/ next to this file, whatever page (and folder) loaded it
const VENDOR_SRC = new URL('vendor/supabase.js', document.currentScript.src).href;

const CODEX_AUTH = (() => {
  let client = null;
  let ready = null;

  function config() {
    const c = window.CODEX_SUPABASE;
    if (!c || !c.url || !c.anonKey || c.url.startsWith('YOUR_')) return null;
    return c;
  }

  /** Load the Supabase client once, on demand. */
  function init() {
    if (ready) return ready;
    const c = config();
    if (!c) {
      ready = Promise.resolve(null);
      return ready;
    }
    ready = new Promise((resolve) => {
      const s = document.createElement('script');
      // served from this site, not a CDN: one less thing that can be slow or blocked
      s.src = VENDOR_SRC;
      s.onload = () => {
        client = window.supabase.createClient(c.url, c.anonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        });
        resolve(client);
      };
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
    return ready;
  }

  async function session() {
    const sb = await init();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session || null;
  }

  async function user() {
    const s = await session();
    return s ? s.user : null;
  }

  /** Passwordless sign-in. Suits a scholarly readership: no password to manage,
   *  and it verifies the address, which is what a reader list actually needs. */
  async function sendLink(email, redirectPath) {
    const sb = await init();
    if (!sb) throw new Error('not-configured');
    const redirectTo = new URL(redirectPath || '/account.html', location.origin).href;
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) throw error;
  }

  async function signOut() {
    const sb = await init();
    if (sb) await sb.auth.signOut();
  }

  /** Read the reader's own profile row. RLS restricts this to their own record. */
  async function profile() {
    const sb = await init();
    const u = await user();
    if (!sb || !u) return null;
    const { data } = await sb.from('readers').select('*').eq('id', u.id).maybeSingle();
    return data || null;
  }

  async function saveProfile(fields) {
    const sb = await init();
    const u = await user();
    if (!sb || !u) throw new Error('not-signed-in');
    const { error } = await sb.from('readers').upsert({ id: u.id, email: u.email, ...fields });
    if (error) throw error;
  }

  /* ---- masthead state, injected on every page that includes this file ---- */

  const CSS = `
.codex-acct{margin-left:1rem;font:500 .74rem/1 Aptos,"Segoe UI",system-ui,sans-serif;
  white-space:nowrap;display:inline-flex;align-items:center;gap:.5rem;padding:.55rem 0}
.codex-acct a{color:inherit;text-decoration:none;border-bottom:1px solid transparent}
.codex-acct a:hover{border-bottom-color:currentColor}
.codex-acct .who{max-width:14rem;overflow:hidden;text-overflow:ellipsis;opacity:.85}
.codex-acct.on-dark{color:#F4EFDE}
`;

  async function mountHeader() {
    if (document.querySelector('.codex-acct')) return;
    const bar =
      document.querySelector('.site-head .in') ||
      document.querySelector('.masthead nav') ||
      document.querySelector('.masthead .in') ||
      document.querySelector('.masthead form') ||
      document.querySelector('.masthead');
    if (!bar) return;

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const box = document.createElement('span');
    box.className = 'codex-acct';
    // chapter mastheads are the green band; everything else is cream
    if (getComputedStyle(document.querySelector('.masthead')).backgroundColor
        .replace(/\s/g, '').startsWith('rgb(35,59,44')) {
      box.classList.add('on-dark');
    }
    const base = location.pathname.includes('/code-law-and-capital/') ? '../' : '';
    box.innerHTML = `<a href="${base}account.html">Sign in</a>`;
    bar.appendChild(box);

    const u = await user();
    if (u) {
      box.innerHTML =
        `<span class="who" title="${u.email}">${u.email}</span>` +
        `<a href="${base}account.html">Account</a>`;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountHeader);
  } else {
    mountHeader();
  }

  return { init, session, user, sendLink, signOut, profile, saveProfile, config };
})();

window.CODEX_AUTH = CODEX_AUTH;
