'use client'

import { useState } from 'react'
import FileGraph       from "@/components/NodeGraph";
import NLSearch        from "@/components/NLSearch";
import DuplicateAlert  from "@/components/DuplicateAlert";
import GoogleAuthButton from "@/components/GoogleAuthButton";

type Props = { initialSignedIn: boolean };

export default function MainPage({ initialSignedIn }: Props) {
  const [activeTab, setActiveTab] = useState<'main' | 'duplicates'>('main')
  const [signedIn, setSignedIn] = useState(initialSignedIn)

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-green-600 text-white text-sm font-bold">F</span>
          <div>
            <h1 className="text-base font-bold text-zinc-900 dark:text-zinc-50 leading-none">FileAtlas</h1>
            <p className="text-[10px] text-zinc-400 leading-tight mt-0.5">Smart File Management</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">v0.1.0</span>
          <GoogleAuthButton initialSignedIn={signedIn} onSignedInChange={setSignedIn} />
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 px-6 py-3 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('main')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'main'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          Main Dashboard
        </button>
        <button
          onClick={() => setActiveTab('duplicates')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'duplicates'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          Duplicate Scanner
        </button>
      </div>

      {activeTab === 'main' ? (
        <main className="flex flex-1 p-6 min-h-0" style={{ minHeight: 440 }}>
          <FileGraph isSignedIn={signedIn} />
        </main>
      ) : (
        <main className="flex-1 p-6">
          <div className="max-w-5xl mx-auto">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
                Duplicate File Scanner
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400">
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
