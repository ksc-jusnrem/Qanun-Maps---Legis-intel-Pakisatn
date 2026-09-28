# Supabase setup — sign-in for the Codex

> **Status (28 Sep 2026):** project `jusnrem-codex` (ref `epilcfzjrstrsregethd`,
> London) is created, the readers table and its RLS policies are applied, and the
> keys are in `assets/js/codex-config.js`. Remaining: step 3 (email confirmation and
> URL configuration), which is done in the Supabase dashboard.

Ten minutes, free tier, no card. Until step 4 is done the site behaves exactly as
it does now: no sign-in link appears anywhere and nothing breaks.

---

## What this does, and does not do

**Does:** establishes who a reader is, so the work can reach them when it changes —
revision notices, update briefings, and in time a licensing route.

**Does not:** gate anything. Every chapter, the Doctrine Register, the Table of
Authorities and search stay open, unregistered. There is no paywall behind this
account, and the account page says so on its face.

This matters for the project's own rules: an account that unlocks nothing must not
be described as an access control.

---

## 1. Create the project

1. **supabase.com** → sign in with GitHub → **New project**
2. Name `jusnrem-codex`, region **London (eu-west-2)** — closest to both Pakistan
   and the UK company, and keeps reader data in the UK/EU
3. Set a database password and keep it in your password manager
4. Free tier is sufficient: 50,000 monthly active users, 500 MB database

## 2. Create the readers table

**SQL Editor** → **New query** → paste and run:

```sql
create table public.readers (
  id          uuid primary key references auth.users on delete cascade,
  email       text,
  full_name   text,
  institution text,
  interest    text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.readers enable row level security;

-- A reader may read and write only their own row. Nobody can read the list.
create policy "read own"   on public.readers for select to authenticated
  using ((select auth.uid()) = id);
create policy "insert own" on public.readers for insert to authenticated
  with check ((select auth.uid()) = id);
create policy "update own" on public.readers for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin new.updated_at = now(); return new; end $$;

create trigger readers_touch before update on public.readers
  for each row execute function public.touch_updated_at();
```

**Row Level Security is what protects this data.** The anon key in the site is
public by design; RLS is why that is safe. Do not disable it.

## 3. Configure sign-in

**Authentication → Providers → Email**

- Enable **Email**
- Turn **Confirm email** ON
- Leave **Enable email provider sign-ups** ON

**Authentication → URL Configuration**

- **Site URL:** `https://jusnrem.digital`
- **Redirect URLs**, add all four:
  ```
  https://jusnrem.digital/account.html
  https://www.jusnrem.digital/account.html
  https://*-khurramchughtae-7654s-projects.vercel.app/**
  http://127.0.0.1:8767/account.html
  ```
  The third covers every Vercel preview of this project, e.g.
  `jusnrem-digital-codex-git-5a180e-khurramchughtae-7654s-projects.vercel.app`,
  so sign-in can be tested on a preview before it goes live. The last one
  lets sign-in be tested locally.

## 4. Put the keys in the site

**Project Settings → API.** Copy **Project URL** and the **anon / public** key into
`assets/js/codex-config.js`:

```js
window.CODEX_SUPABASE = {
  url: 'https://xxxxxxxxxxxx.supabase.co',
  anonKey: 'eyJhbGciOi...',
};
```

Both are **public by design and safe to commit.** The anon key is meant to be
shipped to browsers.

**Never put the `service_role` key in this file or anywhere in the repository.** It
bypasses Row Level Security. It belongs only in a server-side environment variable,
and nothing in the Codex needs it yet.

## 5. Test

```bash
python -m http.server 8767 --bind 127.0.0.1
```

Open `http://127.0.0.1:8767/account.html`, enter your address, and follow the link
in the email. You should return signed in, with your email and registration date
shown, and be able to save a name and institution.

---

## Email delivery — read this before inviting anyone

Supabase's built-in email is **rate-limited to a handful of messages per hour** and
is for development only. It is not adequate for a founding cohort.

Before inviting the 20–30 founding readers, connect a real SMTP provider under
**Authentication → Email Templates → SMTP Settings**. Resend, Postmark or SendGrid
all have free tiers sufficient for this volume. Sign-in links landing in spam is the
most likely way this fails in front of a senior audience.

Also rewrite the default email template — it says "Supabase". It should say Code,
Law and Capital and read like the rest of the work.

---

## When there is something to gate

Client-side checks are a convenience, never a control. `codex-auth.js` establishes
identity only; anyone can read the page source.

A real gate needs a server-side check. On Vercel that is a function under `/api/`
which verifies the JWT with the Supabase secret before releasing a file:

1. Move the gated artefact out of the public tree (e.g. `private/` with
   `.vercelignore`, or Supabase Storage with a private bucket)
2. `/api/download.js` reads the `Authorization` header, verifies the token against
   `SUPABASE_JWT_SECRET` (a Vercel environment variable, **not** committed), checks
   the reader's entitlement, and streams the file or returns 403

**Do not build this until there is an artefact worth protecting.** The PDFs do not
exist yet. Gating the HTML chapters would remove them from Google Scholar, break
citation resolution, and turn 27 MB of static pages into function invocations — for
no gain, since the same text is open beside it.

The publisher pattern is: **open text, licensed artefacts.**
