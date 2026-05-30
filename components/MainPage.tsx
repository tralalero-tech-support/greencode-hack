'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import FileGraph       from "@/components/NodeGraph";
import ContextCard     from "@/components/ContextCard";
import NLSearch        from "@/components/NLSearch";
import VersionTree     from "@/components/VersionTree";
import DuplicateAlert  from "@/components/DuplicateAlert";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import ThemeToggle      from "@/components/ThemeToggle";

type Props = { initialSignedIn: boolean };

export default function MainPage({ initialSignedIn }: Props) {
  const [activeTab, setActiveTab] = useState<'main' | 'duplicates'>('main')
  const [signedIn, setSignedIn] = useState(initialSignedIn)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get("auth_success")) {
      setSignedIn(true)
      router.replace("/")
    }
    if (searchParams.get("auth_error")) {
      setSignedIn(false)
      router.replace("/")
    }
  }, [searchParams, router])

  return (
    <div className="flex flex-col min-h-screen bg-blue-50 dark:bg-slate-950 font-sans">
      <header className="flex items-center justify-between px-6 py-4 border-b border-blue-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white text-sm font-bold">F</span>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-50 leading-none">FileAtlas</h1>
            <p className="text-[10px] text-slate-400 leading-tight mt-0.5">Smart File Management</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">v0.1.0</span>
          <ThemeToggle />
          <GoogleAuthButton initialSignedIn={signedIn} onSignedInChange={setSignedIn} />
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 px-6 py-3 bg-white dark:bg-slate-900 border-b border-blue-100 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('main')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'main'
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              : 'text-slate-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-slate-800'
          }`}
        >
          Main Dashboard
        </button>
        <button
          onClick={() => setActiveTab('duplicates')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'duplicates'
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              : 'text-slate-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-slate-800'
          }`}
        >
          Duplicate Scanner
        </button>
      </div>

      {activeTab === 'main' ? (
        <main className="flex flex-1 gap-4 p-6 min-h-0">
          <aside className="flex flex-col gap-4 w-56 shrink-0">
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
      ) : (
        <main className="flex-1 p-6">
          <div className="max-w-5xl mx-auto">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2">
                Duplicate File Scanner
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                Scan your Google Drive for duplicate files and merge them into organized version trees.
              </p>
            </div>
            <DuplicateAlert signedIn={signedIn} />
          </div>
        </main>
      )}

      {activeTab === 'main' && (
        <div className="px-6 pb-6">
          <NLSearch signedIn={signedIn} />
        </div>
      )}
    </div>
  );
}
