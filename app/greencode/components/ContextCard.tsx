type ContextCardProps = {
  project: string;
  type: string;
  status: string;
  people: string[];
  topics: string[];
  lastChange: string;
  related: string[];
};

export default function ContextCard({
  project, type, status, people, topics, lastChange, related,
}: ContextCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 min-w-[220px]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Context Card</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 text-[10px] font-semibold px-2 py-0.5">
          {status}
        </span>
      </div>

      <div className="flex flex-col gap-1.5 text-sm">
        <Row label="Project" value={project} />
        <Row label="Type" value={type} />
        <Row label="Last Change" value={lastChange} />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-zinc-400 uppercase tracking-wide font-medium">People</span>
        <div className="flex flex-wrap gap-1">
          {people.map((p) => (
            <span key={p} className="rounded-full bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-[10px] px-2 py-0.5">
              {p}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-zinc-400 uppercase tracking-wide font-medium">Topics</span>
        <div className="flex flex-wrap gap-1">
          {topics.map((t) => (
            <span key={t} className="rounded-full bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300 text-[10px] px-2 py-0.5">
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-zinc-400 uppercase tracking-wide font-medium">Related Files</span>
        <div className="flex flex-col gap-0.5">
          {related.map((r) => (
            <span key={r} className="text-xs text-zinc-500 dark:text-zinc-400">→ {r}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-zinc-400 min-w-[80px] text-xs">{label}</span>
      <span className="text-zinc-800 dark:text-zinc-200 text-xs font-medium">{value}</span>
    </div>
  );
}
