# OpenRead — Free Online Book Reading Platform


CLICK FOR LIVE WEBSITE DEMO :- https://sudo-learner.github.io/OpenRead/

A starter version of OpenRead, built to deploy on **GitHub Pages only — no Vercel needed**.

Next.js + TypeScript + Tailwind, exported as a fully static site (`output: 'export'`),
with Supabase (free tier) handling auth, database, and file storage. GitHub Actions
builds and publishes it automatically every time you push to `main`.

## What's included (working, real code)
- Cyber-themed homepage with Trending / Popular / Recently Added / category rows,
  a "Why OpenRead" features section, and Self Improvement + Motivation collections
- Simple email + password login and sign-up (Supabase Auth), with the navbar
  showing your name and a Log out button once you're signed in
- Category browser (`/categories/?slug=Cybersecurity`)
- Global search (`/search/?q=...`) across title, author, and category
- Book upload (PDF/EPUB + cover) with admin-approval workflow
- PDF reader (`/reader/?id=...`) with page navigation, dark/sepia/light modes,
  reading-progress sync, keyboard shortcuts (← → to flip pages, Esc to close
  panels), and a "jump to page" box
- **Text-to-Speech** — reads the current page aloud using the browser's built-in
  voice (free Web Speech API, no key, no cost)
- **Dictionary lookup** — select any word in the reader, click Dictionary, get
  a real definition from a free public API
- **Translate** — select text, click Translate, opens Google Translate in a new
  tab with that text pre-filled (see note below on why it works this way)
- **Bookmarks** — save any page, jump back to it later
- **Notes & Highlights** — select text to save as a highlight, or jot a
  free-form note tied to the current page
- **Reading Lists** (`/lists`) — create named lists (public or private), add
  books to them from the reader's Notes panel
- **Reviews & Ratings** — 1–5 stars plus a comment, one per user per book,
  with a live average
- **Admin Panel** (`/admin`, admins only) — approve/reject pending uploads,
  view all books, promote/demote other users to admin, see site-wide stats
- Dashboard: continue reading, stats, your uploads
- **Installable as an app** — has a real web app manifest and icons, so
  desktop and mobile browsers offer to "install" it like a native app
  (see the dedicated section below for exact steps)
- Full Postgres schema with Row Level Security (RLS) for every table
- A GitHub Actions workflow that builds and deploys the site on every push

## Why routes look like `/reader/?id=...` instead of `/reader/123`
GitHub Pages only serves static files — there's no server to generate pages on
demand. So book pages use a query parameter (`?id=`) instead of a dynamic
`/reader/[id]` path, and everything renders in the browser with client-side
JavaScript, the same way a single-page app would. This also means there's no
`middleware.ts` for route protection — the dashboard, upload, and admin pages
check login state (and role, for admin) in the browser and redirect if
needed. That's a UX convenience only; the actual security boundary is
Supabase's Row Level Security, which applies no matter how someone reaches
your data.

## Install as an App (desktop and mobile)
Once your site is live at `https://sudo-learner.github.io/OpenRead/`, it works
as a real installable app — no app store, no separate download.

**On a computer (Chrome / Edge):**
1. Open your live site in the browser
2. Look for an install icon (⊕ or a small monitor icon) at the right end of
   the address bar — or open the browser's ⋮ menu and look for "Install OpenRead..."
3. Click it → OpenRead opens in its own window from then on, with a desktop/taskbar icon and no browser address bar

**On Android (Chrome):**
1. Open your live site
2. Tap the ⋮ menu → **"Add to Home screen"** or **"Install app"**
3. It now sits on your home screen and opens full-screen like any app

**On iPhone/iPad (Safari — this one's different, iOS doesn't support the same install prompt):**
1. Open your live site in Safari specifically (not Chrome)
2. Tap the Share icon (square with an arrow) → **"Add to Home Screen"**
3. It'll appear as an icon that opens full-screen, no Safari bar

