"use client";

import { useState } from "react";

const EXAMPLE_QUERIES = [
  "the pitch deck Isha edited last week about the ASEAN project",
  "the final resume version I sent to BofA",
  "file with the chart about customer satisfaction",
  "the old version before I changed the conclusion",
];

const MOCK_RESULTS = [
  { name: "ASEAN_Final_Presentation.pptx", project: "ASEAN Project", status: "Final Draft", people: ["Isha", "Asmita"], modified: "3 days ago" },
  { name: "Slide_Deck_v2.pptx",            project: "ASEAN Project", status: "Draft",       people: ["Isha"],            modified: "5 days ago" },
];

export default function NLSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<typeof MOCK_RESULTS>([]);
  const [searched, setSearched] = useState(false);

  function handleSearch(q = query) {
    if (!q.trim()) return;
    setQuery(q);
    setResults(MOCK_RESULTS);
    setSearched(true);
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Natural Language Search</span>

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder='Try "the deck Isha edited about ASEAN"…'
          className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          onClick={() => handleSearch()}
          className="rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          Search
        </button>
      </div>

      {!searched && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-zinc-400 uppercase tracking-wide font-medium">Examples</span>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => handleSearch(q)}
                className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs text-zinc-500 hover:border-green-400 hover:text-green-600 dark:hover:text-green-400 transition-colors text-left"
              >
                "{q}"
              </button>
            ))}
          </div>
        </div>
      )}

      {searched && (
        <div className="flex flex-col gap-2">
          <span className="text-xs text-zinc-400">{results.length} result{results.length !== 1 ? "s" : ""} for "{query}"</span>
          {results.map((r) => (
            <div key={r.name} className="flex items-center justify-between rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 px-3 py-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{r.name}</span>
                <span className="text-xs text-zinc-400">{r.project} · {r.people.join(", ")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 text-[10px] font-semibold px-2 py-0.5">
                  {r.status}
                </span>
                <span className="text-[10px] text-zinc-400">{r.modified}</span>
              </div>
            </div>
          ))}
          <button
            onClick={() => { setSearched(false); setQuery(""); }}
            className="text-xs text-zinc-400 hover:text-zinc-600 self-start"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
