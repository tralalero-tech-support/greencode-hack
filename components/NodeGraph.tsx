"use client";

type FileNode = {
  id: string;
  label: string;
  type: "main" | "draft" | "branch" | "support" | "collaborator";
  x: number;
  y: number;
};

const nodes: FileNode[] = [
  { id: "main",    label: "Final Presentation",      type: "main",         x: 210, y: 120 },
  { id: "d1",      label: "Slide Deck v1",            type: "draft",        x: 80,  y: 230 },
  { id: "d2",      label: "Slide Deck v2",            type: "draft",        x: 200, y: 250 },
  { id: "b1",      label: "Food Security Branch",     type: "branch",       x: 50,  y: 340 },
  { id: "b2",      label: "Blue Economy Branch",      type: "branch",       x: 180, y: 355 },
  { id: "s1",      label: "Survey Questions",         type: "support",      x: 340, y: 240 },
  { id: "s2",      label: "Final Paper",              type: "support",      x: 355, y: 330 },
  { id: "c1",      label: "Isha",                     type: "collaborator", x: 310, y: 110 },
  { id: "c2",      label: "Asmita",                   type: "collaborator", x: 370, y: 160 },
];

const edges: [string, string][] = [
  ["main", "d1"],
  ["main", "d2"],
  ["main", "s1"],
  ["main", "c1"],
  ["main", "c2"],
  ["d1",   "b1"],
  ["d2",   "b2"],
  ["s1",   "s2"],
];

const typeStyles: Record<FileNode["type"], { fill: string; stroke: string; textFill: string }> = {
  main:         { fill: "#16a34a", stroke: "#15803d", textFill: "#fff"     },
  draft:        { fill: "#f0fdf4", stroke: "#86efac", textFill: "#166534"  },
  branch:       { fill: "#eff6ff", stroke: "#93c5fd", textFill: "#1e40af"  },
  support:      { fill: "#fefce8", stroke: "#fde047", textFill: "#854d0e"  },
  collaborator: { fill: "#faf5ff", stroke: "#d8b4fe", textFill: "#6b21a8"  },
};

function getNode(id: string) {
  return nodes.find((n) => n.id === id)!;
}

export default function FileGraph() {
  return (
    <div className="relative flex-1 min-h-0 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
      <div className="absolute top-3 left-4 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
        File Graph
      </div>

      <svg width="100%" height="100%" viewBox="0 0 440 400" className="block">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#d1d5db" />
          </marker>
        </defs>

        {edges.map(([from, to]) => {
          const a = getNode(from);
          const b = getNode(to);
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2 - 20;
          return (
            <path
              key={`${from}-${to}`}
              d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`}
              fill="none"
              stroke="#d1d5db"
              strokeWidth={1.5}
              markerEnd="url(#arrow)"
            />
          );
        })}

        {nodes.map((node) => {
          const s = typeStyles[node.type];
          const isMain = node.type === "main";
          const w = isMain ? 130 : 108;
          const h = isMain ? 36 : 28;
          const r = isMain ? 10 : 8;
          return (
            <g key={node.id} className="cursor-pointer">
              <rect
                x={node.x - w / 2}
                y={node.y - h / 2}
                width={w}
                height={h}
                rx={r}
                fill={s.fill}
                stroke={s.stroke}
                strokeWidth={isMain ? 2 : 1.5}
              />
              <text
                x={node.x}
                y={node.y + 5}
                textAnchor="middle"
                fontSize={isMain ? 11 : 9}
                fontWeight={isMain ? 700 : 500}
                fill={s.textFill}
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-3 right-4 flex flex-col gap-1">
        {(["main", "draft", "branch", "support", "collaborator"] as FileNode["type"][]).map((t) => (
          <div key={t} className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ background: typeStyles[t].fill, border: `1px solid ${typeStyles[t].stroke}` }}
            />
            <span className="text-[10px] text-zinc-400 capitalize">{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
