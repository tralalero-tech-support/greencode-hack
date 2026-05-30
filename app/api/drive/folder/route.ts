import { getAuthFromCookies } from "@/lib/google/server-auth";
import { createFolder } from "@/lib/google/drive";

export async function POST(request: Request) {
  const auth = await getAuthFromCookies();
  if (!auth) return Response.json({ error: "Not signed in" }, { status: 401 });

  const { name, parentId } = await request.json();
  if (!name) return Response.json({ error: "name required" }, { status: 400 });

  try {
    const folder = await createFolder(auth, name, parentId ?? undefined);
    return Response.json({ id: folder.id, name: folder.name });
  } catch (err: any) {
    return Response.json({ error: err.message ?? "Drive error" }, { status: 500 });
  }
}
