// Vertical indented tree sized to fit the w-56 sidebar.
// ViewBox ≈ sidebar inner width so SVG renders near 1:1 — no tiny text.

const NH = 20; // node height px
const W  = 190;
const H  = 255;

const STATUS = {
  draft:  { fill: "#fefce8", stroke: "#ca8a04", text: "#854d0e" },
  final:  { fill: "#f0fdf4", stroke: "#16a34a", text: "#166534" },
  branch: { fill: "#eff6ff", stroke: "#3b82f6", text: "#1e40af" },
} as const;
type Status = keyof typeof STATUS;

// cx/cy = center, w = width
const nodes: { id: string; label: string; status: Status; cx: number; cy: number; w: number }[] = [
  { id: "root", label: "ASEAN Draft",         status: "draft",  cx: 95,  cy: 14,  w: 182 },
  { id: "sq",   label: "Survey Questions",     status: "final",  cx: 97,  cy: 60,  w: 158 },
  { id: "sv1",  label: "Slide Deck v1",        status: "draft",  cx: 97,  cy: 105, w: 158 },
  { id: "fs",   label: "Food Security Br.",    status: "branch", cx: 100, cy: 153, w: 142 },
  { id: "be",   label: "Blue Economy Br.",     status: "branch", cx: 100, cy: 188, w: 142 },
  { id: "fp",   label: "Final Presentation",   status: "final",  cx: 97,  cy: 235, w: 158 },
];

const XS1 = 7;   // main stem x (root → level-1 children)
const XS2 = 21;  // sub-stem x  (sv1  → level-2 children)

// Level-1 left edge: 97 - 158/2 = 18
// Level-2 left edge: 100 - 142/2 = 29
const lines: [number, number, number, number][] = [
  [XS1, 24,  XS1, 235], // main vertical stem
  [XS1, 60,  18,  60 ], // elbow → Survey Questions
  [XS1, 105, 18,  105], // elbow → Slide Deck v1
  [XS1, 235, 18,  235], // elbow → Final Presentation
  [XS2, 115, XS2, 188], // sub-stem under sv1
  [XS2, 153, 29,  153], // elbow → Food Security
  [XS2, 188, 29,  188], // elbow → Blue Economy
];

export default function VersionTree() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
        Version Tree
      </span>

      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: "block", overflow: "visible" }}
      >
        {lines.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#a1a1aa" strokeWidth={1.2} />
        ))}

        {nodes.map((n) => {
          const s = STATUS[n.status];
          return (
            <g key={n.id}>
              <rect
                x={n.cx - n.w / 2}
                y={n.cy - NH / 2}
                width={n.w}
                height={NH}
                rx={6}
                fill={s.fill}
                stroke={s.stroke}
                strokeWidth={1.5}
              />
              <text
                x={n.cx}
                y={n.cy + 4}
                textAnchor="middle"
                fontSize={9}
                fontWeight={600}
                fill={s.text}
                fontFamily="system-ui,-apple-system,sans-serif"
              >
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex gap-3 pt-1 border-t border-zinc-100 dark:border-zinc-800">
        {(Object.entries(STATUS) as [Status, (typeof STATUS)[Status]][]).map(([k, s]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ background: s.fill, border: `1.5px solid ${s.stroke}` }}
            />
            <span className="text-[10px] text-zinc-400 capitalize">{k}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
