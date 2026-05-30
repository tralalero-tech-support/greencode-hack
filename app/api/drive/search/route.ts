import { type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getAuthenticatedClient } from "@/lib/google/auth";
import { listFiles, exportGoogleDoc } from "@/lib/google/drive";
import { searchDriveWithGemini } from "@/lib/gemini/search";
import type { DriveFile } from "@/lib/google/types";

// MIME types we can extract text from to give Gemini more signal
const EXPORTABLE_TYPES: Record<string, string> = {
  "application/vnd.google-apps.document":     "text/plain",
  "application/vnd.google-apps.spreadsheet":  "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};

const SNIPPET_CHAR_LIMIT = 800;

async function tryGetSnippet(
  auth: ReturnType<typeof getAuthenticatedClient>,
  file: DriveFile
): Promise<string | null> {
  const exportMime = EXPORTABLE_TYPES[file.mimeType];
  if (!exportMime) return null;
  try {
    const stream = await exportGoogleDoc(auth, file.id, exportMime);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const text = Buffer.concat(chunks).toString("utf-8").replace(/\s+/g, " ").trim();
    return text.slice(0, SNIPPET_CHAR_LIMIT);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  // Auth
  const cookieStore = await cookies();
  const accessToken  = cookieStore.get("google_access_token")?.value;
  const refreshToken = cookieStore.get("google_refresh_token")?.value;

  if (!accessToken) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Body
  let query: string;
  try {
    const body = await request.json();
    query = (body.query ?? "").trim();
    if (!query) throw new Error("empty");
  } catch {
    return Response.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const auth = getAuthenticatedClient(accessToken, refreshToken);

    // Fetch up to 200 files — enough context for Gemini without blowing the prompt
    const { files } = await listFiles(auth, {
      pageSize: 200,
      orderBy:  "modifiedTime desc",
    });

    // Enrich up to 10 text-based files with content snippets (keep latency reasonable)
    const enriched = await Promise.all(
      files.map(async (file, i) => {
        if (i >= 10 || !EXPORTABLE_TYPES[file.mimeType]) return file;
        const snippet = await tryGetSnippet(auth, file);
        return snippet ? { ...file, contentSnippet: snippet } : file;
      })
    );

    const results = await searchDriveWithGemini(query, enriched);

    return Response.json({ results });
  } catch (err) {
    console.error("Drive search error:", err);
    return Response.json({ error: "Search failed" }, { status: 500 });
  }
}
