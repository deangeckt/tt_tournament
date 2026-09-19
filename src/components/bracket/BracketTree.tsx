import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { MatchView, Participant } from '../../engine/resolve'
import type { BestOf, Group, MatchId, PlayerId } from '../../engine/types'
import { tally } from '../../engine/result'
import { participantLabel, roundLabel } from '../match/labels'
import {
  layoutBracket,
  roundsForField,
  TREE_METRICS,
  type NodeBox,
  type TreeMetrics,
} from './layout'

/** Wider than this and a printed tree is scaled down to fit a portrait sheet. */
const PRINT_WIDTH = 680

/** Nodes shrink from their full width down to this before the whole tree scales. */
const MIN_NODE_WIDTH = 104
const MIN_COLUMN_GAP = 20

/**
 * Metrics that put the whole tree inside `width`: first by narrowing the columns
 * and the gaps between them, and only when even the narrowest columns will not fit,
 * by scaling the drawing down. Widths stay whole pixels so the connectors meet the
 * nodes on the same pixel they were laid out for.
 */
function fitMetrics(width: number, columns: number): { metrics: TreeMetrics; zoom: number } {
  const gap = width < 640 ? MIN_COLUMN_GAP : TREE_METRICS.columnGap
  const available = Math.floor((width - (columns - 1) * gap) / columns)
  const nodeWidth = Math.max(MIN_NODE_WIDTH, Math.min(TREE_METRICS.nodeWidth, available))
  const metrics = { ...TREE_METRICS, nodeWidth, columnGap: gap }
  const natural = columns * nodeWidth + (columns - 1) * gap
  return { metrics, zoom: Math.min(1, width / natural) }
}

/**
 * The knockout stage drawn as a tree: one column per round, each match centred on
 * the two that feed it, and the champion hanging off the final.
 *
 * Everything here is positioned from the *inline start*, so the same coordinates
 * read left-to-right in English and right-to-left in Hebrew, where the first round
 * stands on the right and the tree collapses leftwards the way the text runs. The
 * connectors are borders on empty boxes rather than an SVG for the same reason:
 * `border-inline-end` and the logical corner radii mirror themselves, and a mirrored
 * SVG would have to be kept the exact width of the canvas to line up.
 *
 * Byes are drawn, not hidden. In the list a walkover past an empty seat is noise;
 * in a tree it is what keeps the columns lined up, and it shows who was handed one.
 *
 * The tree never scrolls. It measures the room it has been given and fits itself
 * to it — narrower columns first, a smaller drawing after that — because a bracket
 * is read as one picture, and a picture that has to be panned is not one picture.
 * On a phone that makes a big tree small; the list is the phone's view, and it is
 * the default for that reason.
 */
