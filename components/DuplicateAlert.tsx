'use client'

import { useState, useEffect } from 'react'
import { chaosScore } from '../lib/clusterFiles'

const colorMap = {
  red:   { 
    gradient: 'from-red-500/10 to-orange-500/10', 
    border: 'border-red-500/20', 
    glow: 'shadow-red-500/10',
    icon: 'text-red-500', 
    title: 'text-red-700 dark:text-red-300', 
    sub: 'text-red-600 dark:text-red-400', 
    tag: 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400',
    btn: 'bg-red-500 hover:bg-red-600 text-white'
  },
  amber: { 
    gradient: 'from-amber-500/10 to-yellow-500/10', 
    border: 'border-amber-500/20', 
    glow: 'shadow-amber-500/10',
    icon: 'text-amber-500', 
    title: 'text-amber-700 dark:text-amber-300', 
    sub: 'text-amber-600 dark:text-amber-400', 
    tag: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400',
    btn: 'bg-amber-500 hover:bg-amber-600 text-white'
  },
  green: { 
    gradient: 'from-green-500/10 to-emerald-500/10', 
    border: 'border-green-500/20', 
    glow: 'shadow-green-500/10',
    icon: 'text-green-500', 
    title: 'text-green-700 dark:text-green-300', 
    sub: 'text-green-600 dark:text-green-400', 
    tag: 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400',
    btn: 'bg-green-500 hover:bg-green-600 text-white'
  },
}

type Cluster = {
  files: string[]
  label: string
  color: 'red' | 'amber' | 'green'
  score: number
  explanation?: string
  contentAnalysis?: {
    dominantType: string
    isMixed: boolean
    typeCounts: Record<string, number>
    categories: Array<{ type: string; icon: string; color: string }>
  }
  differences?: Array<{
    type: string
    description: string
    details: Array<{ name: string; size?: string; date?: string; version?: string }>
  }>
}

