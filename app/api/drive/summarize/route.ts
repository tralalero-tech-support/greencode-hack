import { cookies } from "next/headers";
import { getAuthenticatedClient } from "@/lib/google/auth";
import { listFiles } from "@/lib/google/drive";
import { enrichFiles } from "@/lib/drive-content";
import { summarizeFiles } from "@/lib/gemini/search";
import type { CachedFile } from "@/lib/drive-cache";

const BATCH_SIZE = 20; // files per GPT-4o-mini call

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function POST() {
  const cookieStore  = await cookies();
  const accessToken  = cookieStore.get("google_access_token")?.value;
  const refreshToken = cookieStore.get("google_refresh_token")?.value;

  if (!accessToken) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const auth = getAuthenticatedClient(accessToken, refreshToken);

    // 1. Fetch all files (up to 500)
    const { files } = await listFiles(auth, { pageSize: 500, orderBy: "modifiedTime desc" });

    // 2. Extract content from ALL eligible files (concurrency-limited to avoid rate limits)
    const enriched = await enrichFiles(auth, files);

    // 3. Batch-summarize with GPT-4o-mini
    const batches    = chunk(enriched, BATCH_SIZE);
    const summaries  = (await Promise.all(batches.map(summarizeFiles))).flat();
    const summaryMap = new Map(summaries.map((s) => [s.id, s.summary]));

    // 4. Build CachedFile list
    const cachedFiles: CachedFile[] = enriched.map((f) => ({
      id:           f.id,
      name:         f.name,
      mimeType:     f.mimeType,
      modifiedTime: f.modifiedTime,
      webViewLink:  f.webViewLink,
      lastEditedBy: f.lastEditedBy,
      owner:        f.owner,
      summary:      summaryMap.get(f.id) ?? f.name,
    }));

    const latestModifiedTime =
      cachedFiles.length > 0 ? cachedFiles[0].modifiedTime : new Date().toISOString();

    return Response.json({
      files:              cachedFiles,
      syncedAt:           new Date().toISOString(),
      latestModifiedTime,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[/api/drive/summarize]", err);
    return Response.json({ error: message }, { status: 500 });
  }
}
