import { getAuthFromCookies } from "@/lib/google/server-auth";
import { google } from "googleapis";

export async function POST(request: Request) {
  const auth = await getAuthFromCookies();
  if (!auth) return Response.json({ error: "Not signed in" }, { status: 401 });

  const { fileId, addParentId, removeParentId } = await request.json();
  if (!fileId || !addParentId) {
    return Response.json({ error: "fileId and addParentId required" }, { status: 400 });
  }

  try {
    const drive = google.drive({ version: "v3", auth });
    await drive.files.update({
      fileId,
      addParents: addParentId,
      removeParents: removeParentId,
      fields: "id",
    });
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ error: err.message ?? "Drive error" }, { status: 500 });
  }
}
