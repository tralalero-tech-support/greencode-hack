export function normalizeName(filename) {
  return filename
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[_\-]+/g, ' ')
    .replace(/v\d+/g, '')
    .replace(/\d+/g, '')
    .replace(/\b(final|new|real|updated|copy|revised|draft|edit|last)\b/g, '')
    .replace(/\b\w{1,2}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function similarity(nameA, nameB) {
  const setA = new Set(nameA.split(' ').filter(Boolean))
  const setB = new Set(nameB.split(' ').filter(Boolean))

  if (setA.size === 0 && setB.size === 0) return 1
  if (setA.size === 0 || setB.size === 0) return 0

  const intersection = [...setA].filter(word => setB.has(word)).length
  const union = new Set([...setA, ...setB]).size

  return intersection / union
}

export function clusterFiles(fileList, threshold = 0.45) {
  const visited = new Array(fileList.length).fill(false)
  const clusters = []
  const normalized = fileList.map(normalizeName)

  for (let i = 0; i < fileList.length; i++) {
    if (visited[i]) continue

    const cluster = [fileList[i]]
    visited[i] = true

    for (let j = i + 1; j < fileList.length; j++) {
      if (visited[j]) continue

      const normI = normalized[i]
      const normJ = normalized[j]

      const bothEmpty = normI === '' && normJ === ''
      const similar = similarity(normI, normJ) >= threshold

      if (bothEmpty || similar) {
        cluster.push(fileList[j])
        visited[j] = true
      }
    }

    clusters.push(cluster)
  }

  return clusters
}

export function chaosScore(cluster) {
  const messySuffixes = /\b(final|new|real|updated|v\d+|copy|revised|draft)\b/i
  const messyCount = cluster.filter(f => messySuffixes.test(f)).length

  const sizePenalty = cluster.length >= 2 ? 40 : 0
  const messyPenalty = Math.round((messyCount / cluster.length) * 60)
  const score = Math.min(100, sizePenalty + messyPenalty)

  let label, color
  if (score >= 60) {
    label = 'High chaos'
    color = 'red'
  } else if (score >= 30) {
    label = 'Moderate'
    color = 'amber'
  } else {
    label = 'Clean'
    color = 'green'
  }

  return { score, label, color }
}