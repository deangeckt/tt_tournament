# טורניר — Table Tennis Tournament Manager

A free, open-source web app for running table tennis tournaments at a club. Add the
competitors, let the app draw the tournament, tap in scores as matches finish, and
watch standings and brackets update live.

The interface is Hebrew-first (RTL) with an English toggle. The code, comments and
commits are in English.

**No backend, no accounts, no tracking.** It is a static site: everything lives in
your browser and the whole thing runs from GitHub Pages for free.

## Features

- **Four formats**, chosen per level from an illustrated picker: groups → knockout,
  round robin, single elimination, double elimination.
- **Levels** — one tournament holds several parallel competitions (A, B, C…). Players
  in different levels never meet.
- **A saved roster** of regular players, so you don't retype your club every week.
- **Random draw from a seed** that is stored and displayed. Anyone can replay the draw
  from that code and confirm it wasn't rigged.
- **Two scoring modes**, set per tournament: quick (`3:1`) or detailed
  (`11-9, 11-7…`). Detailed unlocks official point-ratio tiebreaks.
- **ITTF standings**, including the recursive tiebreak chain — match points,
  head-to-head, game ratio, point ratio, then a lot drawn deterministically from the
  seed. The table says which rule separated two level players.
- Walkovers, retirements and mid-tournament withdrawals, handled by the ITTF rules.

## Development

```bash
npm install
npm run dev       # local dev server
npm test          # engine unit tests
npm run lint
npm run build     # production bundle into dist/
```

### How it is put together

`src/engine/` is plain TypeScript with no React, no DOM and no user-facing strings, so
it is testable in isolation — and it is where nearly all the tests live.

The design decision everything else follows from: **a level's stored state is only
`{ playerIds, config, seed }` plus a map of results.** The draw, the group
assignments, the bracket shape, who advanced and every standings table are recomputed
by pure functions. Nothing structural is saved. Fixing a score in an early round just
re-derives everything downstream, and a share link never needs to carry the bracket.

The one thing derivation cannot fix on its own is a result recorded by players who are
no longer in that match — correct a quarter-final and the semi-final's stored result
describes a match that never happened. So every result also stores `playedBy`, and the
app flags such results instead of silently reassigning them.

```
src/engine/      types, seeded rng, draw, fixtures, standings, resolution
src/store/       IndexedDB persistence and app state
src/i18n/        he.ts / en.ts — English is the type source, so a missing
                 Hebrew key is a compile error
src/components/  UI
src/routes/      screens
```

### Deploying your own copy

Fork the repo, then set **Settings → Pages → Source: GitHub Actions**. Pushing to
`main` builds and publishes. The Vite `base` is relative, so it works under any repo
name without configuration.

## Status

Working today: the tournament engine, the setup wizard, the saved roster, the draw,
score entry and live standings for round robin, single elimination and
groups → knockout.

Still to come: double elimination (currently falls back to a single-elimination
bracket), share links and QR codes, table assignment, print sheets, and player history
across tournaments.

## License

MIT
