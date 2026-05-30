export function getFileCategory(filename) {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  
  const categories = {
    // Documents
    'pdf': { type: 'Document', icon: '📄', color: 'blue' },
    'doc': { type: 'Document', icon: '📄', color: 'blue' },
    'docx': { type: 'Document', icon: '📄', color: 'blue' },
    'txt': { type: 'Document', icon: '📄', color: 'blue' },
    'rtf': { type: 'Document', icon: '📄', color: 'blue' },
    'odt': { type: 'Document', icon: '📄', color: 'blue' },
    
    // Spreadsheets
    'xls': { type: 'Spreadsheet', icon: '📊', color: 'green' },
    'xlsx': { type: 'Spreadsheet', icon: '📊', color: 'green' },
    'csv': { type: 'Spreadsheet', icon: '📊', color: 'green' },
    'ods': { type: 'Spreadsheet', icon: '📊', color: 'green' },
    
    // Presentations
    'ppt': { type: 'Presentation', icon: '📽️', color: 'orange' },
    'pptx': { type: 'Presentation', icon: '📽️', color: 'orange' },
    'key': { type: 'Presentation', icon: '📽️', color: 'orange' },
    
    // Images
    'jpg': { type: 'Image', icon: '🖼️', color: 'purple' },
    'jpeg': { type: 'Image', icon: '🖼️', color: 'purple' },
    'png': { type: 'Image', icon: '🖼️', color: 'purple' },
    'gif': { type: 'Image', icon: '🖼️', color: 'purple' },
    'svg': { type: 'Image', icon: '🖼️', color: 'purple' },
    'webp': { type: 'Image', icon: '🖼️', color: 'purple' },
    'bmp': { type: 'Image', icon: '🖼️', color: 'purple' },
    
    // Code
    'js': { type: 'Code', icon: '💻', color: 'yellow' },
    'ts': { type: 'Code', icon: '💻', color: 'yellow' },
    'py': { type: 'Code', icon: '💻', color: 'yellow' },
    'java': { type: 'Code', icon: '💻', color: 'yellow' },
    'cpp': { type: 'Code', icon: '💻', color: 'yellow' },
    'c': { type: 'Code', icon: '💻', color: 'yellow' },
    'html': { type: 'Code', icon: '💻', color: 'yellow' },
    'css': { type: 'Code', icon: '💻', color: 'yellow' },
    'json': { type: 'Code', icon: '💻', color: 'yellow' },
    'xml': { type: 'Code', icon: '💻', color: 'yellow' },
    
    // Archives
    'zip': { type: 'Archive', icon: '📦', color: 'gray' },
    'rar': { type: 'Archive', icon: '📦', color: 'gray' },
    '7z': { type: 'Archive', icon: '📦', color: 'gray' },
    'tar': { type: 'Archive', icon: '📦', color: 'gray' },
    'gz': { type: 'Archive', icon: '📦', color: 'gray' },
    
    // Audio
    'mp3': { type: 'Audio', icon: '🎵', color: 'pink' },
    'wav': { type: 'Audio', icon: '🎵', color: 'pink' },
    'flac': { type: 'Audio', icon: '🎵', color: 'pink' },
    'aac': { type: 'Audio', icon: '🎵', color: 'pink' },
    
    // Video
    'mp4': { type: 'Video', icon: '🎬', color: 'red' },
    'mov': { type: 'Video', icon: '🎬', color: 'red' },
    'avi': { type: 'Video', icon: '🎬', color: 'red' },
    'mkv': { type: 'Video', icon: '🎬', color: 'red' },
  }
  
  return categories[ext] || { type: 'File', icon: '📁', color: 'gray' }
}

export function analyzeContentPattern(filenames) {
  const categories = filenames.map(f => getFileCategory(f))
  const typeCounts = {}
  
  categories.forEach(cat => {
    typeCounts[cat.type] = (typeCounts[cat.type] || 0) + 1
  })
  
  const dominantType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]
  const isMixed = Object.keys(typeCounts).length > 1
  
  return {
    dominantType: dominantType ? dominantType[0] : 'Unknown',
    isMixed,
    typeCounts,
    categories
  }
}

