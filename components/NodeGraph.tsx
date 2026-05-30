"use client";

// Left-to-right tree with rounded elbow connectors.
// ViewBox exactly wraps all content so SVG always fits the container.

const STYLES = {
  main:    { fill: "#16a34a", stroke: "#15803d", text: "#ffffff" },
  draft:   { fill: "#f0fdf4", stroke: "#86efac", text: "#166534" },
  branch:  { fill: "#eff6ff", stroke: "#93c5fd", text: "#1e40af" },
  support: { fill: "#fefce8", stroke: "#fde047", text: "#854d0e" },
} as const;
type NT = keyof typeof STYLES;

const NH = 36, NHM = 44, RX = 7, R = 8; // R = elbow corner radius

const nodes: { id: string; label: string; type: NT; cx: number; cy: number; w: number; h: number }[] = [
  { id: "main", label: "Final Presentation",  type: "main",    cx: 85,  cy: 175, w: 152, h: NHM },
  { id: "sv1",  label: "Slide Deck v1",       type: "draft",   cx: 275, cy: 90,  w: 118, h: NH  },
  { id: "sv2",  label: "Slide Deck v2",       type: "draft",   cx: 275, cy: 175, w: 118, h: NH  },
  { id: "sq",   label: "Survey Questions",    type: "support", cx: 275, cy: 262, w: 128, h: NH  },
  { id: "fs",   label: "Food Security Br.",   type: "branch",  cx: 430, cy: 60,  w: 120, h: NH  },
  { id: "be",   label: "Blue Economy Br.",    type: "branch",  cx: 430, cy: 120, w: 120, h: NH  },
  { id: "fp",   label: "Final Paper",         type: "support", cx: 430, cy: 262, w: 100, h: NH  },
];

// Bus x-coordinates for orthogonal routing
const B1 = 188; // between main-right (161) and sv1-left (216)
const B2 = 352; // between sv1-right (334) and fs-left (370)

// Rounded elbow path: parent exits right at (px, py), child enters left at (cx, cy).
// Uses quadratic bezier at both corners with radius R.
function elbowPath(px: number, py: number, cx: number, cy: number, bx: number): string {
  if (py === cy) return `M ${px} ${py} H ${cx}`; // straight line, no corners
  const up = cy < py;
  const s = up ? -1 : 1;
  return [
    `M ${px} ${py}`,
    `H ${bx - R}`,
    `Q ${bx} ${py} ${bx} ${py + s * R}`, // first corner: right → up/down
    `V ${cy - s * R}`,
    `Q ${bx} ${cy} ${bx + R} ${cy}`,      // second corner: up/down → right
    `H ${cx}`,
  ].join(" ");
}

const edges = [
  elbowPath(161, 175, 216, 90,  B1),  // main → sv1
  elbowPath(161, 175, 216, 175, B1),  // main → sv2 (straight)
  elbowPath(161, 175, 211, 262, B1),  // main → sq
  elbowPath(334, 90,  370, 60,  B2),  // sv1  → fs
  elbowPath(334, 90,  370, 120, B2),  // sv1  → be
  elbowPath(339, 262, 380, 262, B2),  // sq   → fp (straight)
];

export default function FileGraph() {
  return (
    <div className="relative flex-1 min-h-0 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
      <div className="absolute top-3 left-4 text-xs font-semibold text-zinc-400 uppercase tracking-wide z-10">
        File Graph
      </div>

      {/* preserveAspectRatio="xMidYMid meet" ensures the whole tree is always visible */}
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 510 330"
        preserveAspectRatio="xMidYMid meet"
        className="block"
      >
        {/* Connector paths */}
        {edges.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="#a1a1aa" strokeWidth={1.5} />
        ))}

        {/* Nodes */}
        {nodes.map((n) => {
          const s = STYLES[n.type];
          return (
            <g key={n.id} className="cursor-pointer">
              <rect
                x={n.cx - n.w / 2} y={n.cy - n.h / 2}
                width={n.w} height={n.h} rx={RX}
                fill={s.fill} stroke={s.stroke}
                strokeWidth={n.type === "main" ? 2 : 1.5}
              />
              <text
                x={n.cx} y={n.cy + 4}
                textAnchor="middle"
                fontSize={n.type === "main" ? 11 : 9.5}
                fontWeight={n.type === "main" ? 700 : 500}
                fill={s.text}
                fontFamily="system-ui,-apple-system,sans-serif"
              >
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-3 right-4 flex flex-col gap-1.5">
        {(Object.entries(STYLES) as [NT, (typeof STYLES)[NT]][]).map(([t, s]) => (
          <div key={t} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-2.5 rounded-sm"
              style={{ background: s.fill, border: `1.5px solid ${s.stroke}` }} />
            <span className="text-[10px] text-zinc-400 capitalize">{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
