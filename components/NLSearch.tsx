"use client";

import { useState } from "react";
import type { SearchResult } from "@/lib/gemini/search";

const EXAMPLE_QUERIES = [
  "the pitch deck Isha edited last week about the ASEAN project",
  "the final resume version I sent to BofA",
  "file with the chart about customer satisfaction",
  "the old version before I changed the conclusion",
];

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "results"; results: SearchResult[]; query: string }
  | { status: "error"; message: string }
  | { status: "unauthenticated" };

function fileTypeLabel(mimeType: string): string {
  if (mimeType.includes("document"))     return "Doc";
  if (mimeType.includes("spreadsheet"))  return "Sheet";
  if (mimeType.includes("presentation")) return "Slides";
  if (mimeType.includes("pdf"))          return "PDF";
  if (mimeType.includes("folder"))       return "Folder";
  if (mimeType.includes("image"))        return "Image";
  if (mimeType.includes("video"))        return "Video";
  return "File";
}

function relevanceColor(score: number): string {
  if (score >= 0.8) return "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400";
  if (score >= 0.5) return "bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400";
  return "bg-zinc-100 dark:bg-zinc-800 text-zinc-500";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function NLSearch({ signedIn = false }: { signedIn?: boolean }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });

  async function handleSearch(q = query) {
    q = q.trim();
    if (!q) return;
    setQuery(q);

    if (!signedIn) {
      setState({ status: "unauthenticated" });
      return;
    }

    setState({ status: "loading" });

    try {
      const res = await fetch("/api/drive/search", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ query: q }),
      });

      if (res.status === 401) {
        setState({ status: "unauthenticated" });
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setState({ status: "error", message: data.error ?? "Search failed" });
        return;
      }

      setState({ status: "results", results: data.results, query: q });
    } catch {
      setState({ status: "error", message: "Network error — please try again" });
    }
  }

  function reset() {
    setState({ status: "idle" });
    setQuery("");
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
          disabled={state.status === "loading"}
          className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
        />
        <button
          onClick={() => handleSearch()}
          disabled={state.status === "loading" || !query.trim()}
          className="rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors min-w-[80px]"
        >
          {state.status === "loading" ? <Spinner /> : "Search"}
        </button>
      </div>

      {/* Example queries */}
      {state.status === "idle" && (
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

      {/* Loading */}
      {state.status === "loading" && (
        <p className="text-xs text-zinc-400 animate-pulse">
          Scanning your Drive with Gemini…
        </p>
      )}

      {/* Unauthenticated */}
      {state.status === "unauthenticated" && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          Sign in with Google first to search your Drive.
          <button onClick={reset} className="ml-2 underline text-xs">Dismiss</button>
        </div>
      )}

      {/* Error */}
      {state.status === "error" && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {state.message}
          <button onClick={reset} className="ml-2 underline text-xs">Try again</button>
        </div>
      )}

      {/* Results */}
      {state.status === "results" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">
              {state.results.length === 0
                ? `No matches found for "${state.query}"`
                : `${state.results.length} result${state.results.length !== 1 ? "s" : ""} for "${state.query}"`}
            </span>
            <button onClick={reset} className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
              Clear
            </button>
          </div>

          {state.results.map(({ file, relevanceScore, reason }) => (
            <a
              key={file.id}
              href={file.webViewLink ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start justify-between rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 px-3 py-2.5 hover:border-green-300 dark:hover:border-green-700 transition-colors group"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-zinc-400 uppercase">
                    {fileTypeLabel(file.mimeType)}
                  </span>
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors">
                    {file.name}
                  </span>
                </div>
                <span className="text-xs text-zinc-400 line-clamp-1">{reason}</span>
                {file.lastModifyingUser && (
                  <span className="text-[10px] text-zinc-400">
                    Last edited by {file.lastModifyingUser.displayName} · {timeAgo(file.modifiedTime)}
                  </span>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5 ml-3 flex-shrink-0">
                <span className={`rounded-full text-[10px] font-semibold px-2 py-0.5 ${relevanceColor(relevanceScore)}`}>
                  {Math.round(relevanceScore * 100)}% match
                </span>
              </div>
            </a>
          ))}

          {state.results.length === 0 && (
            <p className="text-xs text-zinc-400 py-2">
              Try rephrasing — e.g. mention who edited it, when, or what it was about.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin mx-auto" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}