export function generateExplanation(cluster, contentAnalysis) {
  const { dominantType, isMixed, typeCounts } = contentAnalysis
  const fileCount = cluster.length
  
  let explanation = `${fileCount} ${fileCount === 1 ? 'file' : 'files'} `
  
  if (isMixed) {
    explanation += `of mixed types (${Object.keys(typeCounts).join(', ')}) `
  } else {
    explanation += `of type "${dominantType}" `
  }
  
  // Check for version patterns
  const hasVersions = cluster.some(f => /\b(v\d+|final|draft|copy|revised|updated)\b/i.test(f))
  if (hasVersions) {
    explanation += `with version indicators `
  }
  
  // Check for similar naming patterns
  const normalizedNames = cluster.map(normalizeName)
  const uniqueNames = new Set(normalizedNames).size
  if (uniqueNames === 1) {
    explanation += `appear to be different versions of the same document`
  } else if (uniqueNames < cluster.length) {
    explanation += `share similar naming patterns`
  } else {
    explanation += `may be related by content or context`
  }
  
  return explanation
}

export function generateDifferences(cluster, metadata) {
  const differences = []
  
  if (!metadata || metadata.length === 0) {
    return differences
  }
  
  // Compare file sizes
  const sizes = metadata.map(m => m.size ? parseInt(m.size) : 0).filter(s => s > 0)
  if (sizes.length > 1) {
    const maxSize = Math.max(...sizes)
    const minSize = Math.min(...sizes)
    const sizeDiff = maxSize - minSize
    const sizeDiffPercent = minSize > 0 ? Math.round((sizeDiff / minSize) * 100) : 0
    
    if (sizeDiff > 0) {
      differences.push({
        type: 'size',
        description: `File sizes vary by ${formatBytes(sizeDiff)} (${sizeDiffPercent}% difference)`,
        details: metadata.map(m => ({
          name: m.name,
          size: m.size ? formatBytes(parseInt(m.size)) : 'Unknown'
        }))
      })
    }
  }
  
  // Compare modification times
  const dates = metadata.map(m => m.modifiedTime).filter(d => d)
  if (dates.length > 1) {
    const parsedDates = dates.map(d => new Date(d))
    const maxDate = new Date(Math.max(...parsedDates))
    const minDate = new Date(Math.min(...parsedDates))
    const daysDiff = Math.round((maxDate - minDate) / (1000 * 60 * 60 * 24))
    
    if (daysDiff > 0) {
      differences.push({
        type: 'date',
        description: `Modified over a span of ${daysDiff} day${daysDiff > 1 ? 's' : ''}`,
        details: metadata.map(m => ({
          name: m.name,
          date: m.modifiedTime ? formatDate(m.modifiedTime) : 'Unknown'
        }))
      })
    }
  }
  
  // Compare version indicators in names
  const versionPatterns = cluster.map(f => {
    const match = f.match(/\b(v\d+|final|draft|copy|revised|updated)\b/i)
    return match ? match[1].toLowerCase() : null
  }).filter(v => v)
  
  if (versionPatterns.length > 1) {
    const uniqueVersions = [...new Set(versionPatterns)]
    if (uniqueVersions.length > 1) {
      differences.push({
        type: 'version',
        description: `Different version indicators detected: ${uniqueVersions.join(', ')}`,
        details: cluster.map(f => ({
          name: f,
          version: f.match(/\b(v\d+|final|draft|copy|revised|updated)\b/i)?.[0] || 'None'
        }))
      })
    }
  }
  
  return differences
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

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
  const messyRatio = messyCount / cluster.length

  // Three factors: how many files, how messy the names are, and the ratio of messy ones
  const sizePenalty = cluster.length >= 4 ? 50 : cluster.length === 3 ? 35 : cluster.length === 2 ? 20 : 0
  const messyPenalty = Math.round(messyRatio * 50)
  const score = Math.min(100, sizePenalty + messyPenalty)

  let label, color
  if (score >= 65) {
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
