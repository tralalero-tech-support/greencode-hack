import { type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getAuthenticatedClient } from "@/lib/google/auth";
import { listFiles } from "@/lib/google/drive";
import { enrichFiles } from "@/lib/drive-content";
import { summarizeFiles } from "@/lib/gemini/search";
import type { CachedFile } from "@/lib/drive-cache";

// GET /api/drive/sync?since=<ISO timestamp>
export async function GET(request: NextRequest) {
  const cookieStore  = await cookies();
  const accessToken  = cookieStore.get("google_access_token")?.value;
  const refreshToken = cookieStore.get("google_refresh_token")?.value;

  if (!accessToken) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const since = request.nextUrl.searchParams.get("since");
  if (!since) {
    return Response.json({ error: "Missing ?since= parameter" }, { status: 400 });
  }

  const auth = getAuthenticatedClient(accessToken, refreshToken);

  // Only fetch files modified after the cached timestamp
  const { files } = await listFiles(auth, {
    query:    `modifiedTime > '${since}'`,
    pageSize: 100,
    orderBy:  "modifiedTime desc",
  });

  if (files.length === 0) {
    return Response.json({ newFiles: [] });
  }

  // Extract content from all new files and summarize
  const enriched   = await enrichFiles(auth, files);
  const summaries  = await summarizeFiles(enriched);
  const summaryMap = new Map(summaries.map((s) => [s.id, s.summary]));

  const newFiles: CachedFile[] = enriched.map((f) => ({
    id:           f.id,
    name:         f.name,
    mimeType:     f.mimeType,
    modifiedTime: f.modifiedTime,
    webViewLink:  f.webViewLink,
    lastEditedBy: f.lastEditedBy,
    owner:        f.owner,
    summary:      summaryMap.get(f.id) ?? f.name,
  }));

  return Response.json({ newFiles });
}
