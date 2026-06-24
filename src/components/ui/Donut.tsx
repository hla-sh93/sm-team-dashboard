/**
 * Small SVG donut for completion (منجز vs متبقّي). Pure presentational — safe in
 * server or client components. Shows the done fraction as a green arc over a
 * track, with the TOTAL count in the centre.
 */
export function Donut({
  done,
  total,
  size = 84,
  stroke = 11,
  doneColor = "var(--success, #16a34a)",
  trackColor = "var(--bg-elev-2, #e5e7eb)",
}: {
  done: number;
  total: number;
  size?: number;
  stroke?: number;
  doneColor?: string;
  trackColor?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const frac = total > 0 ? Math.min(1, done / total) : 0;
  const pct = total > 0 ? Math.round(frac * 100) : 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
      {frac > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={doneColor}
          strokeWidth={stroke}
          strokeDasharray={`${circ * frac} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
      <text
        x="50%"
        y="46%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-fg display-font"
        style={{ fontSize: size * 0.26 }}
      >
        {pct}%
      </text>
      <text
        x="50%"
        y="66%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-fg-muted"
        style={{ fontSize: size * 0.13 }}
      >
        {done}/{total}
      </text>
    </svg>
  );
}
