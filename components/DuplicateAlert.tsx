const duplicates = ["final.pdf", "final2.pdf", "final_REAL.pdf", "final_updated_NEW.pdf"];

export default function DuplicateAlert() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4">
      <span className="text-amber-500 text-lg leading-none mt-0.5">⚠</span>
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          Duplicate files detected
        </p>
        <div className="flex flex-wrap gap-1.5">
          {duplicates.map((f) => (
            <span
              key={f}
              className="rounded-md bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400 text-xs px-2 py-0.5 font-mono"
            >
              {f}
            </span>
          ))}
        </div>
        <p className="text-xs text-amber-600 dark:text-amber-400">
          These 4 files appear to be versions of the same document.{" "}
          <button className="underline font-medium hover:text-amber-800 dark:hover:text-amber-200 transition-colors">
            Merge into one version tree?
          </button>
        </p>
      </div>
    </div>
  );
}
