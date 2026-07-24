# SFL Command Center

Release 0.1 reorganizes the working single-file Command Center into a maintainable project without intentionally changing application behavior.

## Project structure

```text
index.html
css/
  main.css
  league-layer.css
  integrated-ui.css
  commissioner-center.css
js/
  01-legacy-core.js
  02-league-layer.js
  03-commissioner-center.js
  04-integrated-ui.js
  05-supabase-prospects.js
  06-supabase-rosters.js
supabase/
  migrations/
scripts/
  check-project.mjs
```

## Deploy through GitHub and Vercel

1. Create a branch named `refactor/release-0.1`.
2. Upload the contents of this folder to the repository root.
3. Commit the files.
4. Let Vercel create a preview deployment.
5. Confirm:
   - The opening screen loads.
   - Team switching still works.
   - Prospect Lab reports 348 Supabase prospects.
   - Rosters report 840 Supabase roster players.
   - Commissioner Mode opens.
   - Trade Center opens.
6. Merge the branch into `main` only after the preview passes.

## Supabase key

This release keeps the same browser-saved publishable key workflow from Phase 2. Never place a service-role or secret key in browser code.

## Local check

With Node.js installed:

```bash
npm run check
npm run serve
```

## Next refactor

After this release is verified, `js/01-legacy-core.js` can be separated into domain modules such as data fallback, navigation, prospects, rosters, contracts, trades, and free agency.
