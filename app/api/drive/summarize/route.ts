import { cookies } from "next/headers";
import { getAuthenticatedClient } from "@/lib/google/auth";
import { listFiles, exportGoogleDoc } from "@/lib/google/drive";
import type { DriveFile } from "@/lib/google/types";
import { summarizeFiles, type FileForSummary } from "@/lib/gemini/search";
import type { CachedFile } from "@/lib/drive-cache";

const EXPORTABLE: Record<string, string> = {
  "application/vnd.google-apps.document":     "text/plain",
  "application/vnd.google-apps.spreadsheet":  "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};
const SNIPPET_LIMIT  = 600;
const BATCH_SIZE     = 20; // files per GPT call
const SNIPPET_FILES  = 30; // max files to extract content from

async function trySnippet(
  auth: ReturnType<typeof getAuthenticatedClient>,
  file: DriveFile
): Promise<string | null> {
  const mime = EXPORTABLE[file.mimeType];
  if (!mime) return null;
  try {
    const stream = await exportGoogleDoc(auth, file.id, mime);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks).toString("utf-8").replace(/\s+/g, " ").trim().slice(0, SNIPPET_LIMIT);
  } catch {
    return null;
  }
}

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

  const auth = getAuthenticatedClient(accessToken, refreshToken);

  // 1. Fetch all files (up to 500)
  const { files } = await listFiles(auth, { pageSize: 500, orderBy: "modifiedTime desc" });

  // 2. Enrich the most-recent text-based files with content snippets
  const enriched: FileForSummary[] = await Promise.all(
    files.map(async (file, i) => {
      const snippet = i < SNIPPET_FILES ? await trySnippet(auth, file) : null;
      return {
        id:             file.id,
        name:           file.name,
        mimeType:       file.mimeType,
        modifiedTime:   file.modifiedTime,
        lastEditedBy:   file.lastModifyingUser?.displayName,
        owner:          file.owners?.[0]?.displayName,
        description:    file.description ?? undefined,
        contentSnippet: snippet ?? undefined,
      };
    })
  );

  // 3. Batch-summarize with GPT-4o-mini
  const batches   = chunk(enriched, BATCH_SIZE);
  const summaries = (await Promise.all(batches.map(summarizeFiles))).flat();
  const summaryMap = new Map(summaries.map((s) => [s.id, s.summary]));

  // 4. Build CachedFile list
  const cachedFiles: CachedFile[] = enriched.map((f) => ({
    id:           f.id,
    name:         f.name,
    mimeType:     f.mimeType,
    modifiedTime: f.modifiedTime,
    webViewLink:  files.find((raw) => raw.id === f.id)?.webViewLink,
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
}
