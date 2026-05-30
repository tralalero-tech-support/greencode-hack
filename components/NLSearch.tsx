"use client";

import { useEffect, useRef, useState } from "react";
import {
  readCache,
  writeCache,
  mergeNewFiles,
  type CachedFile,
  type DriveCache,
} from "@/lib/drive-cache";
import type { SearchResult } from "@/lib/gemini/search";

const EXAMPLE_QUERIES = [
  "the pitch deck Isha edited last week about the ASEAN project",
  "the final resume version I sent to BofA",
  "file with the chart about customer satisfaction",
  "the old version before I changed the conclusion",
];

type IndexState =
  | { status: "idle" }
  | { status: "indexing" }
  | { status: "syncing" }
  | { status: "ready"; fileCount: number }
  | { status: "error"; message: string };

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "results"; results: SearchResult[]; query: string }
  | { status: "error"; message: string };

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
  if (score >= 0.8) return "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400";
  if (score >= 0.5) return "bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400";
  return "bg-slate-100 dark:bg-slate-800 text-slate-500";
}

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function NLSearch({ signedIn = false }: { signedIn?: boolean }) {
  const [query,       setQuery]       = useState("");
  const [indexState,  setIndexState]  = useState<IndexState>({ status: "idle" });
  const [searchState, setSearchState] = useState<SearchState>({ status: "idle" });
  const cacheRef = useRef<DriveCache | null>(null);

  function runFullIndex() {
    setIndexState({ status: "indexing" });
    setSearchState({ status: "idle" });
    cacheRef.current = null;

    fetch("/api/drive/summarize", { method: "POST" })
      .then((r) => r.json())
      .then((data: { files?: CachedFile[]; syncedAt?: string; latestModifiedTime?: string }) => {
        if (!data.files) throw new Error("No files returned");
        const cache: DriveCache = {
          files:              data.files,
          syncedAt:           data.syncedAt ?? new Date().toISOString(),
          latestModifiedTime: data.latestModifiedTime ?? new Date().toISOString(),
        };
        writeCache(cache);
        cacheRef.current = cache;
        setIndexState({ status: "ready", fileCount: cache.files.length });
      })
      .catch((err) => {
        console.error("Indexing failed:", err);
        setIndexState({ status: "error", message: "Failed to index your Drive. Try refreshing." });
      });
  }

  // On mount: load cache or run first-time index
  useEffect(() => {
    if (!signedIn) return;

    const cached = readCache();

    if (cached) {
      cacheRef.current = cached;
      setIndexState({ status: "syncing" });

      fetch(`/api/drive/sync?since=${encodeURIComponent(cached.latestModifiedTime)}`)
        .then((r) => r.json())
        .then((data: { newFiles?: CachedFile[] }) => {
          if (data.newFiles && data.newFiles.length > 0) {
            const updated = mergeNewFiles(cached, data.newFiles);
            writeCache(updated);
            cacheRef.current = updated;
          }
          setIndexState({ status: "ready", fileCount: cacheRef.current!.files.length });
        })
        .catch(() => {
          setIndexState({ status: "ready", fileCount: cached.files.length });
        });
    } else {
      runFullIndex();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  async function handleSearch(q = query) {
    q = q.trim();
    if (!q || !cacheRef.current) return;
    setQuery(q);
    setSearchState({ status: "loading" });

    try {
      const res = await fetch("/api/drive/search", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ query: q, files: cacheRef.current.files }),
      });

      if (res.status === 401) {
        setSearchState({ status: "error", message: "Session expired — please sign in again." });
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setSearchState({ status: "error", message: data.error ?? "Search failed" });
        return;
      }

      setSearchState({ status: "results", results: data.results, query: q });
    } catch {
      setSearchState({ status: "error", message: "Network error — please try again." });
    }
  }

  const isReady   = indexState.status === "ready" || indexState.status === "syncing";
  const isLoading = searchState.status === "loading";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-blue-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Natural Language Search
        </span>
        <IndexBadge state={indexState} signedIn={signedIn} onReindex={runFullIndex} />
      </div>

      {/* Search bar */}
      {signedIn && (
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder='Try "the deck Isha edited about ASEAN"…'
            disabled={isLoading || !isReady}
            className="flex-1 rounded-lg border border-blue-100 dark:border-slate-700 bg-blue-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            onClick={() => handleSearch()}
            disabled={isLoading || !isReady || !query.trim()}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors min-w-[80px]"
          >
            {isLoading ? <Spinner /> : "Search"}
          </button>
        </div>
      )}

      {/* Not signed in */}
      {!signedIn && (
        <p className="text-sm text-slate-400">Sign in with Google to search your Drive.</p>
      )}

      {/* Example queries */}
      {signedIn && searchState.status === "idle" && isReady && (
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

      {/* Search loading */}
      {searchState.status === "loading" && (
        <p className="text-xs text-slate-400 animate-pulse">Searching your indexed Drive…</p>
      )}

      {/* Search error */}
      {searchState.status === "error" && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {searchState.message}
          <button
            onClick={() => setSearchState({ status: "idle" })}
            className="ml-2 underline text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Results */}
      {searchState.status === "results" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {searchState.results.length === 0
                ? `No matches for "${searchState.query}"`
                : `${searchState.results.length} result${searchState.results.length !== 1 ? "s" : ""} for "${searchState.query}"`}
            </span>
            <button
              onClick={() => { setSearchState({ status: "idle" }); setQuery(""); }}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Clear
            </button>
          </div>

          {searchState.results.map(({ file, relevanceScore, reason }) => (
            <a
              key={file.id}
              href={file.webViewLink ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start justify-between rounded-lg bg-blue-50 dark:bg-slate-800 border border-blue-100 dark:border-slate-700 px-3 py-2.5 hover:border-blue-300 dark:hover:border-blue-700 transition-colors group"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-slate-400 uppercase flex-shrink-0">
                    {fileTypeLabel(file.mimeType)}
                  </span>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                    {file.name}
                  </span>
                </div>
                <span className="text-xs text-slate-400 line-clamp-1">{reason}</span>
                {file.lastEditedBy && (
                  <span className="text-[10px] text-slate-400">
                    Last edited by {file.lastEditedBy} · {timeAgo(file.modifiedTime)}
                  </span>
                )}
              </div>
              <span className={`rounded-full text-[10px] font-semibold px-2 py-0.5 ml-3 flex-shrink-0 ${relevanceColor(relevanceScore)}`}>
                {Math.round(relevanceScore * 100)}%
              </span>
            </a>
          ))}

          {searchState.results.length === 0 && (
            <p className="text-xs text-slate-400 py-1">
              Try rephrasing — mention who edited it, when, or what it was about.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function IndexBadge({
  state,
  signedIn,
  onReindex,
}: {
  state: IndexState;
  signedIn: boolean;
  onReindex: () => void;
}) {
  if (!signedIn) return null;

  if (state.status === "indexing") {
    return (
      <span className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400">
        <Spinner size={10} /> Indexing Drive…
      </span>
    );
  }
  if (state.status === "syncing") {
    return (
      <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
        <Spinner size={10} /> Checking for new files…
      </span>
    );
  }
  if (state.status === "ready") {
    return (
      <span className="flex items-center gap-2 text-[10px] text-slate-400">
        {state.fileCount} files indexed
        <button
          onClick={onReindex}
          className="underline hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          Re-index
        </button>
      </span>
    );
  }
  if (state.status === "error") {
    return (
      <span className="flex items-center gap-2 text-[10px] text-red-500">
        {state.message}
        <button
          onClick={onReindex}
          className="underline hover:text-red-700 transition-colors"
        >
          Retry
        </button>
      </span>
    );
  }
  return null;
}

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}