export function BracketTree({
  matches,
  entrants,
  nameOf,
  groups,
  bestOf,
  champion,
  flashKey,
  onOpen,
}: {
  /** Every knockout match of the level, byes included. */
  matches: readonly MatchView[]
  /** How many players the level holds, which sets how many rounds the tree shows. */
  entrants: number
  nameOf: (id: PlayerId) => string
  groups: readonly Group[]
  bestOf: BestOf
  champion?: PlayerId
  /** See MatchCard: bumped by the screen that just changed this match's score. */
  flashKey?: (id: MatchId) => number | undefined
  /** Omitted on read-only screens, where a node is a label rather than a button. */
  onOpen?: (view: MatchView) => void
}) {
  const { t } = useTranslation()
  const frame = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | null>(null)

  // Measured rather than assumed: the same tree sits in a 768px column on a
  // desktop, a narrower one on a tablet, and the print sheet is different again.
  useLayoutEffect(() => {
    const el = frame.current
    if (!el) return
    const measure = () => setWidth(Math.floor(el.getBoundingClientRect().width))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const minRounds = roundsForField(entrants)
  const columns = useMemo(() => {
    const real = matches.reduce((max, m) => Math.max(max, m.match.round + 1), 0)
    // Rounds drawn, plus the champion leaf.
    return Math.max(real, minRounds) + 1
  }, [matches, minRounds])
  const fit = useMemo(
    () => (width ? fitMetrics(width, columns) : { metrics: TREE_METRICS, zoom: 1 }),
    [width, columns],
  )
  const layout = useMemo(
    () => layoutBracket(matches.map((m) => m.match), fit.metrics, minRounds),
    [matches, fit.metrics, minRounds],
  )
  const viewById = useMemo(() => new Map(matches.map((m) => [m.match.id, m])), [matches])
  if (!layout) return null

  const { nodeWidth, nodeHeight, columnGap } = fit.metrics
  const junction = columnGap / 2
  const lastRound = layout.rounds - 1

  const walked = 'border-court-500 dark:border-court-400'
  const unwalked = 'border-court-200 dark:border-court-700'

  /** Who a padding seat holds: the participant it walks into the opening match. */
  const seated = (node: NodeBox): Participant | undefined => {
    if (node.kind !== 'seat') return undefined
    return viewById.get(node.matchId)?.[node.side]
  }
  /**
   * A seat is drawn only while someone is in it or still on the way: a seat behind
   * a bye is the empty chair of a full sixteen-draw, and an empty chair is not drawn.
   */
  const occupied = (node: NodeBox): boolean => {
    if (node.kind !== 'seat') return true
    const kind = seated(node)?.kind
    return kind === 'player' || kind === 'tbd'
  }
  /** Whether anyone has come out of this node yet, which is what lights its line. */
  const produced = (node: NodeBox): boolean =>
    node.kind === 'match'
      ? Boolean(viewById.get(node.id)?.winner)
      : seated(node)?.kind === 'player'
  /** Whether anyone has arrived in this node yet, which lights the stub into it. */
  const received = (node: NodeBox): boolean => {
    if (node.kind === 'seat') return seated(node)?.kind === 'player'
    const view = viewById.get(node.id)
    return view ? view.a.kind === 'player' || view.b.kind === 'player' : false
  }

  const canvas: CSSProperties & { '--tt-print-zoom': number } = {
    width: layout.width,
    height: layout.height,
    zoom: fit.zoom,
    '--tt-print-zoom': Math.min(1, PRINT_WIDTH / layout.width),
  }

  return (
    <div ref={frame} className="w-full overflow-hidden">
      {/* Rendered only once measured, so the first paint is already the right size. */}
      {width === null ? null : (
      <div className="tt-tree relative" style={canvas}>
        {Array.from({ length: layout.rounds }, (_, round) => (
          <RoundHeading key={round} x={layout.columnX(round)} width={nodeWidth}>
            {roundLabel(round, lastRound, t)}
          </RoundHeading>
        ))}
        <RoundHeading x={layout.champion.x} width={nodeWidth}>
          {t('run.champion')}
        </RoundHeading>

        {layout.edges.map((edge) => {
          const from = layout.byId.get(edge.from)!
          const to = layout.byId.get(edge.to)!
          if (!occupied(from)) return null
          const tone = produced(from) ? walked : unwalked
          const start = from.x + nodeWidth
          // An L from the feeder's edge out to the junction and along to the level
          // of the match it feeds: the upper branch turns down, the lower turns up.
          return edge.side === 'a' ? (
            <span
              key={`${edge.from}>${edge.to}`}
              aria-hidden="true"
              className={`absolute rounded-se-lg border-t-2 border-e-2 ${tone}`}
              style={{
                insetInlineStart: start,
                top: from.cy,
                width: junction,
                height: to.cy - from.cy,
              }}
            />
          ) : (
            <span
              key={`${edge.from}>${edge.to}`}
              aria-hidden="true"
              className={`absolute rounded-ee-lg border-b-2 border-e-2 ${tone}`}
              style={{
                insetInlineStart: start,
                top: to.cy,
                width: junction,
                height: from.cy - to.cy,
              }}
            />
          )
        })}

        {layout.nodes
          .filter((node) => node.round > 0 && occupied(node))
          .map((node) => {
            // The stub from the junction into the match, shared by both branches and
            // lit once anyone has come through.
            return (
              <span
                key={`>${node.id}`}
                aria-hidden="true"
                className={`absolute border-t-2 ${received(node) ? walked : unwalked}`}
                style={{ insetInlineStart: node.x - junction, top: node.cy, width: junction }}
              />
            )
          })}

        {layout.nodes.map((node) => {
          if (node.kind === 'seat') {
            const participant = seated(node)
            return participant && occupied(node) ? (
              <SeatNode
                key={node.id}
                box={node}
                metrics={fit.metrics}
                label={participantLabel(participant, nameOf, groups, t)}
                named={participant.kind === 'player'}
              />
            ) : null
          }
          const view = viewById.get(node.id)
          return view ? (
            <MatchNode
              key={node.id}
              box={node}
              metrics={fit.metrics}
              view={view}
              nameOf={nameOf}
              groups={groups}
              bestOf={bestOf}
              flashKey={flashKey?.(node.id)}
              onOpen={onOpen}
            />
          ) : null
        })}

        {layout.final ? (
          <span
            aria-hidden="true"
            className={`absolute border-t-2 ${champion ? walked : unwalked}`}
            style={{
              insetInlineStart: layout.final.x + nodeWidth,
              top: layout.final.cy,
              width: columnGap,
            }}
          />
        ) : null}
        <div
          className={`print-keep absolute flex items-center gap-2 rounded-xl px-3 ${
            champion
              ? 'bg-ball-500/15 font-bold ring-1 ring-ball-400/40'
              : 'text-court-400 ring-1 ring-court-200 dark:ring-court-700'
          }`}
          style={{
            insetInlineStart: layout.champion.x,
            top: layout.champion.y,
            width: nodeWidth,
            height: nodeHeight,
          }}
        >
          <span aria-hidden="true">🏆</span>
          <span className="min-w-0 flex-1 truncate">
            {champion ? nameOf(champion) : t('match.pending')}
          </span>
        </div>
      </div>
      )}
    </div>
  )
}

function RoundHeading({ x, width, children }: { x: number; width: number; children: string }) {
  return (
    <div
      className="absolute top-0 truncate text-center text-xs font-medium text-court-500 dark:text-court-300"
      style={{ insetInlineStart: x, width }}
    >
      {children}
    </div>
  )
}

/**
 * A padding seat: an entrant walking over a bye into the first real round. Drawn
 * the way a bye match is drawn, and never a button — there is nothing to score.
 */
function SeatNode({
  box,
  metrics,
  label,
  named,
}: {
  box: NodeBox
  metrics: TreeMetrics
  label: string
  named: boolean
}) {
  const { t } = useTranslation()
  return (
    <div
      className="print-keep absolute flex flex-col overflow-hidden rounded-xl bg-court-100/60 text-start text-court-500 ring-1 ring-court-100/60 dark:bg-court-800/50 dark:text-court-300 dark:ring-court-800/60"
      style={{
        insetInlineStart: box.x,
        top: box.y,
        width: metrics.nodeWidth,
        height: metrics.nodeHeight,
      }}
    >
      <span className="flex min-h-0 flex-1 items-center px-3">
        <span className={`min-w-0 flex-1 truncate text-sm ${named ? '' : 'text-court-400'}`}>
          {label}
        </span>
      </span>
      <span aria-hidden="true" className="mx-2 border-t border-court-100 dark:border-court-800" />
      <span className="flex min-h-0 flex-1 items-center px-3">
        <span className="min-w-0 flex-1 truncate text-sm text-court-400">{t('match.bye')}</span>
      </span>
    </div>
  )
}

function MatchNode({
  box,
  metrics,
  view,
  nameOf,
  groups,
  bestOf,
  flashKey,
  onOpen,
}: {
  box: NodeBox
  metrics: TreeMetrics
  view: MatchView
  nameOf: (id: PlayerId) => string
  groups: readonly Group[]
  bestOf: BestOf
  flashKey?: number
  onOpen?: (view: MatchView) => void
}) {
  const { t } = useTranslation()
  const result = view.result ? tally(view.result, bestOf) : undefined
  const stale = view.staleness !== 'fresh'
  const interactive = Boolean(onOpen) && view.playable
  const ready = view.playable && !view.result

  // A match waiting to be played carries the stronger ring, so the eye lands on the
  // ones that still need a referee rather than on the ones already settled.
  const surface = view.playable
    ? `bg-white dark:bg-court-900 ${
        ready ? 'ring-court-400 dark:ring-court-500' : 'ring-court-100 dark:ring-court-800'
      }`
    : 'bg-court-100/60 text-court-500 ring-court-100/60 dark:bg-court-800/50 dark:text-court-300 dark:ring-court-800/60'
  const hover = interactive
    ? 'hover:-translate-y-px hover:bg-court-50 hover:shadow-md active:scale-[0.98] dark:hover:bg-court-800'
    : ''
  const className = `print-keep absolute flex flex-col overflow-hidden rounded-xl text-start ring-1 transition-all duration-150
    ${surface} ${hover} ${stale ? 'ring-2 ring-ball-500' : ''}`
  const style: CSSProperties = {
    insetInlineStart: box.x,
    top: box.y,
    width: metrics.nodeWidth,
    height: metrics.nodeHeight,
  }

  const rows = (
    <>
      {flashKey ? (
        <span key={flashKey} aria-hidden="true" className="tt-flash absolute inset-0" />
      ) : null}
      <Row
        label={participantLabel(view.a, nameOf, groups, t)}
        participant={view.a}
        games={result?.gamesA}
        won={result?.winner === 'a'}
        lost={result?.winner === 'b'}
      />
      <span aria-hidden="true" className="mx-2 border-t border-court-100 dark:border-court-800" />
      <Row
        label={participantLabel(view.b, nameOf, groups, t)}
        participant={view.b}
        games={result?.gamesB}
        won={result?.winner === 'b'}
        lost={result?.winner === 'a'}
      />
    </>
  )

  return interactive ? (
    <button type="button" onClick={() => onOpen?.(view)} className={className} style={style}>
      {rows}
    </button>
  ) : (
    <div className={className} style={style}>
      {rows}
    </div>
  )
}

function Row({
  label,
  participant,
  games,
  won,
  lost,
}: {
  label: string
  participant: Participant
  games?: number
  won: boolean
  lost: boolean
}) {
  const named = participant.kind === 'player'
  return (
    <span className="relative flex min-h-0 flex-1 items-center gap-2 px-3">
      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          won ? 'font-bold' : lost ? 'text-court-500 dark:text-court-300' : ''
        } ${named ? '' : 'text-court-400 dark:text-court-400'}`}
      >
        {label}
      </span>
      {/* One figure per row, so the games column lines up down the whole tree. */}
      <span
        className={`num w-5 shrink-0 text-center text-sm tabular-nums ${
          won ? 'font-bold' : 'text-court-500 dark:text-court-300'
        }`}
      >
        {games ?? ''}
      </span>
    </span>
  )
}
