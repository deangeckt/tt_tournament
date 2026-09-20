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
npm run night          # play a ranked club night end to end and print its score sheet
npm run lint           # oxlint (not eslint)
npm run build          # tsc -b && vite build  → dist/
npm run preview        # serve the production build
```

Running a subset of tests:

```bash
npx vitest run src/engine/__tests__/standings.test.ts   # one file
npx vitest run -t "three-way cycle"                     # one test by name
```

`rankedNight.test.ts` is the one end-to-end test: it freezes ranks the way the wizard
does, derives two levels, then plays them by repeatedly taking whatever sits at the
head of "up next" — so it exercises the running order the way the screen does rather
than asserting it in the abstract. `npm run night` prints the night it played; the
runner swallows `console.log`, so the score sheet goes straight to stdout and only
when asked for (`npm_lifecycle_event`, or `TT_SCORESHEET=1`).

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

`manualOrder` is the one addition that obeys the same rule: it replaces the *draw
order*, the single list every fixture already derives from, so a hand-made draw needs
no second code path. `levelDrawOrder` reconciles it against the current players —
departed ids drop out, latecomers fall in at their seeded position — so it survives
roster edits rather than forcing a redraw.

`Level.ranks` is the addition that **breaks** the rule, and the exception is the point.
A player's TTTM ranking points live on the roster record, outside any tournament, and
the league revises them every week. A draw derived from the live value would mean
refreshing a rank in March silently rearranging January's bracket — new match ids, and
every result in it thrown onto the stale pile. So the numbers a level was drawn against
are copied onto the level and frozen there. Absent — every night before this existed,
and every club that does not use TTTM — means the plain shuffle, unchanged.

`src/store/ranks.ts` owns the three rules for when that copy may be written, and each
one is a bug avoided rather than a preference. A number already on the level is never
overwritten: that is the freeze. A level with no ranks at all is never retro-fitted,
because switching one on would band a draw people are already playing — so **drawing
again** is the way in, and the way a tournament started before anyone had a rank begins
using them. And a latecomer is given their rank only while the level holds **no stored
result**: ranks arrive at all sorts of moments, and topping one up afterwards would
re-sort the band order under results already keyed to the seats the old order produced,
flagging every score in the level from an edit as unrelated as marking someone
withdrawn. Before the first result a redraw is free and there is nothing to detach.

The freeze is why `adopt.ts` has to rewrite the keys of `ranks` along with every other
player id: a map still keyed by the sender's ids would draw an unranked field on the
receiving device and detach every stored result from its match. There is a test.

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

### The banded draw

Given ranks, the draw stops being flat and becomes **banded**: the field is sorted by
points and arranged so players of one standard meet each other. Group A is the top four,
group B the next four; round one of a bracket pairs rank neighbours. This is the
*opposite* of championship seeding, and deliberately so — a club night is judged on
whether the matches were worth playing, not on whether the two best met in the final.

The generators were not touched to do it. `snakeIntoGroups` exists to *spread*
consecutive draw positions across groups and `bracketSeedOrder` pairs best-with-worst;
rather than give either a second mode, `bandedGroupOrder` and `bandedBracketOrder`
**invert** them — they work out which seats each group or pairing will be handed, and
drop a band on those seats. So there is still one code path from the draw order down,
and `manualOrder`, `drawPlacements` and the hand-editable draw all keep working
untouched. Byes still go to the strongest, which is the one half of standard seeding
worth keeping.

The seed still decides everything the ranks do not: who among the unranked goes where,
and how players level on points are ordered. `rankedOrder` shuffles *before* it sorts
for exactly this reason — `sort` is stable, so equal ranks would otherwise keep the
order they arrived in, which is the roster's Hebrew alphabet.

One consequence worth surfacing rather than hiding, and the edit sheet says it: in a
field where everyone is ranked, the ranks settle the draw between them and "draw again"
reproduces it.

### The running order

Ranks do one more thing after the draw: they put the matches in order. A group where
every player carries one is played to a plan (`src/engine/schedule.ts`) instead of in
the order the circle method happened to generate them, and the plan answers to ITTF
3.7.5.5 — the match that decides qualification is played **last**, so the final pair on
the table can never arrange a scoreline that suits them both. With one qualifier that
is seeds 1 and 2; with two it is seeds 2 and 3, the top and the bottom being expected
to have settled their own fate already. Past two qualifiers the regulation says nothing
and neither does this.

The rest is about the night running well rather than about the rules: nobody plays two
matches in a row, and every batch in the list can go on the tables at the same time.
Both fall out of searching over the circle method's *rounds* rather than over the
matches. Within a round no two matches share a player, so a repeat can only happen
across a round boundary — which leaves the first and last match of each round the only
choices that matter, and turns fifteen factorial arrangements for a group of six into a
short walk over five rounds. From five players up that walk finds a plan with no repeat
in it at all. Three and four players cannot: both force exactly two, and where a repeat
is forced it is handed to the weaker seed, who is the likelier to have just lost. A test
brute-forces every ordering of a group of three and of four and agrees on the two.

**The plan never touches a match id.** Ids keep the coordinates the *draw* gave them,
and that is what makes the feature safe to have at all: turning it on halfway through a
night, improving the algorithm in a later version, or a rank arriving that makes a group
eligible, each leave every stored result attached to its match. So `round` and `order`
on a group match say where it sits in the running order while its id says where the draw
put it, and the two are free to disagree.

It is gated on ranks because without them the seeds are draw positions out of a shuffle:
"the top two play last" is a claim about the field's strength, and calling a shuffled
position seed 1 would make it mean nothing. A group holding one unranked player keeps
the draw order, and the gate is per group — half a group stage can be planned and half
not.

`schedule.ts` owns the circle method itself, in seat numbers, because the generator
reads it as players and the planner reads it as seeds, and one implementation is better
than two that drift. A league that publishes its own order can hand it in as config, and
it wins over anything generated; none ships, because the tables circulating for groups of
four and up could not be verified against the current handbook, and a wrong "official"
order is worse than an honest generated one.

### The consolation

A club night used to end early for most of the room: eight of sixteen are out after the
group stage, half a knockout field plays one match. **בית ניחומים** picks those players
up and runs them through the same format the main draw used, and the whole feature is
one optional boolean — `config.consolation` on the two formats that eliminate anybody.
A round robin never does; double elimination's losers bracket already is one.

**It is on by default**, and `advisor.ts`'s `defaultConfig` is the single place that
decides so — the wizard's recommendation and the picker's cards both go through it,
because two copies of a default disagree eventually. The reasoning is the banded draw's:
a club night is judged on whether the matches were worth playing, and a default of off
sends half the room home after one match unless someone finds the switch. **Absent still
means off**, so nothing retro-fits a level that was already drawn — here, or one that
arrives in a share link from a device running an older build.

The idea that makes it cheap: **a consolation is a derived sub-draw of the same level.**
`resolveLevel` builds a synthetic `Level` whose `playerIds` are the losers, whose config
is the same format scaled to that field, and whose seed is `` `${seed}:c` ``, then hands
it to `buildFixtures` — the *same* pipeline, under an id prefix of its own (`L1:c:g0`,
`L1:losers:r0:m0`). That buys the banded draw, the ITTF running order, group standings,
the tiebreak chain, bye padding and `repairGroupClashes` without touching a single
generator. `Match.consolation` and `Group.consolation` mark what came back; they are
derived, never stored. `formats/consolation.ts` is the whole of it.

Two things had to be decided rather than inherited, because the two formats eliminate
people at different moments:

- **Groups then knockout.** The group stage *is* the elimination event, so its
  non-qualifiers are known all at once and run a full groups→knockout of their own
  alongside the main bracket. Players knocked out of the main bracket are done — a
  consolation whose groups are already drawn cannot take latecomers.
- **Single elimination.** Losers arrive in waves, so the consolation is a staggered
  bracket fed by `loserOf` — a slot that had been in the `Slot` union, resolved by
  `resolve.ts`, and generated by nothing, since before this landed. It takes losers from
  every round **but the final**: the runner-up keeps second place rather than going down
  for a second prize. `n - 2` entrants, `2n - 4` matches for the night.

Byes need no code at all, which is the nicest thing about building on `loserOf`: a match
won on a bye is `auto`, and `resolve.ts` already reads `loserOf` on an `auto` match as a
vacancy, so nobody phantom-drops and the consolation opponent walks over.

**The cost, and it is real:** a groups consolation needs *concrete* players, because
`Group.playerIds` is `PlayerId[]` and `computeStandings` reads a group match as two
literal `player` slots. So `buildFixtures(level, results?)` now takes the results too.
That is still a pure function of stored source state — `results` is source state — but
the *set* of matches in a level is now derived from results, not only their
participants. Consequences: correcting a group result so a different player qualifies
re-draws the consolation, its match ids are unchanged, and its stored results are
therefore flagged `mismatched` rather than reassigned — exactly what `playedBy` exists
for. And `view.total` jumps when the groups finish; the screen says so
(`run.consolationPending`) rather than pretending otherwise.

To keep that churn to the minimum the consolation field is **sorted by player id before
it is drawn**, so the draw depends on *who* went down and not on the order a table
happened to list them. Same protection the lot in `standings.ts` gives itself.
`manualOrder` is explicitly dropped on the synthetic level: it holds main-draw ids, and
left in place `levelDrawOrder` would reconcile it into a half-hand-made consolation draw
nobody asked for.

**The drop mapping is the one genuinely intricate part**, and only the first drop can be
settled by argument. Winners round 1 match `j` is contested by the winners of round 0
matches `2j` and `2j+1`; the consolation's opening match `j` is contested by the losers
of those same two — so dealing them straight across produces a rematch half the time,
and reversing makes it impossible. Later drops *cannot* be made rematch-proof: by the
second one a survivor's possible origins span the whole draw. So the rule alternates,
and the choice is a measurement rather than a claim — playing out every combination of
outcomes, alternating admits 32/128 repeats at eight players and 12,288/32,768 at
sixteen, against 32 and 16,384 for reversing every round, and 96 and 32,256 for straight
across, which also puts 96 of its 128 in the first drop. `consolation.test.ts` brute
forces it and holds the zero and the ceiling in place.

Two places had to learn the difference between the two competitions, and both would have
been quiet bugs: `resolve.ts`'s champion took the deepest non-group bracket, which a
consolation can easily be — it would have crowned the plate winner and posted it into
career titles — and `stats.ts` took the first group holding a player, who now sits in
two. Consolation matches *do* count as real matches in career records; the **title**
does not.

The consolation is drawn as a list or a tree off **the same toggle as the main
bracket** — they are two halves of one night, and nobody wants to set the view twice.
Supporting the tree is what forced `layoutBracket` to stop assuming a perfect tree: a
staggered bracket's major round is the same size as the round before it, so a node is
placed at the mean of whatever actually feeds it and the opening round stacks one pitch
apart. For a perfect tree that produces the identical coordinates, which is why only
the shapes that need it take the second path, and why the padded-seat drawing is
untouched. A staggered bracket is never padded out to a field size: nobody enters a
consolation, they arrive in it by losing.

The same shape decides how the rounds are *named*. "Round of 32" is a claim about how
many players are still in, and it is true only while every round halves the one before
it — a five-round consolation holds fourteen players, not thirty-two. So
`isPerfectBracket` gates `roundLabel`: a staggered bracket numbers its early rounds and
keeps final, semi and quarter for the last three, because the last match of any bracket
is its final whatever fed it. Compute that from the bracket **including its byes** — the
list view filters them out, and a padded main draw missing its byes looks staggered.

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

### Reading a rank off TTTM

`src/tttm/` fetches a player's ranking points from tttm.co.il. It is split in two
because only half of it is worth testing: `parse.ts` is pure (URLs in, text in, records
out) and has fixtures captured byte for byte from the real site; `lookup.ts` is the part
with a third party in it.

Three ways in, because the league's own database is only reliably reachable by one of
them at a time. Typing the number always works. **Search** works once the season's
ranking list is published. A **pasted link** is what is left in the weeks before that,
when the player exists, the page exists, and the search returns nothing — which is a
club's every autumn, and the reason the third path is not redundant.

Two things about the site shape the code, and both were found by trying it:

- **Its search matches one word against one name field.** "עמית גורן" returns nobody at
  all; "גורן" returns twenty. That single behaviour is most of why a manager concludes
  their player is not in the database, so `searchTerms` never sends a name with a space
  in it — the surname goes first, being the more selective half. What comes back is the
  whole family, ordered by `rankMatches` and never filtered, because the reason someone
  is here may be that the two spellings differ.
- **Two people really do share a name.** Searching "גורן" returns two players called
  עמית גורן: 676 on 1747.6 with a club, and 2682 on 0.0 with none — and TTTM lists the
  unranked one first. Hence points breaking the tie inside each match tier, and hence a
  picker rather than a best guess.

The relay is the cost. tttm.co.il answers with no `Access-Control-Allow-Origin`, so a
page cannot read it — the same wall that ruled four shorteners out of `share/shorten.ts`,
and there is no way round it from a static site. Of the keyless relays still standing,
**r.jina.ai** is the one that answers: it echoes the requesting origin, handles the
preflight, and is not saturated. Left alone it returns its own Markdown rendering, which
drops every image and would make the app depend on how a third party formats tables — so
it is asked for `x-respond-with: html` plus an `x-target-selector`, which returns TTTM's
own markup and only the part wanted. A player's card comes back as **946 bytes** instead
of the 1MB page it sits in, which is the difference between a lookup and a download on a
phone at the club.

Photographs need a second relay for a reason worth remembering: an `<img>` would display
a TTTM picture perfectly well, but a canvas drawn from it is tainted, so it could never
be *stored*. Reading the bytes needs CORS just as the page does. `images.weserv.nl`
serves them with `Access-Control-Allow-Origin: *` and resizes on the way through, and the
same URL builder feeds the thumbnails in the results list — otherwise browsing a list of
candidates would quietly hit TTTM from every row while the note underneath claimed only
the search had left the device. The bytes still go through `readPhoto`: that is the one
place the app decides how large a stored photo may be, and a relay is not where to start
trusting a remote server's idea of it.

Parsed with regular expressions, not `DOMParser`. The input is a fragment asked for by
selector, so it is small and predictable, and regex keeps the parser runnable under the
plain node test environment the rest of the engine uses instead of pulling jsdom in for
one file.

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

**Player lists.** Every list of saved players — the roster screen and the wizard's
picker — is ordered by **ranking points, strongest first**, with alphabetical one tap
away on the same segmented switch the knockout uses for list/tree (`Segmented` in
`common/ui.tsx`; `store/usePlayerOrder.ts` keeps the preference per device, as the theme
and the bracket view are). Rank is the default because it is the order the evening is
built in: composing levels means looking for the top eight, not for the letter ג.
Unranked players go last rather than at zero — absent is not 0.0 — and because
`listRoster` already collates by name at the source, the rank sort is *stable* on top of
it and the whole unranked tail comes out alphabetical for free.

Two rules about where a player can be acted on:

- **The card is the only place a player can be deleted.** A row in a list you scroll
  should not have a delete one stray tap away, so the roster's X is gone and
  `PlayerSheet` carries the removal. It is therefore also the only way back, which is
  why its undo restores the whole record (`restoreRosterPlayer`) rather than adding the
  name again: a fresh id would stand the player next to their own past with an empty
  career, their photo and rank gone with it.
- **The card can be opened from anywhere a player is listed**, including mid-draft in
  the wizard — hence the "i" welded onto each picker chip, two buttons in one pill
  rather than one nested in the other, which is invalid markup and an ambiguous tap.
  Opened there the sheet's history rows are **inert** (`historyLinks={false}`): tapping
  through to an old tournament would take the half-entered night with it.

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
Hebrew/English RTL, player profiles (photo, career record, tournament history) opened
from any list of players including the wizard's, share
links + QR + print/PDF, always-shortened share links, adopting a shared tournament into
this device's own history, JSON export/import from the settings screen, and the doodle
wallpaper.

Newest: **TTTM ranks** on a saved player — typed in, searched for by name, or read off a
pasted link, bringing the league photograph with them — the **banded draw** those ranks
produce, and the **running order** they plan on top of it, which closes a group with the
match that decides it and keeps anyone from playing twice in a row. Plus the **restore
prompt** a device with no saved players now shows on
the home screen and the player list, since a manager arriving on a new phone has the
whole club in a backup file and should not be retyping twenty names. Its confirmation is
picked up in `App.tsx` rather than on the settings screen, because an import can now be
started from three places and the reload can land on any of them.

Newer still: the **consolation** (בית ניחומים) — a switch on the format card that sends
everyone the main draw eliminates into a second competition in the same format, drawn
from the same frozen ranks. On by default on every format that eliminates anybody, one
tap under the format card to turn off, and absent — so off — on every level drawn before
it existed.

Newest of all: an **about screen** (`routes/About.tsx`, `#/about`, the third button in
the header) saying what the app does and — the half nobody else writes down — what it
does not: storage that is one browser deep, a short link made by an outside service, a
relayed and rate-limited rank lookup, double elimination unbuilt, a retirement entered as
a walkover, a withdrawal that does not fill in the matches it leaves behind. Its copy is
one key set at two depths: `about.<id>Title` alone is a bullet on the home screen's
first-run card, and the same title with `about.<id>Body` under it is a section on the
screen. Six of the thirteen lead the first-run card (`HIGHLIGHTS` in `routes/Home.tsx`),
so there is no second list to keep in step — and a title has to read on its own, since
half its appearances have no body under them. `README.md` is a third depth and the only
one that can drift.

