# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Hebrew-first (RTL) web app for running table tennis tournaments at a club: enter
competitors, draw the tournament, tap in scores, watch standings and brackets update.
Open source, deployed as a static site on GitHub Pages. **No backend, no accounts** —
everything lives in the browser.

UI language is Hebrew with an English toggle. Code, comments and commits are English.

## Commands

```bash
npm install
npm run dev            # dev server (Vite)
npm test               # engine unit tests, single run
npm run test:watch     # watch mode
npm run lint           # oxlint (not eslint)
npm run build          # tsc -b && vite build  → dist/
npm run preview        # serve the production build
```

Running a subset of tests:

```bash
npx vitest run src/engine/__tests__/standings.test.ts   # one file
npx vitest run -t "three-way cycle"                     # one test by name
```

Vitest only picks up `src/**/*.test.ts` and runs in the `node` environment — the
engine needs no DOM. There is no component-test setup yet; adding one means adding
jsdom and a `test.environmentMatchGlobs` entry in `vite.config.ts`.

## Architecture

### The decision everything else follows from

**A level stores only `{ playerIds, config, seed, manualOrder? }` plus a flat
`Record<MatchId, StoredResult>`.** The draw, group assignments, bracket shape, who
advanced and every standings table are recomputed by pure functions in
`src/engine/resolve.ts`. Nothing structural is saved.

This is why editing an early score is safe: change one map entry and the whole
downstream tree re-derives. It is also why a share link carries no bracket, and why a
stored seed lets anyone replay the draw and verify it wasn't rigged.

`manualOrder` is the one addition, and it obeys the same rule: it replaces the *draw
order*, the single list every fixture already derives from, so a hand-made draw needs
no second code path. `levelDrawOrder` reconciles it against the current players —
departed ids drop out, latecomers fall in at their seeded position — so it survives
roster edits rather than forcing a redraw.

Before adding state, ask whether it can be derived instead. It usually can. Career
records (`src/engine/stats.ts`) are derived the same way, from the tournaments
themselves, so correcting a score from three months ago corrects the record it made.

### The one thing derivation does not solve

A stored result can belong to players who are **no longer in that match** — correct a
quarter-final and the semi-final's stored result describes a match that never happened.
So `StoredResult` also records `playedBy: [PlayerId, PlayerId]`. `resolve.ts` compares
it against the freshly resolved participants and classifies each result as
`fresh | swapped | mismatched`; anything not fresh is **excluded from propagation and
standings** and surfaced to the user, never silently reassigned.

`swapped` (same two players, sides reversed) is kept distinct from `mismatched` because
it is the common case after a group correction reorders qualifiers, and the right fix
there is to flip the score rather than discard it.

This machinery is also what makes hand-editing a draw mid-tournament safe: match ids
are derived from level/stage/round/order, so rearranging players keeps every id and
simply leaves the affected results flagged instead of silently reattributed.

### One match type, four formats

`Slot` (in `types.ts`) is the keystone: a participant is a *reference*
(`player | bye | winnerOf | loserOf | groupRank | tbd`), not a player id. That is what
lets a single `Match` serve every format, and why groups→knockout composes cleanly —
the bracket's first round just references `{kind:'groupRank', groupId, rank}` and does
not care that groups exist.

Each format in `src/engine/formats/` is a fixture *generator*. Format only exists at
generation time; after the draw everything downstream is the same data structure.

Match ids must be **stable across recomputes** — results are keyed by them. They are
derived from level/stage/round/order, never from array position at render time.

### Engine boundaries

`src/engine/` is pure TypeScript: **no React, no DOM, no user-facing strings**. It
returns machine-readable codes (`TiebreakReason`, `ConfigProblem`) and the UI maps them
to i18n keys. Nearly all tests live here; that is intentional. `drawPlacements` returns
group and match *ids* rather than labels for exactly this reason.

### Getting data out

There is no backend, so leaving the device is a first-class feature with three shapes.
The first two never touch a server; the third does, and says so:

