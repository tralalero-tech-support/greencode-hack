'use client'

import { useState } from 'react'
import { clusterFiles, chaosScore } from '../lib/clusterFiles'

const testFiles = [
  'final.pdf', 'final2.pdf', 'final_REAL.pdf', 'final_updated_NEW.pdf',
  'resume_v1.docx', 'resume_FINAL.docx',
  'budget_2024.xlsx', 'budget_FINAL_v3.xlsx',
  'logo.png'
]

const clusters = clusterFiles(testFiles)
const chaoticClusters = clusters.filter(c => c.length > 1)

const colorMap = {
  red:   { border: 'border-red-200 dark:border-red-800',     bg: 'bg-red-50 dark:bg-red-950/40',     icon: 'text-red-500',   title: 'text-red-800 dark:text-red-300',   sub: 'text-red-600 dark:text-red-400',   tag: 'border-red-200 dark:border-red-700 text-red-700 dark:text-red-400'   },
  amber: { border: 'border-amber-200 dark:border-amber-800', bg: 'bg-amber-50 dark:bg-amber-950/40', icon: 'text-amber-500', title: 'text-amber-800 dark:text-amber-300', sub: 'text-amber-600 dark:text-amber-400', tag: 'border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400' },
  green: { border: 'border-green-200 dark:border-green-800', bg: 'bg-green-50 dark:bg-green-950/40', icon: 'text-green-500', title: 'text-green-800 dark:text-green-300', sub: 'text-green-600 dark:text-green-400', tag: 'border-green-200 dark:border-green-700 text-green-700 dark:text-green-400' },
}

export default function DuplicateAlert() {
  const [merging, setMerging] = useState<number | null>(null)
  const [merged, setMerged] = useState<number[]>([])

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
    } catch (err) {
      alert('Network error — is the server running?')
    } finally {
      setMerging(null)
    }
  }

  if (chaoticClusters.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/40 p-4">
        <span className="text-green-500 text-lg">✓</span>
        <p className="text-sm font-semibold text-green-800 dark:text-green-300">
          No duplicates detected
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {chaoticClusters.map((cluster, i) => {
        const { label, color } = chaosScore(cluster)
        const c = colorMap[color as keyof typeof colorMap]
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
                {isMerged ? '✓ Merged — ' : `${label} — `}
                {cluster.length} files appear to be the same document
              </p>
              <div className="flex flex-wrap gap-1.5">
                {cluster.map((f) => (
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
                    onClick={() => handleMerge(cluster, i)}
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