import { cookies } from "next/headers";
import MainPage from "@/components/MainPage";

export const metadata = { title: "FileAtlas" };

export default async function ContextOSPage() {
  const cookieStore = await cookies();
  const signedIn = cookieStore.has("google_access_token");

  return <MainPage initialSignedIn={signedIn} />;
}