- **`src/share/payload.ts`** — one tournament, lz-compressed into a URL fragment
  (`#/v/<payload>`), decoded by the read-only `ViewShared` route. Because everything is
  derived, the payload is only source state; a played-out 24-player night is well under
  2KB. Photos are stripped on the way out (`slimForSharing`), which is also why a
  `Tournament` stores slim `{id,name}` player copies while the roster keeps the photo.
- **`src/store/backup.ts`** — everything, as one JSON file, exported/imported/shared
  from the settings screen. Import is keyed by id and merges by default, so re-importing
  a file you already have is a no-op rather than a pile of duplicates. It is also the
  one action that **reloads the page**: it rewrites records other screens are already
  holding — in `replace` mode, including the open tournament — and re-reading the store
  would refresh only the screen that asked. The confirmation is parked in
  `sessionStorage` (`stashImportSummary`) and picked up on the way back up, which works
  because hash routing lands the reload back on the settings screen.
- **`src/share/shorten.ts`** — the one place data leaves the device without the user
  carrying it. A share url holds the whole tournament in its fragment, so shortening it
  means uploading that tournament to someone else's server: the exact property the
  fragment was chosen to protect. It happens anyway, on open and without asking,
  because a link carrying a whole night is thousands of characters and that is unusable
  in the places these links actually go — a WhatsApp group, a printed sheet, a QR code
  someone reads off a screen. So there is no long/short choice to make and no button to
  press: the sheet shortens, and the note under the link says plainly that a copy went
  to an outside service. The long url is a **fallback**, not an option — it appears only
  when no shortener answered (with a "try again") or when the tournament is too large to
  shorten, and the note says which of those happened. Providers are tried in order
  because none promises uptime, and a candidate has to pass two tests. A permissive CORS
  header rules out is.gd, v.gd, ulvis.net and cleanuri, which work from a server and fail
  from a page with an unhelpful generic network error. The second test is what the *short*
  link does, and it is the one that is easy to miss because the API side looks perfect:
  the link has to 3xx straight to the tournament. da.gd and tinyurl pass on CORS and fail
  here — da.gd sends anything asking for `text/html` to its own landing page with the long
  url printed on it to click, and tinyurl's keyless `api-create.php` now mints links that
  land on a "deprecated" preview page. A link the recipient has to click twice is worse
  than no short link at all.

### Getting data back in

A club's nights are not all run on the same device — the tablet was charged, the phone
was not — and they all have to end up in one history. **`src/share/adopt.ts`** is the
way back: the read-only `ViewShared` screen offers to add the tournament it is showing
to this device.

What a link cannot carry is *this* device's idea of who its players are. Player ids are
minted per device, so the same person entered twice is two uuids, and a career record
keyed by id would be two half-records for one player. `planAdoption` therefore rewrites
the incoming tournament against the local roster — recognised by id, else by name
(case- and whitespace-insensitive, and no fuzzier than that) — and everyone else joins
the roster under the id they arrived with. A local player stands in for at most one
incoming player, so two people who share a name never collapse into one.

Rewriting ids is only safe because nothing derived depends on their *value*: the draw is
a seeded shuffle of `playerIds` and match ids come from level/stage/round/order, so a
1:1 rename preserves every match id — which is exactly what keeps the stored results
attached to their matches and out of the `stale` list. That is worth a test if this ever
changes; there is one.

The plan is computed before the button is pressed, not after, because "5 recognised, 3
added, replaces the copy already here" is what the manager needs while deciding. Only
the replacing case destroys anything, so only that case offers an undo.

### The tiebreak chain

`standings.ts` implements the ITTF chain: match points → head-to-head → game ratio →
point ratio → lot. Two things there are easy to get wrong and are load-bearing:

- **Restart on split.** When a criterion splits a tied group, each subgroup restarts
  the chain *from the top* against its own smaller candidate set — it does not continue
  down the chain. Getting this wrong produces standings that are wrong only in 3+ way
  ties, which is exactly when people scrutinise them.
