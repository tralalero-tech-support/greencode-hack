import { type NextRequest } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete("google_access_token");
  cookieStore.delete("google_refresh_token");
  return Response.redirect(new URL("/", request.url));
}
