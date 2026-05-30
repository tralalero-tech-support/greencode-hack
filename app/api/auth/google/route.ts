import { getAuthUrl } from "@/lib/google/auth";

export function GET() {
  const url = getAuthUrl();
  return Response.redirect(url);
}
