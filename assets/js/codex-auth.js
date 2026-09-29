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

// Supabase reports a failed or expired link in the URL (#error=...&error_description=...
// or ?error=...). Read it before the client initialises and cleans the address bar,
// so the account page can tell the reader why they are not signed in.
const AUTH_URL_ERROR = (() => {
  const params = new URLSearchParams(location.hash.slice(1) + '&' + location.search.slice(1));
  if (!params.get('error') && !params.get('error_code')) return null;
  return {
    code: params.get('error_code') || params.get('error'),
    message: (params.get('error_description') || params.get('error') || '').replace(/\+/g, ' '),
  };
})();

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
          // implicit flow: the link works even when opened in a different browser
          // or device from the one that requested it (PKCE would not)
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true,
                  flowType: 'implicit' },
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

  /** Turn Supabase's terse errors into something a reader can act on. */
  function explain(err) {
    const code = (err && (err.code || err.error_code)) || '';
    const msg = (err && err.message) || String(err || '');
    const m = (code + ' ' + msg).toLowerCase();
    if (m.includes('rate') && m.includes('limit') || err && err.status === 429)
      return 'Too many sign-in emails have been sent in the last hour. Please wait a few minutes and try again.';
    if (m.includes('signup') && m.includes('disabled') || m.includes('signups not allowed'))
      return 'New registrations are not open at the moment. If you already have an account, use the address you registered with.';
    if (m.includes('otp_expired') || m.includes('expired') || m.includes('invalid') && m.includes('token'))
      return 'That sign-in link or code has expired or has already been used. Request a new one below.';
    if (m.includes('redirect'))
      return 'This address is not yet allowed to receive sign-in links. The site administrator needs to add it under Supabase → Authentication → URL Configuration.';
    if (m.includes('failed to fetch') || m.includes('network'))
      return 'Could not reach the sign-in service. Check your connection and try again.';
    if (m.includes('email') && m.includes('invalid'))
      return 'That email address was not accepted. Check it and try again.';
    return msg || 'Unknown error';
  }

  /** Passwordless sign-in, which is also sign-up: a new address is registered on
   *  first use. Suits a scholarly readership: no password to manage, and it
   *  verifies the address, which is what a reader list actually needs. */
  async function sendLink(email, redirectPath) {
    const sb = await init();
    if (!sb) throw new Error('not-configured');
    const redirectTo = new URL(redirectPath || '/account.html', location.origin).href;
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });
    if (error) throw error;
  }

  /** The same email carries a six-digit code (when the template includes
   *  {{ .Token }}). Entering it avoids the two ways links fail: opening the email
   *  on another device, and institutional mail scanners that "click" the link
   *  first and use it up. */
  async function verifyCode(email, token) {
    const sb = await init();
    if (!sb) throw new Error('not-configured');
    const { data, error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw error;
    return data.session;
  }

  /** Run fn(event, session) whenever the sign-in state changes. */
  async function onChange(fn) {
    const sb = await init();
    if (!sb) return;
    sb.auth.onAuthStateChange((event, s) => setTimeout(() => fn(event, s), 0));
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
    const { data, error } = await sb.from('readers').select('*').eq('id', u.id).maybeSingle();
    if (error) console.warn('codex-auth: profile', error.message);
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
    const head = document.querySelector('.masthead') || bar;
    if (getComputedStyle(head).backgroundColor
        .replace(/\s/g, '').startsWith('rgb(35,59,44')) {
      box.classList.add('on-dark');
    }
    const base = location.pathname.includes('/code-law-and-capital/') ? '../' : '';
    bar.appendChild(box);

    const render = (u) => {
      if (u) {
        const e = esc(u.email || '');
        box.innerHTML =
          `<span class="who" title="${e}">${e}</span>` +
          `<a href="${base}account.html">Account</a>`;
      } else {
        box.innerHTML = `<a href="${base}account.html">Sign in</a>`;
      }
    };
    render(null);
    render(await user());
    onChange((_event, s) => render(s ? s.user : null));
  }

  function esc(t) {
    return String(t).replace(/[&<>"']/g, (ch) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountHeader);
  } else {
    mountHeader();
  }

  return { init, session, user, sendLink, verifyCode, onChange, signOut, profile,
           saveProfile, config, explain, esc, urlError: () => AUTH_URL_ERROR };
})();

window.CODEX_AUTH = CODEX_AUTH;
