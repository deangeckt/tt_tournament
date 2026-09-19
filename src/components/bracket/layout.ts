import type { Match, MatchId, Side } from '../../engine/types'

/**
 * Geometry of a knockout tree, worked out from the fixture graph alone.
 *
 * Pure on purpose, and kept apart from the component that paints it: the numbers
 * below are the whole of what makes a bracket *look* like a bracket — each round's
 * matches centred on the pair that feeds them — and that is the part worth a test
 * without a DOM. Every value is a CSS pixel measured from the inline start, so the
 * component places nodes with `inset-inline-start` and the tree reads right-to-left
 * in Hebrew without a second set of coordinates.
 *
 * The tree is assumed perfect — round r holds half as many matches as round r-1 —
 * which is what `generateSingleElim` produces and what a padded bracket is. The
 * edges, though, are read off the `winnerOf` slots rather than assumed from the
 * order, so a match is joined to what actually feeds it.
 *
 * A tree is drawn to the size of the *field*, not of the bracket. Twelve players in
 * three groups send six into an eight-slot bracket, and the engine is right to start
 * that at the quarter-finals — but a club that entered twelve reads its knockout as
 * 1/8, 1/4, 1/2, final, and a tree that opens at the quarters looks like one with a
 * stage torn off. So `minRounds` (see `roundsForField`) pads the drawing with
 * *seats*: leading rounds in which each entrant walks over a bye into the first real
 * match, exactly as a sixteen-draw with byes would be chalked on a board. Eight
 * players get an eight-tree, so a small night is not stretched to look like a big
 * one. The seats exist only here. They have no match id, take no score, and change
 * nothing about which results belong to which match.
 */
export interface TreeMetrics {
  nodeWidth: number
  nodeHeight: number
  /** Vertical space between two first-round nodes. */
  rowGap: number
  /** Horizontal space between one round and the next; the connectors live in it. */
  columnGap: number
  /** Room above the nodes for each round's name. */
  headerHeight: number
}

export const TREE_METRICS: TreeMetrics = {
  nodeWidth: 156,
  nodeHeight: 66,
  rowGap: 12,
  columnGap: 32,
  headerHeight: 28,
}

/** How many rounds a knockout of this many entrants would take: the tree they expect. */
export function roundsForField(entrants: number): number {
  let rounds = 1
  while (2 ** rounds < entrants) rounds++
  return rounds
}

export type NodeBox =
  | {
      kind: 'match'
      id: MatchId
      /** Column as drawn, which is the fixture's round plus any padding in front. */
      round: number
      order: number
      x: number
      y: number
      /** Vertical centre — where a connector meets the node. */
      cy: number
    }
  | {
      kind: 'seat'
      /** Unique among nodes; never a real match id. */
      id: string
      round: number
      order: number
      x: number
      y: number
      cy: number
      /** The first real match this seat leads to, and which side of it. */
      matchId: MatchId
      side: Side
    }

export interface TreeEdge {
  from: string
  to: string
  /** Which of the target's two slots the source feeds; 'a' is drawn above 'b'. */
  side: Side
}

export interface TreeLayout {
  nodes: NodeBox[]
  byId: Map<string, NodeBox>
  edges: TreeEdge[]
  /** Columns drawn, padding included. */
  rounds: number
  /** The final's node, which the champion leaf hangs off. */
  final?: NodeBox
  /** Where the champion leaf sits, one column past the final. */
  champion: { x: number; y: number; cy: number }
  width: number
  height: number
  columnX: (round: number) => number
}

export function layoutBracket(
  matches: readonly Match[],
  metrics: TreeMetrics = TREE_METRICS,
  minRounds = 1,
): TreeLayout | null {
  if (matches.length === 0) return null
  const { nodeWidth, nodeHeight, rowGap, columnGap, headerHeight } = metrics

  const realRounds = Math.max(...matches.map((m) => m.round)) + 1
  const rounds = Math.max(realRounds, minRounds)
  const padding = rounds - realRounds
  const pitch = nodeHeight + rowGap
  const columnX = (round: number) => round * (nodeWidth + columnGap)

  // Each round's pitch doubles, so a node sits level with the middle of the two
  // seats that feed it — the shape people recognise as a bracket.
  const place = (round: number, order: number) => {
    const cy = headerHeight + pitch * 2 ** round * (order + 0.5)
    return { round, order, x: columnX(round), y: cy - nodeHeight / 2, cy }
  }

  const nodes: NodeBox[] = matches.map((m) => ({
    kind: 'match',
    id: m.id,
    ...place(m.round + padding, m.order),
  }))

  const edges: TreeEdge[] = []
  const realIds = new Set(matches.map((m) => m.id))
  for (const m of matches) {
    for (const side of ['a', 'b'] as const) {
      const slot = m[side]
      if (slot.kind === 'winnerOf' && realIds.has(slot.matchId)) {
        edges.push({ from: slot.matchId, to: m.id, side })
      }
    }
  }

  // The padding: behind each side of each opening match, a chain of seats running
  // back to the first column. Only the chain that carries the entrant is drawn —
  // the seats a full sixteen-draw would leave empty are simply not there — and
  // every step of the chain is an a-side feed, so the entrant stays on the upper
  // path and the geometry holds.
  for (const m of matches) {
    if (m.round !== 0) continue
    for (const side of ['a', 'b'] as const) {
      let order = m.order * 2 + (side === 'a' ? 0 : 1)
      let to = m.id
      let toSide: Side = side
      for (let round = padding - 1; round >= 0; round--) {
        const id = `seat:${m.id}:${side}:${round}`
        nodes.push({ kind: 'seat', id, matchId: m.id, side, ...place(round, order) })
        edges.push({ from: id, to, side: toSide })
        to = id
        toSide = 'a'
        order *= 2
      }
    }
  }

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const final = nodes.find((n) => n.kind === 'match' && n.round === rounds - 1 && n.order === 0)
  const championCy = final?.cy ?? headerHeight + nodeHeight / 2
  const champion = { x: columnX(rounds), y: championCy - nodeHeight / 2, cy: championCy }

  return {
    nodes,
    byId,
    edges,
    rounds,
    final,
    champion,
    width: columnX(rounds) + nodeWidth,
    height: headerHeight + pitch * 2 ** (rounds - 1),
    columnX,
  }
}
