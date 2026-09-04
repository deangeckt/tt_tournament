import type { FormatName } from '../../engine/types'

/**
 * Shape-only diagrams of each format, so a manager can tell them apart at a glance
 * without reading. They carry no text, which means they can be mirrored wholesale in
 * RTL without anything reading backwards.
 */

const DOT = 'currentColor'

function RoundRobin() {
  // Five players on a circle, every pair joined — the shape of "everyone plays
  // everyone" is instantly legible.
  const cx = 50
  const cy = 42
  const r = 27
  const points = Array.from({ length: 5 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  })
  const edges = points.flatMap((p, i) => points.slice(i + 1).map((q) => [p, q] as const))

  return (
    <svg viewBox="0 0 100 84" className="h-full w-full" aria-hidden="true">
      {edges.map(([p, q], i) => (
        <line
          key={i}
          x1={p.x}
          y1={p.y}
          x2={q.x}
          y2={q.y}
          stroke={DOT}
          strokeWidth="1.1"
          opacity="0.32"
        />
      ))}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="6" fill={DOT} />
      ))}
    </svg>
  )
}

function GroupsKnockout() {
  const groups = [6, 34, 62]
  return (
    <svg viewBox="0 0 100 84" className="h-full w-full" aria-hidden="true">
      {groups.map((x, gi) => (
        <g key={gi}>
          <rect
            x={x}
            y="6"
            width="26"
            height="34"
            rx="6"
            fill="none"
            stroke={DOT}
            strokeWidth="1.6"
            opacity="0.45"
          />
          {[0, 1, 2, 3].map((i) => (
            <circle
              key={i}
              cx={x + 8 + (i % 2) * 10}
              cy={15 + Math.floor(i / 2) * 12}
              r="3.6"
              fill={DOT}
              opacity={i < 2 ? 1 : 0.35}
            />
          ))}
          {/* Only the top two of each group carry on. */}
          <path
            d={`M${x + 13} 40 L${x + 13} 50`}
            stroke={DOT}
            strokeWidth="1.6"
            opacity="0.45"
            fill="none"
          />
        </g>
      ))}
      <path
        d="M19 50 H75 M19 50 V56 M47 50 V56 M75 50 V56"
        stroke={DOT}
        strokeWidth="1.6"
        opacity="0.45"
        fill="none"
      />
      <rect x="8" y="56" width="22" height="10" rx="5" fill={DOT} opacity="0.75" />
      <rect x="36" y="56" width="22" height="10" rx="5" fill={DOT} opacity="0.75" />
      <rect x="64" y="56" width="22" height="10" rx="5" fill={DOT} opacity="0.75" />
      <path d="M19 66 V72 H75 V66 M47 72 V78" stroke={DOT} strokeWidth="1.6" fill="none" />
      <circle cx="47" cy="79" r="4.5" fill={DOT} />
    </svg>
  )
}

/** A knockout tree: `rounds` columns collapsing to a single winner. */
function bracketPaths(rounds: number, top: number, height: number) {
  const paths: string[] = []
  const colWidth = 88 / rounds
  let count = 2 ** (rounds - 1)
  let y0 = top
  let spacing = height / count

  for (let r = 0; r < rounds; r++) {
    const x = 8 + r * colWidth
    for (let i = 0; i < count; i += 2) {
      const yA = y0 + spacing * (i + 0.5)
      const yB = y0 + spacing * (i + 1.5)
      const mid = (yA + yB) / 2
      paths.push(
        `M${x} ${yA} h${colWidth * 0.55} V${mid} H${x + colWidth} M${x} ${yB} h${colWidth * 0.55} V${mid}`,
      )
    }
    y0 += spacing / 2
    spacing *= 2
    count /= 2
  }
  return paths
}

function SingleElim() {
  return (
    <svg viewBox="0 0 100 84" className="h-full w-full" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <circle key={i} cx="8" cy={7 + i * 10} r="4" fill={DOT} />
      ))}
      {bracketPaths(3, 7, 70).map((d, i) => (
        <path key={i} d={d} stroke={DOT} strokeWidth="1.6" fill="none" opacity="0.55" />
      ))}
      <circle cx="94" cy="42" r="5.5" fill={DOT} />
    </svg>
  )
}

function DoubleElim() {
  return (
    <svg viewBox="0 0 100 84" className="h-full w-full" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx="8" cy={7 + i * 10} r="3.6" fill={DOT} />
      ))}
      {bracketPaths(2, 7, 30).map((d, i) => (
        <path key={i} d={d} stroke={DOT} strokeWidth="1.5" fill="none" opacity="0.6" />
      ))}
      {/* The losers bracket: a second chance running underneath. */}
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx="8" cy={52 + i * 10} r="3.6" fill={DOT} opacity="0.45" />
      ))}
      {bracketPaths(2, 52, 30).map((d, i) => (
        <path
          key={`l${i}`}
          d={d}
          stroke={DOT}
          strokeWidth="1.5"
          fill="none"
          opacity="0.3"
          strokeDasharray="3 2.5"
        />
      ))}
      <path
        d="M52 22 V42 H80 M52 67 V42"
        stroke={DOT}
        strokeWidth="1.5"
        fill="none"
        opacity="0.5"
      />
      <circle cx="86" cy="42" r="5.5" fill={DOT} />
    </svg>
  )
}

const DIAGRAMS: Record<FormatName, () => React.JSX.Element> = {
  roundRobin: RoundRobin,
  groupsKnockout: GroupsKnockout,
  singleElim: SingleElim,
  doubleElim: DoubleElim,
}

export function FormatDiagram({ format }: { format: FormatName }) {
  const Diagram = DIAGRAMS[format]
  // Mirrored in RTL so the tournament reads in the same direction as the text.
  return (
    <div className="text-court-600 rtl:-scale-x-100 dark:text-court-200">
      <Diagram />
    </div>
  )
}
