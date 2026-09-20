export const en = {
  app: {
    title: 'Table Tennis Tournament Manager',
    short: 'Tournaments',
    tagline: 'Draws, scores and standings — all on this device',
    /* The browser tab, and the line a search result is titled with. It repeats what
       index.html already carries because a crawler that runs the app reads the
       *rendered* title, and the app would otherwise leave the static one in place
       only by accident. */
    documentTitle: 'Free Table Tennis (Ping Pong) Tournament Manager — Derech Ben, Haifa',
  },
  nav: {
    home: 'Tournaments',
    roster: 'Players',
    newTournament: 'New tournament',
    back: 'Back',
    settings: 'Settings',
    club: 'Club page',
  },
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    add: 'Add',
    edit: 'Edit',
    close: 'Close',
    confirm: 'Confirm',
    next: 'Next',
    previous: 'Back',
    start: 'Start',
    of: 'of',
    copy: 'Copy',
    copied: 'Copied',
    share: 'Share',
    print: 'Print',
    done: 'Done',
  },
  home: {
    empty: 'No tournaments yet.',
    emptyHint: 'Create one to get started.',
    /* The only screen a crawler ever renders — storage is per-origin, so it lands on an
       empty roster every time — and the only prose a first-time visitor reads. Both
       names for the sport belong here rather than in a meta tag: a synonym nobody sees
       is a hidden keyword, and a newcomer deciding whether this is the right app is
       exactly who the sentence is for. */
    emptyAboutTitle: 'Running a table tennis (ping pong) tournament, start to finish',
    emptyAbout:
      'Add the competitors, let the app draw groups or a knockout bracket, then tap in scores as matches finish — the brackets and the ITTF standings update themselves. Everything stays on this device; no account, no server.',
    emptyAboutFree:
      'Free and open source, for organising a ping pong tournament at a club, a school or the office — from four players up to several levels running in one evening.',
    create: 'New tournament',
    resume: 'Continue',
    players_one: '{{count}} player',
    players_two: '{{count}} players',
    players_other: '{{count}} players',
  },
  /* The about screen, and the six headlines the home screen's empty state borrows.
     One key set at two depths: a title alone is a bullet on the first-run card, a
     title with its body is a section here. Two lists would have drifted apart by
     the second feature that landed. */
  about: {
    title: 'About',
    lead: 'A free, open-source app for running a table tennis tournament: enter the competitors, draw the tournament, tap in scores — the brackets and standings update themselves. All in your browser, with no account and no server.',
    featuresTitle: 'What it does',

    formatsTitle: 'Three ways to run the tournament: groups then a knockout, a round robin, or a straight knockout',
    formatsBody:
      'Chosen per level. The app recommends one for the size of the field, and each card says in advance how many matches the tournament holds, how many each player is guaranteed, and how long it takes.',

    levelsTitle: 'Several levels in one tournament',
    levelsBody:
      'A, B and C side by side, each with its own format and match length. A player belongs to exactly one level.',

    drawTitle: 'A draw anyone can replay — or arrange by hand',
    drawBody:
      'Random, but the seed is stored and shown, so anyone can run it again and see it was not arranged in advance. Given ranks it pairs players of a similar standard.',

    ranksTitle: 'Real ranking points from the Israeli league (TTTM)',
    ranksBody:
      'Add a player straight out of the league database — search by name, paste a link to their page, or type the number — and they arrive with their true ranking points and their photograph. Ranks are frozen at the draw, so a revision later in the season never changes a night already played.',

    orderTitle: 'The order the matches are played in',
    orderBody:
      'In a fully ranked group the match that decides qualification is played last, as the ITTF regulation asks, and nobody plays two matches in a row.',

    consolationTitle: 'A consolation event — knocked out, still playing',
    consolationBody:
      'Everyone the main draw knocks out plays a second competition in the same format, so the tournament does not end for half the room after one match. On by default; one tap turns it off.',

    scoringTitle: 'Scores in one tap, or game by game',
    scoringBody:
      'Quick entry takes the result in one tap; detailed entry takes every game and checks as you type that it is legal. Walkovers by button, and an undo on every change.',

    standingsTitle: 'Standings that keep themselves up to date, with ITTF tiebreaks',
    standingsBody:
      'Match points, head-to-head, game ratio, point ratio, then a lot — the chain restarting from the top on every split. The table says what separated two players, and missing game scores can be filled in from it.',

    editingTitle: 'Everything can be corrected mid-tournament',
    editingBody:
      'Correcting an early score re-derives everything downstream. Add a level, move a player, change a format, mark somebody withdrawn — and anything that would destroy results asks first.',

    playersTitle: 'A saved list of regular players, with their tournament history and career record',
    playersBody:
      'Each player has a card with their photo, rank, tournaments, titles, wins and losses, and every tournament they played in — tapping through to the tournament itself. It is all derived, so correcting an old score corrects the record too.',

    sharingTitle: 'Share it, scan it, print it',
    sharingBody:
      'A read-only link carries the whole tournament inside it, with a QR code, a text summary for WhatsApp or email, and print to PDF.',

    backupTitle: 'History that moves between devices',
    backupBody:
      'Back everything up to one file and import it on another phone. A tournament from a share link can be added to your history, with players you already have recognised by name.',

    deviceTitle: 'Hebrew and English, dark mode, built for a phone',
    deviceBody:
      'Right-to-left in Hebrew, left-to-right in English, light or dark theme — all on the settings screen. Every control is sized for a thumb.',

    limitsTitle: 'Worth knowing',
    limitsLead: 'Results you are going to rely on are worth knowing the shape of the thing holding them.',

    limitDeviceTitle: 'Everything is stored in this browser, and only here',
    limitDeviceBody:
      'No account, no server. Another browser, another phone or a private window is an empty copy, and clearing site data erases everything — keep an exported backup.',

    limitSyncTitle: 'Nothing syncs by itself',
    limitSyncBody:
      'Two devices running the same tournament keep two separate records. Moving history means a backup file or a share link.',

    limitShortLinkTitle: 'A shortened link is made by an outside service',
    limitShortLinkBody:
      'The full link uploads nothing, but it is far too long to paste into a chat, so it is shortened automatically — and that does hand the tournament to an outside service.',

    limitDoubleElimTitle: 'Double elimination is not built yet',
    limitDoubleElimBody:
      'It is marked in the format picker and cannot be chosen. The other three formats are complete.',

    limitRetiredTitle: 'A player retiring mid-match',
    limitRetiredBody: 'Entered as a walkover for now — there is no separate result for it.',

    limitWithdrawTitle: 'Marking somebody withdrawn',
    limitWithdrawBody:
      'It strikes their group results under the ITTF rule, where they played fewer than half their matches. The matches they leave behind are entered as walkovers by hand.',

    limitTablesTitle: 'Tables are counted, not assigned',
    limitTablesBody:
      'The table count sizes what is offered as ready to play and the duration estimate. It does not put a table number on a match.',

    limitOnlineTitle: 'The first load needs a connection',
    limitOnlineBody:
      'The page itself has to be fetched — there is no offline copy. Once it has loaded, running the tournament needs no connection.',

    sourceTitle: 'Open source',
    sourceBody: 'Built for a table tennis club in Haifa, and free for any club to use or change.',
    source: 'Source on GitHub',
  },
  wizard: {
    step: 'Step {{current}} of {{total}}',
    nameStep: 'Tournament details',
    nameLabel: 'Tournament name',
    namePlaceholder: 'Club championship',
    dateLabel: 'Date',
    playersStep: 'Players',
    formatStep: 'Format',
    reviewStep: 'Review',
    scoreMode: 'Score entry',
    scoreModeQuick: 'Quick',
    scoreModeQuickHint: 'Just the result, 3:1',
    scoreModeDetailed: 'Detailed',
    scoreModeDetailedHint: 'Every game, 11-9',
    bestOf: 'Match length',
    bestOfValue: 'Best of {{count}}',
    bestOfHint: 'How many games each match is played over.',
    tables: 'Tables available',
    createIt: 'Create tournament',
    addLevel: 'Level',
    addLevelHint: 'Add another level — its players never meet the others',
    removeLevelHint: 'Remove this level',
    levelTab: '{{name}} — {{count}} players',
    // The default name of the nth level. Letters rather than numbers, and each
    // language brings its own: 'A' is not what a Hebrew score sheet calls a division.
    levelDefault: 'Level {{letter}}',
    levelLetters: 'A,B,C,D,E',
    // The format stage is walked level by level, so its heading names the level it is
    // asking about and the sub-line says how far along the walk is.
    formatFor: 'Format — {{name}}',
    levelStep: 'level {{current}} of {{total}}',
  },
  format: {
    roundRobin: 'Round robin',
    roundRobinHint: 'Everyone plays everyone. Best for small fields.',
    groupsKnockout: 'Groups then knockout',
    groupsKnockoutHint: 'Group stage, then the top players advance to a bracket.',
    singleElim: 'Single elimination',
    singleElimHint: 'Straight knockout. One loss and you are out.',
    doubleElim: 'Double elimination',
    doubleElimHint: 'A second chance through the losers bracket.',
    groups: '{{count}} groups',
    advance: 'top {{count}} advance',
    matches_one: '{{count}} match',
    matches_two: '{{count}} matches',
    matches_other: '{{count}} matches',
    perPlayer: 'at least {{count}} each',
    consolation: 'Consolation',
    consolationHint: 'The players knocked out play a second competition, in the same format.',
    consolationAdds: 'adds {{n}} more matches to the night',
    consolationOn: 'On',
    consolationOff: 'Off',
    consolationTooFew: 'Not enough players go out to run one.',
    tooFew: 'Needs at least {{count}} players.',
    advanceBlocked: 'Groups are too small for {{count}} to advance',
    /* Double elimination has a card, a diagram and a fixture fallback, but no
       generator — resolve.ts runs it as a single elimination. The card is locked
       rather than removed: it is the format people ask for by name, and "not yet"
       answers them where silence would look like an oversight. */
    notBuilt: 'Not built yet.',
    notBuiltFallback: 'Not built yet — this level is running as a single elimination.',
  },
  roster: {
    title: 'Regular players',
    hint: 'Saved on this device so you do not retype them each time.',
    addPlaceholder: 'Player name',
    empty: 'No saved players yet.',
    count_one: '{{count}} player',
    count_two: '{{count}} players',
    count_other: '{{count}} players',
    selected_one: '{{count}} selected',
    selected_two: '{{count}} selected',
    selected_other: '{{count}} selected',
    orderLabel: 'Order',
    orderRank: 'Rank',
    orderName: 'A–Z',
    removeHint: 'Remove {{name}} from the saved list',
    openHint: 'Open {{name}} — record, photo and history',
    tapToAdd: 'Tap to add to this level',
    tapToRemove: 'Tap to remove from this level',
    inLevel: 'In {{level}}',
    tapToMove: 'Tap to move from {{level}} to this level',
    addAll: 'Add all',
    clearSelection: 'Clear',
  },
  run: {
    groups: 'Groups',
    bracket: 'Knockout',
    standings: 'Standings',
    progress: '{{played}} of {{total}} matches played',
    champion: 'Champion',
    seedLabel: 'Draw code',
    seedHint: 'The draw can be reproduced from this code.',
    seedManual: 'The draw was arranged by hand, so the code no longer reproduces it.',
    viewLabel: 'Knockout view',
    viewList: 'List',
    viewTree: 'Tree',
    consolation: 'Consolation',
    consolationChampion: 'Consolation winner',
    consolationPending: 'The consolation is drawn once the group stage finishes.',
    upNext: 'Up next',
    noneReady: 'No matches ready to play.',
  },
  round: {
    final: 'Final',
    semi: 'Semi-finals',
    quarter: 'Quarter-finals',
    last16: 'Round of 16',
    of: 'Round of {{n}}',
    number: 'Round {{n}}',
  },
  match: {
    winnerOf: 'Winner of {{label}}',
    groupRank: '{{rank}} in group {{group}}',
    bye: 'Bye',
    vacant: 'Vacant',
    pending: 'To be decided',
    enterScore: 'Enter score',
    walkover: 'Walkover',
    stale: 'This result no longer matches the players in this match.',
    staleAction: 'Clear it',
  },
  score: {
    addGame: 'Add game',
    winsBy: '{{name}} wins',
    gameIncomplete: 'A game goes to at least 11.',
    gameMargin: 'A game is won by two clear points.',
    walkoverFor: 'Walkover to {{name}}',
  },
  table: {
    rankHint: 'Where they stand in the group, once the tiebreaks have run.',
    playedHint: 'Matches played.',
    wonHint: 'Matches won.',
    gamesHint:
      'Games won and games lost, added up over every match they played. A game taken in a match they lost still counts — that is what separates players level on wins.',
    pointsHint: 'Match points: two for a win, one for a loss played out, none for a forfeit.',
    player: 'Player',
    played: 'P',
    won: 'W',
    lost: 'L',
    points: 'Pts',
    games: 'Games',
    rank: '#',
  },
  tiebreak: {
    headToHead: 'Separated head-to-head',
    gameRatio: 'Separated on game ratio',
    pointRatio: 'Separated on point ratio',
    lot: 'Separated by drawing lots',
    lotPointsUnavailable: 'Level on games — separated by drawing lots',
    pointsHint:
      'Point ratio would decide this tie, but these matches were entered without game scores. Add the scores for the tied players right here, or switch the whole tournament to detailed entry from Edit → Score entry.',
    resolveFor: 'Add game scores · {{names}}',
    sheetTitle: 'Break the tie on points',
    sheetIntro:
      'Enter the game scores of the matches between {{names}}. Point ratio separates them once all of these carry points.',
    sheetScope: 'Only these matches change — the rest of the tournament keeps quick entry.',
    sheetRemaining: '{{done}} of {{total}} ready to save. Point ratio needs all of them.',
    sheetComplete: 'All of them are in — saving will break the tie on point ratio.',
  },
  edit: {
    title: 'Edit tournament',
    open: 'Edit',
    openHint: 'Change names, players, match length and the draw',
    levelName: 'Level name',
    players: 'Players in this level',
    playerAdded: '{{name}} added',
    playerRemoved: '{{name}} removed',
    /* Not 'their remaining matches become walkovers', which is what this used to
       promise: withdrawing strikes their group results under the ITTF rule and does
       nothing else, so the matches they leave behind are still entered by hand. */
    withdrawHint: 'Mark as withdrawn — enter the matches they leave behind as walkovers',
    reinstateHint: 'Bring this player back',
    withdrew: '{{name}} withdrew',
    reinstated: '{{name}} is back in',
    removeHint: 'Remove from this level',
    removeBlocked: 'Cannot remove once matches have been played — withdraw instead',
    levels: 'Levels',
    levelAdded: '{{name}} added',
    levelRemoved: '{{name}} removed',
    levelRestored: '{{name}} is back',
    removeLevelBlocked: 'Cannot remove a level once matches have been played in it',
    moveTo: 'Move to',
    moveHint: 'Move {{name}} to another level',
    moveBlocked: 'Cannot move once matches have been played in this level — withdraw instead',
    moved: '{{name}} moved to {{level}}',
    formatChange: 'Change format',
    formatHint: 'Pick the format this level is drawn in',
    formatWarnResults:
      'Changing the format redraws this level and discards the results whose matches it no longer has.',
    formatChanged: 'Format changed',
    consolationOff: 'Discard it',
    consolationOffWarn:
      'Turning the consolation off deletes {{count}} results already recorded in it. Continue?',
    formatCurrent: 'Now: {{format}}',
    formatSuggest: 'Recommended for {{count}} players: {{format}}',
    formatApply: 'Use it',
    redraw: 'Draw again',
    redrawHint: 'Generate a new random draw with a fresh seed',
    redrawWarn: 'This replaces the current draw. Continue?',
    redrawWarnResults: 'This deletes {{count}} recorded results. Continue?',
    redrawDone: 'New draw made',
    deleteSection: 'Delete this tournament',
    delete: 'Delete tournament',
    deleteHint: 'Removes the tournament and every result in it from this device',
    deleteWarn: 'This deletes "{{name}}" and every result in it. Continue?',
    deleteDone: '"{{name}}" deleted',
    deleteUndone: '"{{name}}" is back',
  },
  draw: {
    section: 'The draw',
    manual: 'Arrange by hand',
    manualHint: 'Move players between groups and bracket positions yourself',
    manualOn: 'Arranging the draw by hand',
    pickHint: 'Tap a player, then tap whoever they should swap with.',
    picked: '{{name}} picked — now tap their new place',
    swapped: '{{a}} and {{b}} swapped',
    inGroup: 'Group {{group}}',
    firstMatch: 'Match {{n}}',
    reset: 'Back to the drawn order',
    resetHint: 'Discard the hand-made arrangement and use the seeded draw',
    resetDone: 'Back to the drawn order',
    resultsWarn:
      'Moving someone who has already played leaves their result on a match they are no longer in. The app will flag it rather than reassign it.',
    manualBadge: 'Arranged by hand',
    rankedBadge: 'Drawn by rank',
    rankedHint:
      'The field is banded by TTTM points, so a group holds players of one standard. The code decides only what the ranks do not — the unranked, and anyone level on points. Drawing again also picks up ranks that have changed since.',
    rankedSettled:
      'Everyone here is ranked, so the ranks settle this draw between them: drawing again reproduces it unless a rank or the players change.',
    orderPlanned:
      'The ranks also set the running order: nobody plays two matches in a row where that can be avoided, and the match that settles a group is played last.',
  },
  share: {
    open: 'Share',
    openHint: 'A link, a QR code or a printable sheet',
    title: 'Share results',
    linkTitle: 'Link',
    linkHint:
      'The whole tournament travels inside the link — the recipient can read it, or add it to their own device.',
    copyLink: 'Copy link',
    shorten: 'Try again',
    shortening: 'Shortening…',
    shortenFailed: 'No shortening service answered, so this is the full link. It works just as well, but it is long.',
    shortenTooLong: 'This tournament is too large to shorten, so this is the full link.',
    tooLong: 'This tournament is too large for a link. Print it, or export a backup from Settings.',
    qrTitle: 'QR code',
    qrHint: 'Point a phone at this to open the results.',
    printTitle: 'Print or PDF',
    printHint: 'Your browser’s print dialog can save the results as a PDF.',
    whatsapp: 'WhatsApp',
    email: 'Email',
    summary: 'Results',
    viewTitle: 'Shared results',
    viewHint: 'A read-only copy. It is not saved on this device.',
    adopt: 'Add to my tournaments',
    adoptTitle: 'Add this to your device',
    adoptHint:
      'Saves the whole tournament here alongside the others. Players you already have are matched by name, so one person keeps one career record however many devices the night was run on.',
    adoptNew_one: '{{count}} player joins your saved players',
    adoptNew_two: '{{count}} players join your saved players',
    adoptNew_other: '{{count}} players join your saved players',
    adoptMatched_one: '{{count}} player recognised from your saved players',
    adoptMatched_two: '{{count}} players recognised from your saved players',
    adoptMatched_other: '{{count}} players recognised from your saved players',
    adoptReplaces: 'This tournament is already on this device. Adding it replaces that copy.',
    adoptDone: 'Added to this device',
    adoptReplaced: 'The copy on this device was replaced',
    adoptUndone: 'The earlier copy is back',
    invalid: 'This link could not be read.',
    invalidHint: 'Links are long — if one is cut short on the way it stops working. Send it unedited.',
  },
  settings: {
    title: 'Settings',
    dataTitle: 'Your data',
    dataHint:
      'Everything lives in this browser. Export a file to move it to another device, or to keep a backup.',
    export: 'Export a backup',
    exportHint: 'Downloads every tournament and player as one JSON file',
    exportDone: 'Backup saved',
    shareHistory: 'Share history',
    shareHistoryHint: 'Send the backup over WhatsApp, email or anything else on the device',
    shared: 'Passed to the share sheet',
    import: 'Import a backup',
    importHint: 'Choose a file exported from this app',
    importMerge: 'Merge with what is here',
    importReplace: 'Replace everything',
    importReplaceWarn: 'Replacing deletes the tournaments and players on this device first.',
    importDone: 'Imported {{summary}}',
    importFailed: 'That file is not a backup from this app.',
    languageTitle: 'Language',
    themeTitle: 'Appearance',
    themeSystem: 'Follow the device',
    themeLight: 'Light',
    themeDark: 'Dark',
    storageTitle: 'Storage',
    storageHint: 'Clearing site data still erases everything, so keep an exported backup.',
    tournamentCount_one: '{{count}} tournament',
    tournamentCount_two: '{{count}} tournaments',
    tournamentCount_other: '{{count}} tournaments',
    aboutTitle: 'About',
    aboutText:
      'Open source, no accounts, no server. Your tournaments never leave this device unless you share them.',
  },
  player: {
    open: 'Player',
    photo: 'Photo',
    photoAdd: 'Add a photo',
    photoChange: 'Change photo',
    photoRemove: 'Remove photo',
    photoSaved: 'Photo saved',
    photoRemoved: 'Photo removed',
    photoFailed: 'That image could not be read.',
    rename: 'Name',
    renamed: 'Renamed to {{name}}',
    record: 'Record',
    tournaments: 'Tournaments',
    titles: 'Titles',
    matches: 'Matches',
    won: 'Won',
    lost: 'Lost',
    winRate: 'Win rate',
    games: 'Games',
    history: 'History',
    noHistory: 'No matches played yet.',
    placed: 'Finished {{n}}',
    championHere: 'Won it',
    removeFromRoster: 'Remove from the saved list',
  },
  rank: {
    title: 'TTTM rank',
    hint: 'Ranking points from the Israeli league. A level is drawn in bands of them, so people meet others of their own standard.',
    placeholder: 'e.g. 1747.6',
    saved: 'Rank saved for {{name}}',
    cleared: 'Rank cleared for {{name}}',
    invalid: 'A rank is a number of points, like 1747.6.',
    open: 'Their TTTM page',
    lookup: 'Look it up on TTTM',
    lookupClose: 'Close the lookup',
    searchLabel: 'Their name on TTTM',
    search: 'Search',
    searching: 'Looking…',
    oneFound: 'One player by that name.',
    pickOne: 'More than one player by that name — pick the right one.',
    noClub: 'No club',
    position: 'no. {{n}} nationally',
    // Reached through `rank.<outcome>`, so these three names are load-bearing.
    none: 'TTTM has nobody by that name. If they are registered but the season’s ranking list is not out yet, paste a link to their page below.',
    busy: 'Too many lookups in the last minute. Give it a moment and try again.',
    unreachable: 'Could not reach TTTM. Try again, or type the number in above.',
    linkLabel: 'Or paste a link to their TTTM page',
    linkPlaceholder: 'https://www.tttm.co.il/p/676/…',
    fetch: 'Read it',
    badLink: 'That is not a link to a TTTM player page.',
    applied: '{{name}} — {{rank}} points',
    appliedPhoto: '{{name}} — {{rank}} points, and a photo',
    relayNote:
      'A lookup asks an outside service to fetch the TTTM page, because tttm.co.il cannot be read from a web page directly. Only the name or link you look up leaves this device.',
  },
  restore: {
    title: 'Bring your players with you',
    body: 'Nothing is saved on this device yet. If you exported a backup from another phone or laptop, load it here — your players, their ranks and every tournament come across with it.',
    action: 'Load a backup file',
    working: 'Loading…',
    more: 'Other options',
    otherwise: 'No backup? Just add players as you go.',
  },
  feedback: {
    scoreSaved: 'Score saved',
    scoreCleared: 'Score cleared',
    undo: 'Undo',
    themeChanged: 'Appearance changed',
    languageChanged: 'Language changed',
    tournamentCreated: 'Tournament created — the draw is ready',
    linkCopied: 'Link copied',
    copyFailed: 'Could not copy — select the link and copy it by hand',
  },
} as const

/**
 * Widens the literal types from `as const` back to `string`, so a translation must
 * supply every key but is free to supply different text. Typing `he` as this makes a
 * missing or misspelled key a compile error rather than a silent fallback to English.
 */
type Translated<T> = { [K in keyof T]: T[K] extends string ? string : Translated<T[K]> }

export type Resources = Translated<typeof en>
