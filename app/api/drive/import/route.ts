import { cookies } from "next/headers";
import { getAuthenticatedClient } from "@/lib/google/auth";
import { listFiles, getFile } from "@/lib/google/drive";
import type { OAuth2Client } from "googleapis-common";

const FOLDER_MIME = "application/vnd.google-apps.folder";
const MAX_DEPTH   = 8;

function guessExt(name: string, mimeType: string): string {
  if (mimeType.includes("presentation")) return "pptx";
  if (mimeType.includes("spreadsheet"))  return "xlsx";
  if (mimeType.includes("document"))     return "docx";
  if (mimeType.includes("pdf"))          return "pdf";
  const dot = name.lastIndexOf(".");
  return dot !== -1 ? name.slice(dot + 1).toLowerCase() : "file";
}

interface TreeFile   { id: string; name: string; ext: string }
interface TreeFolder { id: string; name: string; files: TreeFile[]; subfolders: TreeFolder[] }

async function buildTree(
  auth: OAuth2Client,
  folderId: string,
  depth: number,
): Promise<{ files: TreeFile[]; subfolders: TreeFolder[] }> {
  if (depth > MAX_DEPTH) return { files: [], subfolders: [] };

  const { files: all } = await listFiles(auth, {
    folderId,
    fields: "id,name,mimeType",
    pageSize: 200,
    orderBy: "folder,name asc",
  });

  const folderItems = all.filter(f => f.mimeType === FOLDER_MIME);
  const fileItems   = all.filter(f => f.mimeType !== FOLDER_MIME);

  const files: TreeFile[] = fileItems.map(f => ({
    id: f.id, name: f.name, ext: guessExt(f.name, f.mimeType),
  }));

  const subfolders: TreeFolder[] = [];
  for (const folder of folderItems) {
    const contents = await buildTree(auth, folder.id, depth + 1);
    subfolders.push({ id: folder.id, name: folder.name, ...contents });
  }

  return { files, subfolders };
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("google_access_token")?.value;
  if (!token) return Response.json({ error: "Not signed in" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get("folderId");
  if (!folderId) return Response.json({ error: "folderId required" }, { status: 400 });

  try {
    const auth     = getAuthenticatedClient(token);
    const meta     = await getFile(auth, folderId);
    const contents = await buildTree(auth, folderId, 0);
    return Response.json({ name: meta.name, ...contents });
  } catch (err: any) {
    return Response.json({ error: err.message ?? "Drive error" }, { status: 500 });
  }
}
