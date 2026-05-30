import { type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { searchWithSummaries } from "@/lib/gemini/search";
import type { CachedFile } from "@/lib/drive-cache";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("google_access_token")?.value;

  if (!accessToken) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  let query: string;
  let files: CachedFile[];

  try {
    const body = await request.json();
    query = (body.query ?? "").trim();
    files = body.files ?? [];
    if (!query) throw new Error("empty query");
    if (!Array.isArray(files)) throw new Error("files must be an array");
  } catch {
    return Response.json({ error: "Missing query or files" }, { status: 400 });
  }

  try {
    const results = await searchWithSummaries(query, files);
    return Response.json({ results });
  } catch (err) {
    console.error("Drive search error:", err);
    return Response.json({ error: "Search failed" }, { status: 500 });
  }
}
