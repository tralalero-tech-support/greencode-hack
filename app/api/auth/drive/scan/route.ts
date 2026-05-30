import { cookies } from 'next/headers'
import { google } from 'googleapis'
import { getAuthenticatedClient } from '@/lib/google/auth'
import { clusterFiles, chaosScore } from '@/lib/clusterFiles'

export async function GET() {
  try {
    // 1. Get the access token from the cookie set during OAuth
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('google_access_token')?.value
    const refreshToken = cookieStore.get('google_refresh_token')?.value

    if (!accessToken) {
      return Response.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    // 2. Build an authenticated Drive client
    const auth = getAuthenticatedClient(accessToken, refreshToken)
    const drive = google.drive({ version: 'v3', auth })

    // 3. Fetch the 100 most recently modified files from Drive
    const res = await drive.files.list({
      pageSize: 100,
      orderBy: 'modifiedTime desc',
      fields: 'files(id, name, mimeType, modifiedTime, size, owners, parents)',
      q: "trashed = false"
    })

    const files = res.data.files || []
    console.log('Drive files found:', files.length, files.map((f: any) => f.name))
    const filenames = files.map((f: any) => f.name || '')
    // 4. Run our clustering logic on the real filenames
    const clusters = clusterFiles(filenames)
    const chaoticClusters = clusters
      .filter(c => c.length > 1)
      .map(cluster => ({
        files: cluster,
        ...chaosScore(cluster),
        // Attach the full Drive metadata for each file in the cluster
        metadata: cluster.map((name: string) =>
            files.find((f: any) => f.name === name) || { name }
        )
      }))

    return Response.json({
      success: true,
      totalFiles: files.length,
      chaoticClusters,
      allFiles: files
    })

  } catch (error) {
    console.error('Drive scan error:', error)
    return Response.json({ success: false, error: 'Scan failed' }, { status: 500 })
  }
}