The knockout stage has two views, switched beside its heading and remembered per device
(`store/useBracketView.ts`): the **tree** (`components/bracket/BracketTree.tsx`), one
column per round collapsing to a champion leaf, which is the default because it is the
picture of the night people already have in their heads and it costs nothing on a phone
— it never scrolls, it scales itself to its frame — and the **list** of match cards by
round, for working through one round a card at a time. The geometry is a pure function
(`components/bracket/layout.ts`, tested) that positions everything from the inline
start, so one set of coordinates reads right-to-left in Hebrew; the connectors are
logical borders on empty boxes rather than an SVG for the same reason. Byes are drawn in
the tree — they hold its shape and show who was handed one — and hidden in the list.
The tree is drawn to the size of the *field*, not of the bracket: the engine rightly
starts six qualifiers at the quarter-finals, but a club that entered twelve reads its
knockout as 1/8, 1/4, 1/2, final, so `roundsForField` sets the rounds shown and
`layoutBracket` pads the drawing with *seats* — an entrant walking over a bye into the
first real match — leaving the chairs a bye would sit in empty. Eight players get an
eight-tree. Seats exist only in the layout: no match id, no score, nothing stored. The
tree never scrolls: it measures its frame, narrows the columns first and scales the
drawing after, because a bracket that has to be panned is not one picture.
Nodes open the same score sheet as the cards, and the read-only shared view offers the
same switch without it. On paper the tree scales itself to the sheet through
`--tt-print-zoom`.