If the desktop/Android install option doesn't appear, it usually means the
site hasn't redeployed with the manifest/icon files yet — check the
**Actions** tab shows a green run after your latest push, then hard-refresh
(Ctrl+Shift+R) the live site.

### Still no install option? Check these in order

1. **Confirm this update actually deployed.** Actions tab → latest run → green ✅. If it's not there yet, push first.
2. **Hard refresh** the live site (Ctrl+Shift+R / Cmd+Shift+R) — browsers cache manifests aggressively.
3. **Check the manifest is actually reachable:** open `https://sudo-learner.github.io/OpenRead/manifest.json` directly in a new tab. You should see raw JSON. A 404 here means something's misconfigured — tell me what you see.
4. **Check what Chrome itself thinks is wrong:** open DevTools (F12) → **Application** tab → **Manifest** (left sidebar). Chrome lists any installability errors directly here — this is the most reliable way to see the real reason. Screenshot this panel and send it to me if the install option still doesn't show; it'll tell us exactly what's missing instead of guessing.
5. **Where the install button lives varies by browser/OS** — sometimes it's a ⊕ icon directly in the address bar, sometimes it's tucked under the ⋮ menu as "Install OpenRead..." or "Cast, save, and share" → "Install page as app". If you don't see it in either spot but the Manifest panel in step 4 shows no errors, it should still install via ⋮ menu → "Save and share" → "Install page as app" (naming varies by Chrome version).

**Note if you ever rename the repo:** `public/manifest.json` has `/OpenRead/`
hardcoded into a few paths (this file isn't processed by the build the way
your code is, so it can't auto-adjust to `BASE_PATH` like everything else
does). If you rename the repo, update those paths in `manifest.json` to match.

## Making yourself an admin
Nobody is an admin by default. After signing up, run this once in Supabase →
SQL Editor (replace with your real username):
```sql
update public.profiles set role = 'admin' where username = 'your_username';
```
Then `/admin` will show the panel instead of "You don't have admin access."