export default function DuplicateAlert() {
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [totalFiles, setTotalFiles] = useState(0)
  const [loading, setLoading] = useState(true)
  const [notAuthed, setNotAuthed] = useState(false)
  const [merging, setMerging] = useState<number | null>(null)
  const [merged, setMerged] = useState<number[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    console.log("DuplicateAlert mounted")

    async function scan() {
      console.log('Starting Drive scan for duplicates...');
      try {
        const res = await fetch('/api/auth/drive/scan')
        const data = await res.json();
        console.log('Scan result:', data)

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
    scan();
  }, [])

  async function handleMerge(cluster: string[], index: number) {
    setMerging(index)
    try {
      const res = await fetch('/api/auth/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filenames: cluster })
      })
      const data = await res.json()
      if (data.success) {
        setMerged(prev => [...prev, index])
        alert(`✓ Created "${data.folderName}" with ${data.fileCount} versions in Google Drive`)
        nextCluster()
      } else {
        alert('Something went wrong — check the terminal for details')
      }
    } catch {
      alert('Network error — is the server running?')
    } finally {
      setMerging(null)
    }
  }

  const nextCluster = () => {
    setCurrentIndex((prev) => (prev + 1) % clusters.length)
  }

  const prevCluster = () => {
    setCurrentIndex((prev) => (prev - 1 + clusters.length) % clusters.length)
  }

  if (loading) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-zinc-200/50 dark:border-zinc-800/50 bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900/50 dark:to-zinc-950/50 p-8">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-200/50 dark:via-zinc-800/50 to-transparent animate-shimmer" />
        <div className="relative flex items-center justify-center gap-4">
          <div className="w-12 h-12 border-3 border-zinc-300 dark:border-zinc-700 border-t-zinc-500 rounded-full animate-spin" />
          <p className="text-lg text-zinc-600 dark:text-zinc-400 font-medium">Scanning your Google Drive...</p>
        </div>
      </div>
    )
  }

  if (notAuthed) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 p-8">
        <div className="relative flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-xl shadow-amber-500/20">
            <span className="text-white text-3xl">⚠</span>
          </div>
          <div className="flex-1">
            <p className="text-xl font-semibold text-amber-800 dark:text-amber-200">
              Connect your Google Drive
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
              Sign in to scan for duplicate files
            </p>
          </div>
          <a 
            href="/api/auth/google" 
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-base font-medium hover:from-amber-600 hover:to-orange-600 transition-all shadow-xl shadow-amber-500/20"
          >
            Connect →
          </a>
        </div>
      </div>
    )
  }

  if (clusters.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-green-500/20 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 p-8">
        <div className="relative flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-xl shadow-green-500/20">
            <span className="text-white text-3xl">✓</span>
          </div>
          <div>
            <p className="text-xl font-semibold text-green-800 dark:text-green-200">
              All clean!
            </p>
            <p className="text-sm text-green-600 dark:text-green-400 mt-2">
              No duplicates found across {totalFiles} files
            </p>
          </div>
        </div>
      </div>
    )
  }

  const visibleClusters = merged.includes(currentIndex) ? [] : [clusters[currentIndex]]
  const currentCluster = clusters[currentIndex]
  const c = colorMap[currentCluster.color]
  const isMerging = merging === currentIndex
  const isMerged = merged.includes(currentIndex)

  return (
    <div className="flex flex-col gap-6">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
          {totalFiles} files scanned · {clusters.length} duplicate group{clusters.length > 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-2">
          {clusters.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`h-2 rounded-full transition-all ${
                i === currentIndex 
                  ? 'w-8 bg-zinc-800 dark:bg-zinc-200' 
                  : 'w-2 bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400 dark:hover:bg-zinc-600'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Active cluster card */}
      <div className="relative">
        {clusters.map((cluster, i) => {
          const clusterColor = colorMap[cluster.color]
          const isActive = i === currentIndex
          const isClusterMerged = merged.includes(i)

          if (!isActive) return null

          return (
            <div
              key={i}
              className={`
                w-full max-w-3xl mx-auto h-80 rounded-3xl border p-8 transition-all duration-300 flex flex-col
                ${clusterColor.gradient} ${clusterColor.border} shadow-2xl ${clusterColor.glow}
                ${isClusterMerged ? 'opacity-40' : ''}
              `}
            >
              <div className="flex items-start gap-4">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${cluster.color === 'red' ? 'from-red-400 to-orange-500' : cluster.color === 'amber' ? 'from-amber-400 to-yellow-500' : 'from-green-400 to-emerald-500'} flex items-center justify-center shadow-xl ${cluster.color === 'red' ? 'shadow-red-500/20' : cluster.color === 'amber' ? 'shadow-amber-500/20' : 'shadow-green-500/20'}`}>
                  <span className="text-white text-3xl">
                    {isClusterMerged ? '✓' : '⚠'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xl font-semibold ${clusterColor.title} truncate`}>
                    {isClusterMerged ? 'Merged' : cluster.label}
                  </p>
                  <p className={`text-base ${clusterColor.sub} mt-1`}>
                    {cluster.files.length} file{cluster.files.length > 1 ? 's' : ''}
                  </p>
                  {cluster.contentAnalysis && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-2xl">
                        {cluster.contentAnalysis.categories[0]?.icon || '📁'}
                      </span>
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        {cluster.contentAnalysis.dominantType}
                        {cluster.contentAnalysis.isMixed && ' (mixed types)'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {!isClusterMerged && (
                <div className="mt-auto space-y-4">
                  {cluster.explanation && (
                    <div className="bg-white/50 dark:bg-zinc-800/50 rounded-xl p-4">
                      <p className="text-sm text-zinc-700 dark:text-zinc-300">
                        {cluster.explanation}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {cluster.files.slice(0, 5).map((f, idx) => (
                      <span
                        key={`${f}-${idx}`}
                        className={`rounded-md ${clusterColor.tag} text-xs px-2 py-1 font-mono truncate max-w-[120px]`}
                      >
                        {f}
                      </span>
                    ))}
                    {cluster.files.length > 5 && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 px-2 py-1">
                        +{cluster.files.length - 5} more
                      </span>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleMerge(cluster.files, i)}
                      disabled={isMerging}
                      className={`flex-1 px-5 py-3 rounded-2xl text-sm font-medium transition-all ${
                        isMerging 
                          ? 'opacity-50 cursor-not-allowed' 
                          : clusterColor.btn + ' hover:scale-105 active:scale-95 shadow-lg'
                      }`}
                    >
                      {isMerging ? 'Merging...' : 'Merge files'}
                    </button>
                    <button
                      onClick={() => {
                        setMerged(prev => [...prev, i])
                        nextCluster()
                      }}
                      className="px-5 py-3 rounded-2xl text-sm font-medium border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Navigation arrows */}
        <button
          onClick={prevCluster}
          className="absolute left-0 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shadow-xl hover:scale-110 transition-all z-20 text-lg"
        >
          ←
        </button>
        <button
          onClick={nextCluster}
          className="absolute right-0 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shadow-xl hover:scale-110 transition-all z-20 text-lg"
        >
          →
        </button>
      </div>

      {/* Differences section */}
      {clusters[currentIndex] && clusters[currentIndex].differences && clusters[currentIndex].differences.length > 0 && (
        <div className="max-w-3xl mx-auto mt-6">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
            File Differences
          </h3>
          <div className="space-y-2">
            {clusters[currentIndex].differences?.map((diff, diffIndex) => (
              <div
                key={diffIndex}
                className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">
                    {diff.type === 'size' ? '📏' : diff.type === 'date' ? '📅' : '🔖'}
                  </span>
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {diff.description}
                  </p>
                </div>
                <div className="space-y-1">
                  {diff.details.map((detail, detailIndex) => (
                    <div
                      key={detailIndex}
                      className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400 py-1 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                    >
                      <span className="font-mono truncate max-w-[200px]">{detail.name}</span>
                      <span className="font-medium">
                        {detail.size || detail.date || detail.version}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}