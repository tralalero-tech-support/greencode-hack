import { clusterFiles, chaosScore } from '../lib/clusterFiles'

// This is where your real files will come from eventually (Google Drive)
// For now we use test files to prove the logic works end-to-end
const testFiles = [
  'final.pdf', 'final2.pdf', 'final_REAL.pdf', 'final_updated_NEW.pdf',
  'resume_v1.docx', 'resume_FINAL.docx',
  'budget_2024.xlsx', 'budget_FINAL_v3.xlsx',
  'logo.png'
]

const clusters = clusterFiles(testFiles)
const chaoticClusters = clusters.filter(c => c.length > 1)

const colorMap = {
  red:   { border: 'border-red-200 dark:border-red-800',   bg: 'bg-red-50 dark:bg-red-950/40',     icon: 'text-red-500',   title: 'text-red-800 dark:text-red-300',   sub: 'text-red-600 dark:text-red-400',   tag: 'border-red-200 dark:border-red-700 text-red-700 dark:text-red-400'   },
  amber: { border: 'border-amber-200 dark:border-amber-800', bg: 'bg-amber-50 dark:bg-amber-950/40', icon: 'text-amber-500', title: 'text-amber-800 dark:text-amber-300', sub: 'text-amber-600 dark:text-amber-400', tag: 'border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400' },
  green: { border: 'border-blue-200 dark:border-blue-800', bg: 'bg-blue-50 dark:bg-blue-950/40', icon: 'text-blue-500', title: 'text-blue-800 dark:text-blue-300', sub: 'text-blue-600 dark:text-blue-400', tag: 'border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-400' },
}

export default function DuplicateAlert() {
  if (chaoticClusters.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 p-4">
        <span className="text-blue-500 text-lg">✓</span>
        <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
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

        return (
          <div
            key={i}
            className={`flex items-start gap-3 rounded-xl border ${c.border} ${c.bg} p-4`}
          >
            <span className={`${c.icon} text-lg leading-none mt-0.5`}>⚠</span>
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <p className={`text-sm font-semibold ${c.title}`}>
                {label} — {cluster.length} files appear to be the same document
              </p>
              <div className="flex flex-wrap gap-1.5">
                {cluster.map((f) => (
                  <span
                    key={f}
                    className={`rounded-md bg-white dark:bg-slate-900 border ${c.tag} text-xs px-2 py-0.5 font-mono`}
                  >
                    {f}
                  </span>
                ))}
              </div>
              <p className={`text-xs ${c.sub}`}>
                <button className="underline font-medium transition-colors">
                  Merge into one version tree?
                </button>
                {' · '}
                <button className="underline font-medium transition-colors">
                  Keep as separate files
                </button>
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
