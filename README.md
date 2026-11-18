# Life Board

A diary-style planner that installs on your phone like an app: today's calendar, routines, tasks, goals and big deadlines.

- Static site served by GitHub Pages (`index.html`, `sw.js`, `manifest.webmanifest`, icons).
- Data and sign-in: Supabase project `life-board`. Each entry is one row in `public.docs`; row-level security keeps rows private to their owner.
- The key in `index.html` is Supabase's *publishable* key. It is designed to be public; access is controlled by the security rules on the database.

## Install on a phone
- **iPhone:** open the site in Safari → Share → Add to Home Screen.
- **Android:** open it in Chrome → ⋮ → Install app.

## Updating
Change the files, then bump `VERSION` in `sw.js` so installed copies pick up the new version.
