export const CACHE_KEY = "contextos_drive_cache";

export type CachedFile = {
  id:             string;
  name:           string;
  mimeType:       string;
  modifiedTime:   string;
  webViewLink?:   string;
  lastEditedBy?:  string;
  owner?:         string;
  summary:        string;
};

export type DriveCache = {
  syncedAt:           string; // ISO — when we last ran a full scan
  latestModifiedTime: string; // ISO — most recent file modifiedTime in cache
  files:              CachedFile[];
};

export function readCache(): DriveCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as DriveCache) : null;
  } catch {
    return null;
  }
}

export function writeCache(cache: DriveCache): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export function mergeNewFiles(cache: DriveCache, newFiles: CachedFile[]): DriveCache {
  const existing = new Map(cache.files.map((f) => [f.id, f]));
  for (const f of newFiles) existing.set(f.id, f);

  const merged = Array.from(existing.values()).sort(
    (a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()
  );

  const latestModifiedTime =
    merged.length > 0 ? merged[0].modifiedTime : cache.latestModifiedTime;

  return { ...cache, latestModifiedTime, files: merged };
}