Two things moved and are easy to look for in the wrong place: the **language and theme
toggles** live on the settings screen, not the header, and the **draw seed** is in the
edit sheet next to redraw and the manual draw, not on the tournament page.

Not built yet:

- **Double elimination** — `resolve.ts` still falls back to a single-elimination bracket
  for it, and **the format picker now locks the card** rather than selling `2n - 2`
  matches and two guaranteed each under a draw that gives one. `advisor.isImplemented`
  is the predicate, a machine-readable code like the rest of the engine's; the card
  suppresses its own match count instead of quoting `describe()`, which answers for the
  format as designed. Unlock it by deleting that predicate's one exception. Most of what
  it needs now exists: the consolation's
  `generateConsolationBracket` **is** a losers bracket, drop mapping and all, and the
  brute force in `consolation.test.ts` is the property test this entry used to ask for.
  What is left is the end of it — the grand final, the bracket reset
  (`Match.bracketReset` is declared and unused), and taking the winners final's loser
  down instead of leaving them at second. Note the property this entry once assumed is
  not available: past the first drop a rematch cannot be prevented, only minimised, and
  the numbers are in `formats/consolation.ts`.
- **A result-dependent group order.** The World Cup runs a group of three as seed 2 v
  seed 3, then seed 1 against the *loser*, then seed 1 against the *winner* — the closing
  pair is unknown until the first match ends. `Slot` already carries `winnerOf` and
  `loserOf`, and `schedule.ts` returns seed references rather than players precisely so
  this can be another arm of `SeedPair` rather than a new signature. What stops it is the
  other end: `standings.ts` and `resolve.ts` both read a group match as two `player`
  slots, and a printed sheet that cannot name its own last two matches is a real cost
  against a small gain for one group size.
