# TT Tournament — ניהול תחרויות טניס שולחן

**[Live site](https://deangeckt.github.io/tt_tournament/)**

A free, open-source web app for running table tennis tournaments at a club: add the
competitors, let the app draw the tournament, tap in scores as matches finish, and
watch standings and brackets update live.

בעברית: אפליקציה חינמית לניהול תחרות טניס שולחן — הגרלת בתים ונוק-אאוט, הזנת תוצאות
וטבלאות דירוג חיות לפי חוקי ITTF. נבנתה עבור
[דרך בן — טניס שולחן חיפה](https://www.facebook.com/p/%D7%97%D7%95%D7%92%D7%99-%D7%98%D7%A0%D7%99%D7%A1-%D7%A9%D7%95%D7%9C%D7%97%D7%9F-%D7%91%D7%97%D7%99%D7%A4%D7%94-%D7%95%D7%94%D7%A6%D7%A4%D7%95%D7%9F-61564986761748/),
ופתוחה לשימוש כל מועדון.

 **No backend, no accounts, no tracking** — it is a static site, everything lives in your browser.

## Features

- **Three formats, chosen per level** — groups then a knockout, a round robin, or a
  straight knockout. The app recommends one for the size of the field, and each card
  shows the match count, the matches every player is guaranteed, and an estimate in
  hours from the number of tables. (Double elimination is not built — see Limitations.)
- **Several levels in one evening** — A, B and C side by side, each with its own format
  and match length. A player belongs to exactly one level, so entering the same name in
  a second level moves them rather than cloning them.
- **A draw anyone can replay** — the seed is stored and shown, so the draw can be re-run
  and checked. Or arrange the groups and the opening pairings by hand.
- **TTTM ranking points** — typed in, searched for by name, or read off a pasted link,
  bringing the league photograph with them. Given ranks the draw is *banded*: players of
  a similar standard meet each other, which is the opposite of championship seeding and
  deliberately so. Ranks are frozen onto the tournament at the draw, so a revision later
  in the season never rearranges a night already played.
- **A planned running order** — in a fully ranked group the match that decides
  qualification is played last (ITTF 3.7.5.5), nobody plays two matches in a row, and
  every batch in the list can go on the tables at the same time.
- **A consolation event** (בית ניחומים) — everyone the main draw eliminates plays a
  second competition in the same format, drawn from the same frozen ranks. On by default
  wherever anybody goes out; one tap turns it off.
- **Quick or detailed scoring** — `3:1`, or `11-9, 11-7…` game by game with live
  validation. Walkovers, and an undo on every change.
- **Live ITTF standings** with the full tiebreak chain: match points, head-to-head, game
  ratio, point ratio, then a lot drawn from the seed — restarting from the top whenever a
  criterion splits a tie. When a tie falls to a lot only for want of game scores, exactly
  those matches can be filled in from the table itself.
- **Edit anything mid-tournament** — scores, players, levels, formats, the draw.
  Everything downstream re-derives, so correcting a group result on Sunday fixes the
  bracket it produced, and a result whose players are no longer in that match is flagged
  rather than silently reassigned.
- **A saved roster** of regular players with photos, ranking points, career records and
  tournament history, all derived from the tournaments themselves.
- **Share and print** — a read-only link carrying the whole tournament inside it, a QR
  code, a plain-text summary for WhatsApp or email, and print to PDF, with the knockout
  drawn as a tree or listed as cards.
- **Backup and adoption** — everything to a single JSON file and back, and a tournament
  arriving in a share link added to this device's history, recognising players you
  already have by name.
- **Hebrew and English**, full RTL, light/dark/system themes, sized for a phone.

## Limitations

Worth knowing before a club night depends on it. The app says all of this in Hebrew on
its אודות screen.

- **Everything is stored in one browser.** No account, no server, no sync. Another
  browser, another phone or a private window is a different and empty copy, and clearing
  site data erases it — keep an exported backup.
- **A shortened share link is made by an outside service.** The full link keeps the
  tournament in the URL fragment, which a browser never sends anywhere; shortening it —
  which happens automatically, because the full link is far too long to paste into a
  chat — does upload it. A very large tournament cannot be shortened, and past a point
  cannot be shared as a link at all.
- **Ranking lookups go through a relay**, since tttm.co.il sends no CORS header. It is
  rate-limited to about twenty requests a minute. The league's own search matches one
  word against one name field, so search by surname.
- **Double elimination is not implemented.** Its card in the format picker is locked;
  without that, `resolve.ts` runs the level as a single elimination.
- **A mid-match retirement is entered as a walkover.** `MatchResult` carries `retired`
  and `doubleForfeit` and the engine tallies both, but no UI writes them.
- **Marking a player withdrawn** strikes their group results under the ITTF rule and
  crosses them out. It does not create walkovers for the matches they leave behind.
- **Tables are counted, not assigned.** `tableCount` sizes "up next" and the duration
  estimate; `Tournament.tableAssignments` exists and is unused.
- **No offline install.** There is no service worker or manifest, so the page itself has
  to load from the network. Running the evening afterwards does not.

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
src/share/       share-link payload, printable summary, link shortening, adoption
src/tttm/        TTTM ranking lookup: pure parser + the relayed fetches
src/i18n/        he.ts / en.ts
src/components/  UI
src/routes/      screens
src/assets/      the doodle wallpaper
```

## Deploying your own copy

Fork the repo, then set **Settings → Pages → Source: GitHub Actions**. Pushing to
`main` runs lint and tests, then builds and publishes. The Vite `base` is relative, so
it works under any repo name.

Four things do carry the original's absolute url and are worth editing in a fork: the
`canonical`, `og:` and JSON-LD urls in `index.html`, and `public/sitemap.xml`. The
share card at `public/og.jpg` is generated — `node scripts/make-og.mjs`, needs ffmpeg.

## License

MIT
