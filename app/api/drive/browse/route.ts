import { getAuthFromCookies } from "@/lib/google/server-auth";
import { listFiles } from "@/lib/google/drive";

const FOLDER_MIME = "application/vnd.google-apps.folder";

function guessExt(name: string, mimeType: string): string {
  if (mimeType.includes("presentation")) return "pptx";
  if (mimeType.includes("spreadsheet"))  return "xlsx";
  if (mimeType.includes("document"))     return "docx";
  if (mimeType.includes("pdf"))          return "pdf";
  const dot = name.lastIndexOf(".");
  return dot !== -1 ? name.slice(dot + 1).toLowerCase() : "file";
}

export async function GET(request: Request) {
  const auth = await getAuthFromCookies();
  if (!auth) return Response.json({ error: "Not signed in" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get("folderId") ?? "root";

  try {
    const { files: all } = await listFiles(auth, {
      folderId,
      fields: "id,name,mimeType",
      pageSize: 200,
      orderBy: "folder,name asc",
    });

    const folders = all
      .filter(f => f.mimeType === FOLDER_MIME)
      .map(f => ({ id: f.id, name: f.name }));

    const files = all
      .filter(f => f.mimeType !== FOLDER_MIME)
      .map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType, ext: guessExt(f.name, f.mimeType) }));

    return Response.json({ folders, files });
  } catch (err: any) {
    return Response.json({ error: err.message ?? "Drive error" }, { status: 500 });
  }
}
