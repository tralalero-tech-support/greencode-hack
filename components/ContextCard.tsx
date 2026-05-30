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
    <div className="flex flex-col gap-3 rounded-xl border border-blue-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 min-w-[220px]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Context Card</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 text-[10px] font-semibold px-2 py-0.5">
          {status}
        </span>
      </div>

      <div className="flex flex-col gap-1.5 text-sm">
        <Row label="Project" value={project} />
        <Row label="Type" value={type} />
        <Row label="Last Change" value={lastChange} />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">People</span>
        <div className="flex flex-wrap gap-1">
          {people.map((p) => (
            <span key={p} className="rounded-full bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 text-[10px] px-2 py-0.5">
              {p}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Topics</span>
        <div className="flex flex-wrap gap-1">
          {topics.map((t) => (
            <span key={t} className="rounded-full bg-sky-50 dark:bg-sky-950 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-[10px] px-2 py-0.5">
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Related Files</span>
        <div className="flex flex-col gap-0.5">
          {related.map((r) => (
            <span key={r} className="text-xs text-slate-500 dark:text-slate-400">→ {r}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-slate-400 min-w-[80px] text-xs">{label}</span>
      <span className="text-slate-800 dark:text-slate-200 text-xs font-medium">{value}</span>
    </div>
  );
}