- **Ratios are fractions compared by integer cross-multiplication**, never floats. An
  undefeated player has zero games lost; `won / 0` is `Infinity`, which compares equal
  to another undefeated player's `Infinity` and silently merges two distinct records.

Head-to-head is not a separate rule — it *is* match points computed over the mutual
matches of the tied players only.

The lot sorts both its seed input and the shuffled array, so a drawn tie depends only
on *who* is tied, not the order they happen to be listed in.

**Point ratio reads the data, never the entry mode.** Whether the tournament is set to
quick or detailed entry says how scores are *typed in*; whether a criterion can run is
decided by what was actually recorded, so `pointsUsable` asks only that every mutual
match carry per-game points. This is what lets one tie be given its points on its own
(see below) instead of the mode gating scores that are already stored.

A lot reports *why* it was reached. `lotPointsUnavailable` is the actionable one, and
it is deliberately narrow: some mutual match must be quick-entry **and** every other one
must already have points. One walkover among the tied players and no amount of typing
will make point ratio run, so that case stays a plain `lot` rather than sending the
manager off to enter scores that change nothing. Lot rows also carry `tieGroup` — the
dead heat itself — because the UI needs to name those players and find their matches
without re-deriving the tiers it took to get there.

**Breaking a tie is done where it is reported.** A club on quick entry only discovers it
needed game scores when the table says two players are level, long after those matches
were played. So `components/group/TiebreakSheet.tsx` lists exactly the matches blocking
point ratio and takes their game scores — the tournament stays on quick entry, and only
those matches change. Switching the whole night to detailed entry is still offered in
the hint text, but it is the larger lever and it does not do the work: those matches
would still have to be re-entered. The per-game inputs are shared with the score sheet
(`components/score/GameEntry.tsx`) so the two cannot drift into different validation.

## Conventions

**Theming.** Dark mode is a *choice*, not only a system setting: the resolved theme
lives in `<html data-theme>` and Tailwind's `dark:` variant is redefined against it
(`@custom-variant` in `index.css`), so there is no second source of truth to keep in
step. `store/theme.ts` keeps the *preference* (`system | light | dark`) apart from the
*resolved* value, and only the resolved one ever reaches CSS. An inline script in
`index.html` stamps it before the bundle loads, for the same reason the `dir` script is
there: otherwise every load flashes the wrong theme for a frame.

Keep the `--color-court-*` ramp complete. Tailwind silently **drops** a utility whose
colour is undefined, so a gap in the ramp is not a build error — it just leaves the
`dark:` classes that name it doing nothing, and dark mode wears the light-mode ring,
divider or text underneath. That is exactly what kept white edges on cards and made
several labels vanish before `300` and `800` were added.

**RTL.** Never use `left`/`right`/`ml-`/`mr-`/`text-left`. Use Tailwind's logical
utilities (`ms-`/`me-`, `ps-`/`pe-`, `text-start`/`text-end`, `border-s`/`border-e`) so
RTL is a single `dir` attribute rather than a stylesheet fork.

**Bidi.** Any score, seed or digit pair goes through `<Score>` / `<Ltr>` in
`components/common/ui.tsx`. Unisolated, the bidi algorithm renders `11-9` as `9-11` in
an RTL paragraph — which reads as a wrong score, not a layout bug. This is the highest-
risk visual bug in the app.

A pair that belongs to one player obeys the same rule: the games column is
won-then-lost, so `<Score a={gamesFor} b={gamesAgainst} sep=":" />` puts the games won
on the right in Hebrew, where the eye starts. Hence `sep` on `<Score>` rather than a
second component for colon pairs — one that would sooner or later forget to flip.

Isolation alone is not enough, though. `<Score a b>` takes `a` as the *first-named*
player — the one at the start of the row, which in Hebrew is the one on the **right** —
and in RTL emits the pair in visual order, so the number nearest a name is always that
player's. Printed `a`-then-`b` regardless of direction, A's score sits next to B's name
and every result looks reversed. Same reason the quick-entry buttons name their winner
and the walkover buttons dropped their arrows: nothing about who won should have to be
inferred from which side a glyph landed on.

