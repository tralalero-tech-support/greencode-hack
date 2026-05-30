import { type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForTokens } from "@/lib/google/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const error = searchParams.get("error");
  if (error) {
    return Response.redirect(new URL(`/greencode?auth_error=${encodeURIComponent(error)}`, request.url));
  }

  const code = searchParams.get("code");
  if (!code) {
    return Response.redirect(new URL("/greencode?auth_error=missing_code", request.url));
  }

  const tokens = await exchangeCodeForTokens(code);

  const cookieStore = await cookies();
  const maxAge = 60 * 60 * 24 * 30; // 30 days

  cookieStore.set("google_access_token", tokens.access_token ?? "", {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge,
  });

  if (tokens.refresh_token) {
    cookieStore.set("google_refresh_token", tokens.refresh_token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      path:     "/",
      maxAge,
    });
  }

  return Response.redirect(new URL("/greencode?auth_success=1", request.url));
}
