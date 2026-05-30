import { cookies } from 'next/headers'
import { google } from 'googleapis'
import { getAuthenticatedClient } from '@/lib/google/auth'
import { normalizeName } from '@/lib/clusterFiles'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { filenames } = body

    if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
      return Response.json({ success: false, error: 'No filenames provided' }, { status: 400 })
    }

    // 1. Get the access token from the cookie
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('google_access_token')?.value
    const refreshToken = cookieStore.get('google_refresh_token')?.value

    if (!accessToken) {
      return Response.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    // 2. Build an authenticated Drive client
    const auth = getAuthenticatedClient(accessToken, refreshToken)
    const drive = google.drive({ version: 'v3', auth })

    // 3. Get the file IDs for the provided filenames
    const filesRes = await drive.files.list({
      q: filenames.map(f => `name = '${f}'`).join(' or '),
      fields: 'files(id, name, parents)'
    })

    const files = filesRes.data.files || []
    if (files.length === 0) {
      return Response.json({ success: false, error: 'No files found with provided names' }, { status: 404 })
    }

    // 4. Generate a folder name based on the normalized filename
    const baseName = normalizeName(filenames[0])
    const folderName = baseName || 'Merged Files'
    const timestamp = new Date().toISOString().split('T')[0]
    const finalFolderName = `${folderName} - ${timestamp}`

    // 5. Create a new folder
    const folderRes = await drive.files.create({
      requestBody: {
        name: finalFolderName,
        mimeType: 'application/vnd.google-apps.folder'
      },
      fields: 'id'
    })

    const folderId = folderRes.data.id
    if (!folderId) {
      return Response.json({ success: false, error: 'Failed to create folder' }, { status: 500 })
    }

    // 6. Move all files to the new folder
    const movePromises = files.map(async (file) => {
      if (!file.id) return
      
      // Get current parents
      const fileRes = await drive.files.get({
        fileId: file.id,
        fields: 'parents'
      })
      
      const currentParents = fileRes.data.parents || []
      
      // Move file to new folder (remove from old parents, add to new folder)
      await drive.files.update({
        fileId: file.id,
        addParents: folderId,
        removeParents: currentParents.join(',')
      })
    })

    await Promise.all(movePromises)

    return Response.json({
      success: true,
      folderName: finalFolderName,
      folderId,
      fileCount: files.length
    })

  } catch (error) {
    console.error('Merge error:', error)
    return Response.json({ success: false, error: 'Merge failed' }, { status: 500 })
  }
}
