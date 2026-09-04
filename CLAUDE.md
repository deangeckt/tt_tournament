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

## Deploying to GitHub Pages

The workflow (`.github/workflows/deploy.yml`) is already committed. It runs on push
to `main`, gates on `npm run lint` and `npm test`, then publishes `dist/`.

One-time setup, once the repo exists on GitHub:

```bash
git remote add origin git@github.com:<user>/<repo>.git
git push -u origin main
```

Then in the repo: **Settings → Pages → Source: GitHub Actions**. Nothing else to
configure — `base` is relative (see below), so any repo name or custom domain works.

Gating the deploy on the engine tests is deliberate: a tiebreak regression is
invisible until it produces a wrong ranking in front of a room full of players.

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
  a file you already have is a no-op rather than a pile of duplicates.
- **`src/share/shorten.ts`** — the one place data leaves the device without the user
  carrying it. A share url holds the whole tournament in its fragment, so shortening it
  means uploading that tournament to someone else's server: the exact property the
  fragment was chosen to protect. It is therefore never automatic — the user asks per
  link, and the sheet says plainly what it costs. Providers are tried in order because
  none promises uptime, and the only selection criterion is a permissive CORS header;
  that alone rules out is.gd, tinyurl and cleanuri, which work from a server and fail
  from a page with an unhelpful generic network error.

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

## Conventions

**RTL.** Never use `left`/`right`/`ml-`/`mr-`/`text-left`. Use Tailwind's logical
utilities (`ms-`/`me-`, `ps-`/`pe-`, `text-start`/`text-end`, `border-s`/`border-e`) so
RTL is a single `dir` attribute rather than a stylesheet fork.

**Bidi.** Any score, seed or digit pair goes through `<Score>` / `<Ltr>` in
`components/common/ui.tsx`. Unisolated, the bidi algorithm renders `11-9` as `9-11` in
an RTL paragraph — which reads as a wrong score, not a layout bug. This is the highest-
risk visual bug in the app.

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

**Editing.** Because the engine re-derives from source, almost everything is safe to
change mid-tournament. Only two operations are guarded: re-drawing (discards that
level's results) and removing a player who has already played (offer withdrawal
instead).

## Status

Working: the engine, the setup wizard with the illustrated format picker and duration
advice, saved roster, seeded draw, hand-editable draw, quick/detailed score entry, live
ITTF standings, round robin, single elimination, groups→knockout, multiple levels,
in-tournament editing, withdrawals, deleting a tournament (confirmed, with undo),
Hebrew/English RTL, player profiles (photo, career record, tournament history), share
links + QR + print/PDF, opt-in link shortening, JSON export/import from the settings
screen, and the doodle wallpaper.

Two things moved and are easy to look for in the wrong place: the **language toggle**
lives on the settings screen, not the header, and the **draw seed** is in the edit
sheet next to redraw and the manual draw, not on the tournament page.

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
