import { cookies } from "next/headers";
import FileGraph       from "@/components/NodeGraph";
import ContextCard     from "@/components/ContextCard";
import NLSearch        from "@/components/NLSearch";
import VersionTree     from "@/components/VersionTree";
import DuplicateAlert  from "@/components/DuplicateAlert";
import GoogleAuthButton from "@/components/GoogleAuthButton";

export const metadata = { title: "ContextOS" };

export default async function ContextOSPage() {
  const cookieStore = await cookies();
  const signedIn = cookieStore.has("google_access_token");

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-green-600 text-white text-sm font-bold">C</span>
          <div>
            <h1 className="text-base font-bold text-zinc-900 dark:text-zinc-50 leading-none">ContextOS</h1>
            <p className="text-[10px] text-zinc-400 leading-tight mt-0.5">Smart File Management</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">v0.1.0</span>
          <GoogleAuthButton initialSignedIn={signedIn} />
        </div>
      </header>

      <div className="px-6 pt-4">
        <DuplicateAlert />
      </div>

      <main className="flex flex-1 gap-4 p-6 min-h-0">
        <aside className="flex flex-col gap-4 w-56 flex-shrink-0">
          <VersionTree />
          <ContextCard
            project="ASEAN Presentation"
            type="Slide Deck"
            status="Final Draft"
            people={["Asmita", "Isha"]}
            topics={["Food Security", "AI", "Satellite Data"]}
            lastChange="Added policy framework section"
            related={["Survey Questions", "Script", "Final Paper"]}
          />
        </aside>

        <div className="flex flex-col flex-1 min-h-0 gap-4" style={{ minHeight: 440 }}>
          <FileGraph />
        </div>
      </main>

      <div className="px-6 pb-6">
        <NLSearch />
      </div>
    </div>
  );
}