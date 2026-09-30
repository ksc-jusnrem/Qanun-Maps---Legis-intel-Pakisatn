# jusnrem.digital

A single page: the call for interest for **Code, Law and Capital** by Khurram
Chughtai, in its two editions (Global Edition; Pakistan Library Edition), with
the detailed-contents PDFs and a registration-of-interest form.

- `index.html`: the whole site (no build step).
- `downloads/`: the two call-for-interest PDFs (1 October 2026).
- Any other path redirects to `/`.

## Where registrations go

The form writes to the table `public.interest_registrations` in the Supabase
project **jusnrem-codex** (London). The page carries only the publishable key:
row level security and column grants allow the public to *insert* a
registration and nothing else, so nobody can read, change or delete them
through the site.

To see registrations: supabase.com → project jusnrem-codex → Table Editor →
`interest_registrations` (you can export to CSV from there).

The previous Digital Codex (chapters, search, authorities, map, doctrine
register) is preserved in git history and on the `codex-rebuild-2026-09` branch.
