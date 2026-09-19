import { describe, expect, it } from 'vitest'
import { generateSingleElim } from '../../engine/formats/singleElim'
import type { Slot } from '../../engine/types'
import { layoutBracket, roundsForField, TREE_METRICS } from './layout'

const players = (n: number): Slot[] =>
  Array.from({ length: n }, (_, i) => ({ kind: 'player', playerId: `p${i}` }))

/** Geometry alone: no padding unless asked for. */
const bare = (n: number) => layoutBracket(generateSingleElim('L', players(n)))!

describe('bracket layout', () => {
  it('draws nothing for a level with no knockout', () => {
    expect(layoutBracket([])).toBeNull()
  })

  it('centres every match on the pair that feeds it', () => {
    const layout = bare(8)
    for (const edge of layout.edges) {
      const target = layout.byId.get(edge.to)!
      const feeders = layout.edges.filter((e) => e.to === edge.to).map((e) => layout.byId.get(e.from)!)
      expect(feeders).toHaveLength(2)
      const [upper, lower] = feeders.sort((a, b) => a.cy - b.cy)
      expect(target.cy).toBeCloseTo((upper.cy + lower.cy) / 2)
    }
  })

  it('puts the a-side feeder above the b-side one', () => {
    const layout = bare(8)
    for (const edge of layout.edges) {
      const source = layout.byId.get(edge.from)!
      const target = layout.byId.get(edge.to)!
      if (edge.side === 'a') expect(source.cy).toBeLessThan(target.cy)
      else expect(source.cy).toBeGreaterThan(target.cy)
    }
  })

  it('never overlaps two nodes in one column', () => {
    const layout = bare(16)
    for (let round = 0; round < layout.rounds; round++) {
      const column = layout.nodes.filter((n) => n.round === round).sort((a, b) => a.y - b.y)
      for (let i = 1; i < column.length; i++) {
        expect(column[i].y).toBeGreaterThanOrEqual(column[i - 1].y + TREE_METRICS.nodeHeight)
      }
    }
  })

  it('hangs the champion one column past the final, level with it', () => {
    const layout = bare(4)
    expect(layout.rounds).toBe(2)
    expect(layout.final?.round).toBe(1)
    expect(layout.champion.cy).toBe(layout.final!.cy)
    expect(layout.champion.x).toBe(layout.columnX(2))
    expect(layout.width).toBe(layout.champion.x + TREE_METRICS.nodeWidth)
  })

  it('is tall enough for the whole first round', () => {
    const layout = bare(8)
    const lowest = Math.max(...layout.nodes.map((n) => n.y + TREE_METRICS.nodeHeight))
    expect(layout.height).toBeGreaterThanOrEqual(lowest)
    expect(Math.min(...layout.nodes.map((n) => n.y))).toBeGreaterThanOrEqual(TREE_METRICS.headerHeight)
  })
})

describe('padding to the size of the field', () => {
  it('sizes the tree to the entrants, not the qualifiers', () => {
    // Twelve entered, so the club expects a 1/8; eight entered, a 1/4.
    expect(roundsForField(12)).toBe(4)
    expect(roundsForField(16)).toBe(4)
    expect(roundsForField(8)).toBe(3)
    expect(roundsForField(5)).toBe(3)
    expect(roundsForField(2)).toBe(1)
    expect(roundsForField(0)).toBe(1)
  })

  it('leaves a sixteen-draw or larger alone', () => {
    for (const n of [16, 32]) {
      const layout = layoutBracket(generateSingleElim('L', players(n)), TREE_METRICS, 4)!
      expect(layout.rounds).toBe(Math.log2(n))
      expect(layout.nodes.every((node) => node.kind === 'match')).toBe(true)
    }
  })

  it('opens an eight-slot bracket with a round of seats, one per entrant', () => {
    const matches = generateSingleElim('L', players(8))
    const layout = layoutBracket(matches, TREE_METRICS, 4)!
    expect(layout.rounds).toBe(4)

    const seats = layout.nodes.filter((n) => n.kind === 'seat')
    expect(seats).toHaveLength(8)
    expect(seats.every((s) => s.round === 0)).toBe(true)
    // The real quarter-finals moved one column along, keeping their own order.
    for (const m of matches.filter((m) => m.round === 0)) {
      const node = layout.byId.get(m.id)!
      expect(node.round).toBe(1)
      expect(node.order).toBe(m.order)
    }
  })

  it('feeds each seat into its own side of its own opening match', () => {
    const matches = generateSingleElim('L', players(8))
    const layout = layoutBracket(matches, TREE_METRICS, 4)!
    for (const m of matches.filter((m) => m.round === 0)) {
      for (const side of ['a', 'b'] as const) {
        const edge = layout.edges.find((e) => e.to === m.id && e.side === side)!
        const seat = layout.byId.get(edge.from)!
        expect(seat.kind).toBe('seat')
        if (seat.kind === 'seat') {
          expect(seat.matchId).toBe(m.id)
          expect(seat.side).toBe(side)
        }
        // Above for a, below for b — the same rule real feeders obey.
        if (side === 'a') expect(seat.cy).toBeLessThan(layout.byId.get(m.id)!.cy)
        else expect(seat.cy).toBeGreaterThan(layout.byId.get(m.id)!.cy)
      }
    }
  })

  it('runs a chain of seats back to the first column when two rounds are missing', () => {
    const matches = generateSingleElim('L', players(4))
    const layout = layoutBracket(matches, TREE_METRICS, 4)!
    expect(layout.rounds).toBe(4)
    const semi = matches.find((m) => m.round === 0 && m.order === 1)!
    const near = layout.byId.get(`seat:${semi.id}:b:1`)!
    const far = layout.byId.get(`seat:${semi.id}:b:0`)!
    expect(near.round).toBe(1)
    expect(far.round).toBe(0)
    // The far seat feeds the near one on its upper side, so the entrant's path
    // never drops below the seat it started in.
    expect(layout.edges).toContainEqual({ from: far.id, to: near.id, side: 'a' })
    expect(layout.edges).toContainEqual({ from: near.id, to: semi.id, side: 'b' })
    expect(far.cy).toBeLessThan(near.cy)
    // The empty seats a full draw would hold are not drawn at all.
    expect(layout.nodes.filter((n) => n.round === 0)).toHaveLength(4)
  })

  it('is as tall as a full sixteen-draw', () => {
    const layout = layoutBracket(generateSingleElim('L', players(4)), TREE_METRICS, 4)!
    const pitch = TREE_METRICS.nodeHeight + TREE_METRICS.rowGap
    expect(layout.height).toBe(TREE_METRICS.headerHeight + pitch * 8)
  })
})
