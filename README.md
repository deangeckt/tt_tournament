# TT Tournament

A free, open-source web app for running table tennis tournaments at a club: add the
competitors, let the app draw the tournament, tap in scores as matches finish, and
watch standings and brackets update live.

 **No backend, no accounts, no tracking** — it is a static site, everything lives in your browser.

## Features

- Formats per level: groups → knockout, round robin, single elimination (double
  elimination is not implemented yet and falls back to single).
- Several parallel levels (A, B, C…) in one tournament.
- A saved roster of regular players, with photos, career records and past tournaments.
- Seeded random draw — the seed is stored and shown, so anyone can replay the draw —
  or arrange the draw by hand.
- Quick (`3:1`) or detailed (`11-9, 11-7…`) scoring.
- Live ITTF standings with the full tiebreak chain: match points, head-to-head, game
  ratio, point ratio, then a lot drawn from the seed.
- Walkovers, retirements and mid-tournament withdrawals.
- Editing anything mid-tournament: scores, players, the draw. Everything downstream
  re-derives, so correcting a group result on Sunday fixes the bracket it produced.
- Share a read-only link or QR code, or print the sheet as PDF. The whole tournament
  travels inside the link, so nothing is uploaded — unless you ask for a short link,
  which is made by an outside service and does upload it.
- Back up everything to one JSON file, and import it again on another device.

## Development

```bash
npm install
npm run dev       # local dev server
npm test          # engine unit tests
npm run lint
npm run build     # production bundle into dist/
```

`src/engine/` is plain TypeScript — no React, no DOM, no user-facing strings — and is
where nearly all the tests live. A level stores only `{ playerIds, config, seed }` plus
a map of results; the draw, bracket shape and every standings table are recomputed by
pure functions, so fixing an early score re-derives everything downstream.

```
src/engine/      types, seeded rng, draw, fixtures, standings, resolution
src/store/       IndexedDB persistence, app state, JSON backup
src/share/       share-link payload, printable summary, link shortening
src/i18n/        he.ts / en.ts
src/components/  UI
src/routes/      screens
src/assets/      the doodle wallpaper
```

## Deploying your own copy

Fork the repo, then set **Settings → Pages → Source: GitHub Actions**. Pushing to
`main` runs lint and tests, then builds and publishes. The Vite `base` is relative, so
it works under any repo name.

## License

MIT
