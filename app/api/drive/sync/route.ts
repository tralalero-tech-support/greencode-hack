import { type NextRequest } from "next/server";
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
const SNIPPET_LIMIT = 600;

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

  // Query Drive for files modified after the cached timestamp
  const { files } = await listFiles(auth, {
    query:    `modifiedTime > '${since}'`,
    pageSize: 100,
    orderBy:  "modifiedTime desc",
  });

  if (files.length === 0) {
    return Response.json({ newFiles: [] });
  }

  // Enrich + summarize the new files
  const enriched: FileForSummary[] = await Promise.all(
    files.map(async (file) => {
      const snippet = await trySnippet(auth, file);
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

  const summaries   = await summarizeFiles(enriched);
  const summaryMap  = new Map(summaries.map((s) => [s.id, s.summary]));

  const newFiles: CachedFile[] = enriched.map((f) => ({
    id:           f.id,
    name:         f.name,
    mimeType:     f.mimeType,
    modifiedTime: f.modifiedTime,
    webViewLink:  files.find((raw) => raw.id === f.id)?.webViewLink,
    lastEditedBy: f.lastEditedBy,
    owner:        f.owner,
    summary:      summaryMap.get(f.id) ?? f.name,
  }));

  return Response.json({ newFiles });
}
