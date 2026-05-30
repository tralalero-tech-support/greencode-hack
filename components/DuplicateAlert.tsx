'use client'

import { useState, useEffect } from 'react'
import { chaosScore } from '../lib/clusterFiles'

const colorMap = {
  red:   { border: 'border-red-200 dark:border-red-800',     bg: 'bg-red-50 dark:bg-red-950/40',     icon: 'text-red-500',   title: 'text-red-800 dark:text-red-300',   sub: 'text-red-600 dark:text-red-400',   tag: 'border-red-200 dark:border-red-700 text-red-700 dark:text-red-400'   },
  amber: { border: 'border-amber-200 dark:border-amber-800', bg: 'bg-amber-50 dark:bg-amber-950/40', icon: 'text-amber-500', title: 'text-amber-800 dark:text-amber-300', sub: 'text-amber-600 dark:text-amber-400', tag: 'border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400' },
  green: { border: 'border-green-200 dark:border-green-800', bg: 'bg-green-50 dark:bg-green-950/40', icon: 'text-green-500', title: 'text-green-800 dark:text-green-300', sub: 'text-green-600 dark:text-green-400', tag: 'border-green-200 dark:border-green-700 text-green-700 dark:text-green-400' },
}

type Cluster = {
  files: string[]
  label: string
  color: 'red' | 'amber' | 'green'
  score: number
}

export default function DuplicateAlert() {
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [totalFiles, setTotalFiles] = useState(0)
  const [loading, setLoading] = useState(true)
  const [notAuthed, setNotAuthed] = useState(false)
  const [merging, setMerging] = useState<number | null>(null)
  const [merged, setMerged] = useState<number[]>([])

  useEffect(() => {
    async function scan() {
      try {
        const res = await fetch('/api/drive/scan')
        const data = await res.json()

        if (!data.success && data.error === 'Not authenticated') {
          setNotAuthed(true)
          return
        }

        setClusters(data.chaoticClusters || [])
        setTotalFiles(data.totalFiles || 0)
      } catch (err) {
        console.error('Scan failed:', err)
      } finally {
        setLoading(false)
      }
    }
    scan()
  }, [])

  async function handleMerge(cluster: string[], index: number) {
    setMerging(index)
    try {
      const res = await fetch('/api/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filenames: cluster })
      })
      const data = await res.json()
      if (data.success) {
        setMerged(prev => [...prev, index])
        alert(`✓ Created "${data.folderName}" with ${data.fileCount} versions in Google Drive`)
      } else {
        alert('Something went wrong — check the terminal for details')
      }
    } catch {
      alert('Network error — is the server running?')
    } finally {
      setMerging(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4">
        <span className="text-zinc-400 animate-pulse">⟳</span>
        <p className="text-sm text-zinc-500">Scanning your Google Drive for duplicate files...</p>
      </div>
    )
  }

  if (notAuthed) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4">
        <span className="text-amber-500 text-lg">⚠</span>
        <p className="text-sm text-amber-800 dark:text-amber-300">
          Connect your Google Drive to scan for duplicates.{' '}
          <a href="/api/auth/google" className="underline font-medium">Sign in with Google →</a>
        </p>
      </div>
    )
  }

  if (clusters.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/40 p-4">
        <span className="text-green-500 text-lg">✓</span>
        <p className="text-sm font-semibold text-green-800 dark:text-green-300">
          No duplicates found across {totalFiles} files in your Drive
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Scanned {totalFiles} files — found {clusters.length} duplicate group{clusters.length > 1 ? 's' : ''}
      </p>
      {clusters.map((cluster, i) => {
        const c = colorMap[cluster.color]
        const isMerging = merging === i
        const isMerged = merged.includes(i)

        return (
          <div
            key={i}
            className={`flex items-start gap-3 rounded-xl border ${c.border} ${c.bg} p-4 transition-opacity ${isMerged ? 'opacity-40' : 'opacity-100'}`}
          >
            <span className={`${c.icon} text-lg leading-none mt-0.5`}>⚠</span>
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <p className={`text-sm font-semibold ${c.title}`}>
                {isMerged ? '✓ Merged — ' : `${cluster.label} — `}
                {cluster.files.length} files appear to be the same document
              </p>
              <div className="flex flex-wrap gap-1.5">
                {cluster.files.map((f) => (
                  <span
                    key={f}
                    className={`rounded-md bg-white dark:bg-zinc-900 border ${c.tag} text-xs px-2 py-0.5 font-mono`}
                  >
                    {f}
                  </span>
                ))}
              </div>
              {!isMerged && (
                <p className={`text-xs ${c.sub}`}>
                  <button
                    onClick={() => handleMerge(cluster.files, i)}
                    disabled={isMerging}
                    className="underline font-medium transition-colors disabled:opacity-50"
                  >
                    {isMerging ? 'Merging...' : 'Merge into one version tree?'}
                  </button>
                  {' · '}
                  <button
                    onClick={() => setMerged(prev => [...prev, i])}
                    className="underline font-medium transition-colors"
                  >
                    Keep as separate files
                  </button>
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}