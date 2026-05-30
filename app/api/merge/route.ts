import { mergeClusterIntoVersionTree } from '../../../lib/driveApi'
export async function POST(request: Request) {
  try {
    const { filenames } = await request.json()
    const result = await mergeClusterIntoVersionTree(filenames)
    return Response.json({ success: true, ...result })
  } catch (error) {
    console.error('Merge error:', error)
    return Response.json({ success: false, error: 'Merge failed' }, { status: 500 })
  }
}