**i18n.** `src/i18n/en.ts` is the type source; `he.ts` is typed as `Resources`, so a
missing or misspelled key is a **compile error**. Hebrew needs `_one/_two/_other`
plural suffixes, so English carries a `_two` variant it never selects, purely to keep
the key sets symmetric. Default language is Hebrew unless the user explicitly switched
— deliberately *not* derived from `navigator.language`, since plenty of Israeli clubs
run their browser in English.

**TypeScript.** `erasableSyntaxOnly` is on: **no `enum`, no `namespace`, no parameter
properties.** Use `as const` objects with a derived union. `verbatimModuleSyntax` means
type-only imports need `import type`. `noUnusedLocals`/`noUnusedParameters` are on.

**Feedback.** Every action should produce something the eye can catch: a toast (with
undo where the action is destructive), a card flash, an animated progress bar, or a
standings row that slides. Drive these from **the event that caused the change** — pass
a `flashKey` down, or key a component to remount — rather than an effect watching for a
changed prop.

**Touch.** Minimum 44px tap targets. `Button size="sm"` and `Chip` both carry
`min-h-11` for this reason; don't drop it. Tooltips are hover-only, so never put
information that is *required* to use a control in a tooltip alone.

**Tooltips.** Use `<Tooltip>`, never the native `title` attribute, and never both. With
both, the same control shows a styled bubble, the browser's black box a second later,
or one and not the other depending on how long the pointer rested — three controls as
far as the user is concerned. `Tooltip` keeps the label in the accessibility tree via a
visually hidden `aria-describedby` node, so dropping `title` costs nothing.

**Wallpaper.** The doodle background (`body::before` in `index.css`) is a CSS **mask**,
not a background image: only the artwork's alpha matters and the ink colour is the
layer's own `background-color`, so one file serves light and dark instead of needing a
second, inverted copy. `src/assets/doodles.webp` (~23KB) is derived from
`doodle.webp`, the 2048px master, which is not shipped — nothing imports it. Both
`ffmpeg` recipes are in the CSS comment; regenerate rather than hand-edit.

The art arrived as a 1.5MB JPEG whose white paper was never quite white. That noise is
invisible and was most of the file: it gives every empty pixel a slightly different
value, which is the worst case for any compressor. Flattening the paper to pure white
is what took the master to 106KB losslessly, and posterising the derived alpha to 8
levels is what takes the shipped tile to 23KB. Quantise to the *nearest* bucket, never
a bucket centre — an offset that lifts pure white off zero lays a faint wash over the
whole viewport, which is easy to miss and impossible to unsee.

**Logo.** The club emblem arrived as navy ink on white paper, which is the awkward
case: masking it to a single colour the way the wallpaper is masked would throw away
the flag's blue, and dropping the paper for transparency would leave the ink invisible
on a dark header. So the paper stays and the *square* goes — `scripts/make-logo.mjs`
cuts `logo.jpg` on the emblem's own ring (measured, not assumed: the artwork is a
couple of pixels off centre) and flattens the paper to pure white, giving a disc that
reads as a badge in both themes. `src/assets/logo.jpg` is the unshipped master, same
arrangement as `doodle.webp`; regenerate rather than hand-edit.

**Search.** The app is one indexable document and always will be: hash routing puts
every screen in the fragment, which browsers never send to a server. So the whole SEO
surface is `index.html`'s head plus what React renders — nothing here is per-route, and
adding a route does not add a page to be optimised.

Three consequences worth keeping straight. The head carries **absolute** urls
(`canonical`, `og:`, the JSON-LD `@id`s, and `public/sitemap.xml`) because those four
forbid relative ones; they are the only place the deployed origin is hard-coded, and the
Vite `base` stays relative so a fork still builds. `public/robots.txt` is ceremony under
github.io — crawlers read robots.txt from the *host root*, which belongs to the
user-pages repo — and is there for the day this gets its own domain. And the descriptive
copy lives in `<noscript>` and in **the home screen's empty state**, never in hidden
markup: storage is per-origin, so a crawler renders an empty roster every single time,
which makes the empty state both the first-time visitor's screen and the only one a
search engine sees. Text shown to crawlers and hidden from readers is cloaking; text
that happens to be what a newcomer needs is just the empty state doing its job.

