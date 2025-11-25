import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const graphPath = searchParams.get('path')
    
    if (!graphPath) {
      return NextResponse.json(
        { error: 'Graph path is required' },
        { status: 400 }
      )
    }

    // Security: Ensure the path is within the project directory
    const projectRoot = process.cwd()
    const absolutePath = path.isAbsolute(graphPath) 
      ? graphPath 
      : path.join(projectRoot, graphPath)
    
    // Check if file exists
    if (!existsSync(absolutePath)) {
      return NextResponse.json(
        { error: 'Graph file not found' },
        { status: 404 }
      )
    }

    // Read the image file
    const imageBuffer = await readFile(absolutePath)
    
    // Return the image with appropriate headers
    return new NextResponse(imageBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
    
  } catch (error) {
    console.error('Error serving graph:', error)
    return NextResponse.json(
      { error: 'Failed to load graph' },
      { status: 500 }
    )
  }
}
