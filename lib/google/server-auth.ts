import { cookies } from "next/headers";
import { getAuthenticatedClient } from "./auth";
import type { OAuth2Client } from "googleapis-common";

const COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path:     "/",
  maxAge:   60 * 60 * 24 * 30,
};

export async function getAuthFromCookies(): Promise<OAuth2Client | null> {
  const cookieStore  = await cookies();
  const accessToken  = cookieStore.get("google_access_token")?.value;
  const refreshToken = cookieStore.get("google_refresh_token")?.value;
  if (!accessToken && !refreshToken) return null;

  const client = getAuthenticatedClient(accessToken ?? "", refreshToken);

  // When googleapis silently refreshes the token, write the new access token
  // back to the cookie so the next request uses it directly.
  client.on("tokens", (tokens) => {
    if (tokens.access_token) {
      cookieStore.set("google_access_token", tokens.access_token, COOKIE_OPTS);
    }
    if (tokens.refresh_token) {
      cookieStore.set("google_refresh_token", tokens.refresh_token, COOKIE_OPTS);
    }
  });

  return client;
}
