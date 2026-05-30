import { getAuthFromCookies } from "@/lib/google/server-auth";
import { google } from "googleapis";

export async function POST(request: Request) {
  const auth = await getAuthFromCookies();
  if (!auth) return Response.json({ error: "Not signed in" }, { status: 401 });

  const { name, mimeType, parentId } = await request.json();
  if (!name || !mimeType) return Response.json({ error: "name and mimeType required" }, { status: 400 });

  try {
    const drive = google.drive({ version: "v3", auth });
    const res = await drive.files.create({
      requestBody: {
        name,
        mimeType,
        parents: parentId ? [parentId] : undefined,
      },
      fields: "id,name,mimeType",
    });
    const file = res.data;
    return Response.json({ id: file.id, name: file.name, mimeType: file.mimeType });
  } catch (err: any) {
    return Response.json({ error: err.message ?? "Drive error" }, { status: 500 });
  }
}