`app.documentTitle` exists because a rendering crawler reads the *rendered* title. It
repeats what the static `<title>` says, in whichever language is on.

**Share card.** `public/og.jpg` (1200x630) is generated by `scripts/make-og.mjs` from the
logo master and the doodle mask, on the dark theme's own ground — same "regenerate, do
not hand-edit" arrangement as the logo and the wallpaper. It carries no text on purpose:
ffmpeg's `drawtext` does no bidi reordering, so any Hebrew in it would come out reversed
unless pre-flipped by hand against whichever font that machine happens to have. `og:title`
supplies the words, and the emblem already spells the club's name inside its ring.

**Editing.** Because the engine re-derives from source, almost everything is safe to
change mid-tournament — including adding a level, moving a player from one level to
another, and changing a level's format, all from the edit sheet. Only three operations
are guarded: re-drawing (discards that level's results), taking a player out of a level
that has already played — removing or moving them, same rule, offer withdrawal instead
— and removing a level that holds any stored result at all. That last guard counts
*stored* results rather than fresh ones: a level holding nothing but flagged results
looks unplayed to `view.played`, and deleting it would throw those results away with
nothing to undo from.

A player belongs to exactly one level, so moving and adding are one operation: the
pickers offer someone another level is already holding, labelled with that level, and
one tap moves them. Retyping a name that is on the roster does the same, which is what
stops the same person being entered into two levels at once.

## Status

Working: the engine, the three-stage setup wizard — details, then levels and their
players, then the illustrated format picker with duration advice *once per level*, so a
three-level night answers the format question three times and only the last one offers
Create. Levels are born in the players stage and nowhere else; the format stage walks
them, and the route step carries the walk so Back steps level by level.

Also working: saved roster, seeded draw, hand-editable draw, quick/detailed score entry, live
ITTF standings, round robin, single elimination, groups→knockout, multiple levels,
in-tournament editing (levels added, removed and re-formatted; players moved between
them), withdrawals, the tiebreak resolver (game scores for one dead heat, entered from
the standings table itself), light/dark/system theme, deleting a tournament (confirmed, with undo),
Hebrew/English RTL, player profiles (photo, career record, tournament history), share
links + QR + print/PDF, always-shortened share links, adopting a shared tournament into
this device's own history, JSON export/import from the settings screen, and the doodle
wallpaper.

Two things moved and are easy to look for in the wrong place: the **language and theme
toggles** live on the settings screen, not the header, and the **draw seed** is in the
edit sheet next to redraw and the manual draw, not on the tournament page.

Not built yet:

- **Double elimination** — `resolve.ts` currently falls back to a single-elimination
  bracket for it. The `Slot` union already has `loserOf`, so it is additive, but the
  losers-bracket drop mapping is genuinely intricate and deserves property tests
  (assert: no two players meet twice before the grand final; every non-champion has
  exactly two losses) rather than a hand-checked implementation.
- Table assignment queue. `Tournament.tableAssignments` exists and is still unused.
- Head-to-head is computed (`engine/stats.ts`) but nothing shows it yet.

## Gotchas

- **IndexedDB is per-origin, and a port is part of the origin.** Restarting the dev
  server on a different port presents an empty roster. That is not a bug.
- **Vite's watcher can miss bulk file rewrites** (`sed -i`, `perl -0pi`), leaving the
  dev server serving a stale transform of one file while the disk is correct. If a
  change refuses to appear, compare `curl localhost:<port>/src/path.tsx` against disk
  before debugging the code; the fix is restarting the dev server.
- **Hash routing is load-bearing.** GitHub Pages has no rewrite rules, so a real path
  would 404 on refresh. It also means a future share payload can ride in the fragment,
  which browsers never send to the server — a genuine privacy property, worth keeping.
