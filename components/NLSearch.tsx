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
    <div className="flex flex-col gap-3 rounded-xl border border-blue-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Natural Language Search</span>

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder='Try "the deck Isha edited about ASEAN"…'
          className="flex-1 rounded-lg border border-blue-100 dark:border-slate-700 bg-blue-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => handleSearch()}
          className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          Search
        </button>
      </div>

      {!searched && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Examples</span>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => handleSearch(q)}
                className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-500 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left"
              >
                "{q}"
              </button>
            ))}
          </div>
        </div>
      )}

      {searched && (
        <div className="flex flex-col gap-2">
          <span className="text-xs text-slate-400">{results.length} result{results.length !== 1 ? "s" : ""} for "{query}"</span>
          {results.map((r) => (
            <div key={r.name} className="flex items-center justify-between rounded-lg bg-blue-50 dark:bg-slate-800 border border-blue-100 dark:border-slate-700 px-3 py-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{r.name}</span>
                <span className="text-xs text-slate-400">{r.project} · {r.people.join(", ")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 text-[10px] font-semibold px-2 py-0.5">
                  {r.status}
                </span>
                <span className="text-[10px] text-slate-400">{r.modified}</span>
              </div>
            </div>
          ))}
          <button
            onClick={() => { setSearched(false); setQuery(""); }}
            className="text-xs text-slate-400 hover:text-slate-600 self-start"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
