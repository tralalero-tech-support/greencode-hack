import { cookies } from "next/headers";
import { getAuthenticatedClient } from "@/lib/google/auth";
import { createFolder } from "@/lib/google/drive";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("google_access_token")?.value;
  if (!token) return Response.json({ error: "Not signed in" }, { status: 401 });

  const { name, parentId } = await request.json();
  if (!name) return Response.json({ error: "name required" }, { status: 400 });

  try {
    const auth   = getAuthenticatedClient(token);
    const folder = await createFolder(auth, name, parentId ?? undefined);
    return Response.json({ id: folder.id, name: folder.name });
  } catch (err: any) {
    return Response.json({ error: err.message ?? "Drive error" }, { status: 500 });
  }
}