- Table assignment queue. `Tournament.tableAssignments` exists and is still unused. The
  running order now hands it a batch at a time — every match sharing a `round` inside a
  group can start together — so the queue has something to consume when it lands.
- Head-to-head is computed (`engine/stats.ts`) but nothing shows it yet.

## Gotchas

- **IndexedDB is per-origin, and a port is part of the origin.** Restarting the dev
  server on a different port presents an empty roster. That is not a bug.
- **Vite's watcher can miss bulk file rewrites** (`sed -i`, `perl -0pi`), leaving the
  dev server serving a stale transform of one file while the disk is correct. If a
  change refuses to appear, compare `curl localhost:<port>/src/path.tsx` against disk
  before debugging the code; the fix is restarting the dev server.
- **The rank relay is rate-limited**, at twenty requests a minute per IP with no key.
  Ample for a manager typing names one at a time, and the reason there is no "fetch
  every rank" button; a `429` is reported as its own outcome (`busy`) because it is the
  one failure that clears on its own within the minute. Fragments are cached for the
  life of the page for the same reason.
- **Hash routing is load-bearing.** GitHub Pages has no rewrite rules, so a real path
  would 404 on refresh. It also means a future share payload can ride in the fragment,
  which browsers never send to the server — a genuine privacy property, worth keeping.