## Why Translate opens a new tab instead of translating in-page
Real machine translation (Google Translate's actual API, DeepL, etc.) needs
either a paid plan or a backend server holding a secret API key — a static
GitHub Pages site has no server, so there's nowhere safe to keep that key.
Opening `translate.google.com` in a new tab with your selected text already
filled in gets you the same translation with zero cost and zero exposed
secrets. If you later want in-page translation, that requires adding a small
backend (see the AI features note below — same underlying constraint).

## About "AI features" (summaries, chat, recommendations)
These need a real language model API call, which means a secret API key.
A secret can only be kept safe on a server — and GitHub Pages, by definition,
has no server. Text-to-Speech and Dictionary lookup avoid this problem
because they're either fully built into the browser or use a free/keyless
API — nothing secret to protect. If you want true AI features later, the
clean path is: keep GitHub Pages for the frontend (no change needed), and
add a **Supabase Edge Function** (a small serverless function that lives
alongside your existing Supabase project) to hold the AI API key and make
those calls on the frontend's behalf. That's a separate, focused project —
happy to build it as its own step whenever you're ready.

## Not yet built (roadmap — add these next, one at a time)
- EPUB reader (use `epub.js` the same way `react-pdf` is used here)
- Follow system (table already exists in `supabase/schema.sql`, no UI yet)
- Notifications, reading streaks/goals
- Touch gestures for mobile page-turning
- True AI features — see note above

Build these the same way you built EasyToLearn in stages — one feature, tested, then the next.

---

## Part 1 — Set up Supabase (free tier)

1. Go to https://supabase.com → **New project**. Pick a name and a strong database password (save it).
2. Go to **SQL Editor → New query**, paste the entire contents of `supabase/schema.sql`, click **Run**.
   - Already ran this before? Just run `supabase/migration_add_list_and_admin_policies.sql`
     instead — it only adds the new Reading Lists / Admin policies, nothing else.
3. (Optional) Run `supabase/seed_books.sql` to add 10 real Self Improvement /
   Motivation book listings so your homepage isn't empty. See the comments at
   the top of that file — they're catalog entries without attached files
   until you upload the real ones yourself.
4. Go to **Storage** → create two buckets: `books` and `covers`. Set both to **Public**.
5. Go to **Authentication → Providers** — Email is on by default, and that's all this starter uses. No need to touch Google/GitHub providers.
6. Go to **Project Settings → API** and copy the `Project URL` and `anon public` key — you'll need these twice (local `.env.local` and GitHub Secrets, below).

## Part 2 — Run it locally first

```bash
cd openread
npm install
cp .env.example .env.local
# paste your Supabase URL and anon key into .env.local
npm run dev
```

Open http://localhost:3000. Test the flow:
1. Sign up with email → confirm via inbox → log in.
2. Go to `/upload`, upload a PDF — it lands as "pending".
3. In Supabase Table Editor → `books` table, change that row's `status` to `approved`.
4. Refresh the homepage — the book appears. Click it to open the reader.

## Part 3 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial OpenRead scaffold"
git branch -M main
git remote add origin https://github.com/<your-username>/openread.git
git push -u origin main
```

## Part 4 — Turn on GitHub Pages (via GitHub Actions — this replaces Vercel)

1. On your repo: **Settings → Pages → Build and deployment → Source** → select **GitHub Actions**.
2. **Settings → Secrets and variables → Actions → New repository secret**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (The workflow at `.github/workflows/deploy.yml` reads these automatically.)
3. **Important:** in `.github/workflows/deploy.yml`, the line `BASE_PATH: /openread` must match your actual repo name exactly (with the leading slash). If you rename the repo, update this line.
   - Exception: if your repo is named `<your-username>.github.io` (a *user* page, not a project page), delete the `BASE_PATH` line entirely — user pages are served from the domain root.
4. Push to `main` (or re-run the workflow from the **Actions** tab). Watch it build under the **Actions** tab.
5. Once it finishes, your site is live at:
   - `https://<your-username>.github.io/openread/` (project page), or
   - `https://<your-username>.github.io/` (user page)

## Part 5 — Point Supabase auth at your live URL

Go to Supabase → **Authentication → URL Configuration**:
- Set **Site URL** to your GitHub Pages URL.
- Add the same URL (and `http://localhost:3000` for local testing) to **Redirect URLs**.

This matters for email confirmation links — Supabase uses the Site URL to build the "confirm your email" link it sends out.

## Part 6 — (Optional) Custom domain, still 100% GitHub

1. In your repo, add a `public/CNAME` file containing just your domain, e.g. `openread.yourdomain.com`.
2. At your domain registrar (or Cloudflare, like you did for bharatdarsanamtravels.com), add a CNAME record pointing your subdomain to `<your-username>.github.io`.
3. In **Settings → Pages**, GitHub will detect the CNAME and issue an HTTPS certificate automatically.
4. Update Supabase's Site URL/Redirect URLs to the custom domain.

---

## Making changes after this is live
Every time you `git push` to `main`, the GitHub Actions workflow rebuilds and
redeploys automatically — no manual steps, no Vercel dashboard. You can watch
progress under the **Actions** tab of your repo.

## Notes on scale and safety
- All data access is protected by Postgres Row Level Security — even though the `anon` key is public by design, users can't read each other's private notes/progress or unapproved books.
- Supabase's free tier is enough for a personal project or small user base; if sudo.learner sends this real traffic, you'll eventually need to upgrade the Supabase plan for more storage/bandwidth (GitHub Pages hosting itself stays free either way).
- Book uploads should be things you have the right to share (your own notes, public-domain books, or content you have permission for) — hosting copyrighted books without permission is a legal risk for any platform, not just a technical one.
