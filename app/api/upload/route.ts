import { put } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const title = formData.get('title') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Upload to Vercel Blob with private access
    const blob = await put(`audio/${Date.now()}-${file.name}`, file, {
      access: 'private',
    })

    // Return the pathname for use with the transcription endpoint
    return NextResponse.json({ 
      pathname: blob.pathname,
      fileName: file.name,
      title: title || 'Untitled'
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
