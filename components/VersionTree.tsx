type TreeNode = { label: string; children?: TreeNode[]; status?: "final" | "draft" | "branch" };

const tree: TreeNode = {
  label: "ASEAN Draft",
  status: "draft",
  children: [
    { label: "Survey Questions", status: "final" },
    {
      label: "Slide Deck v1",
      status: "draft",
      children: [
        { label: "Food Security Branch", status: "branch" },
        { label: "Blue Economy Branch",  status: "branch" },
      ],
    },
    { label: "Final Presentation", status: "final" },
  ],
};

const statusDot: Record<string, string> = {
  final:  "bg-blue-500",
  draft:  "bg-yellow-400",
  branch: "bg-sky-400",
};

function TreeRow({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2" style={{ paddingLeft: depth * 16 }}>
        {depth > 0 && <span className="text-slate-300 dark:text-slate-600 text-xs">├─</span>}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot[node.status ?? "draft"]}`} />
        <span className="text-xs text-slate-700 dark:text-slate-300">{node.label}</span>
      </div>
      {node.children?.map((child) => (
        <TreeRow key={child.label} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function VersionTree() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-blue-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 min-w-[200px]">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Version Tree</span>
      <div className="flex flex-col gap-1.5">
        <TreeRow node={tree} />
      </div>
      <div className="flex gap-3 pt-1 border-t border-blue-50 dark:border-slate-800">
        {[["final", "Final"], ["draft", "Draft"], ["branch", "Branch"]].map(([k, label]) => (
          <div key={k} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${statusDot[k]}`} />
            <span className="text-[10px] text-slate-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
