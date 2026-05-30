const SCOPES = 'https://www.googleapis.com/auth/drive'

// Gets an access token from your service account credentials
async function getAccessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')

  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: email,
    scope: SCOPES,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  // Encode JWT header and payload
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  const unsigned = `${header}.${body}`

  // Sign with private key
  const keyData = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyData, new TextEncoder().encode(unsigned))
  const jwt = `${unsigned}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`

  // Exchange JWT for access token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  })
  const data = await res.json()
  return data.access_token
}

function pemToArrayBuffer(pem) {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '')
  const binary = atob(base64)
  const buffer = new ArrayBuffer(binary.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i)
  return buffer
}

// Creates a new folder in Google Drive
async function createFolder(token, folderName, parentFolderId) {
  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentFolderId ? [parentFolderId] : [],
    }),
  })
  const data = await res.json()
  return data.id
}

// Gets file metadata (id, name, modifiedTime) for a list of filenames
async function getFileMetadata(token, filenames) {
  const query = filenames
    .map(name => `name = '${name}'`)
    .join(' or ')

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json()
  return data.files || []
}

// Renames a file
async function renameFile(token, fileId, newName) {
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: newName }),
  })
}

// Moves a file into a folder
async function moveFile(token, fileId, newFolderId) {
  // First get current parents
  const meta = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const { parents } = await meta.json()

  await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${newFolderId}&removeParents=${parents.join(',')}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    }
  )
}

// Main function — call this when user clicks "Merge into one version tree"
export async function mergeClusterIntoVersionTree(filenames) {
  const token = await getAccessToken()

  // 1. Get real file metadata from Drive, sorted oldest to newest
  const files = await getFileMetadata(token, filenames)
  files.sort((a, b) => new Date(a.modifiedTime) - new Date(b.modifiedTime))

  // 2. Pick a clean folder name from the first filename
  const baseName = filenames[0].replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ').trim()
  const folderName = `${baseName} - Version Tree`

  // 3. Create the folder in Drive
  const folderId = await createFolder(token, folderName)

  // 4. Rename and move each file into the folder
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const ext = file.name.match(/\.[^.]+$/) ? file.name.match(/\.[^.]+$/)[0] : ''
    const newName = `v${i + 1} - ${baseName}${ext}`
    await renameFile(token, file.id, newName)
    await moveFile(token, file.id, folderId)
  }

  return { folderName, fileCount: files.length }
}