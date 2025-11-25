import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import * as path from 'path'

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()
    
    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      )
    }

    console.log(`🔍 Searching for scrapable movies: ${query}`)

    const pythonProcess = spawn('python', ['-c', `
import sys
import json
import pandas as pd

try:
    # Load dataset
    df = pd.read_csv('data/archive/TMDB_movie_dataset_v11.csv')
    
    # Filter movies with IMDb IDs
    df = df[df['imdb_id'].notna() & (df['imdb_id'] != '')]
    
    # Search by title (case-insensitive)
    query = "${query.replace(/"/g, '\\"')}".lower()
    matches = df[df['title'].str.lower().str.contains(query, na=False, regex=False)]
    
    # Limit to top 20 results
    matches = matches.head(20)
    
    # Prepare results
    movies = []
    for _, row in matches.iterrows():
        movies.append({
            "id": int(row['id']) if pd.notna(row['id']) else 0,
            "title": str(row['title']),
            "imdb_id": str(row['imdb_id']),
            "release_date": str(row['release_date']) if pd.notna(row['release_date']) else ''
        })
    
    result = {
        "success": True,
        "movies": movies,
        "total": len(movies)
    }
    
    print(json.dumps(result))
    
except Exception as e:
    error_result = {
        "success": False,
        "error": str(e),
        "movies": []
    }
    print(json.dumps(error_result))
`])

    let output = ''
    let errorOutput = ''

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString()
    })

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })

    return new Promise((resolve) => {
      pythonProcess.on('close', (code) => {
        if (code === 0 && output.trim()) {
          try {
            const result = JSON.parse(output.trim())
            resolve(NextResponse.json(result))
          } catch (parseError) {
            console.error('Failed to parse search output')
            resolve(NextResponse.json({ 
              success: false, 
              error: 'Failed to parse search results',
              movies: []
            }))
          }
        } else {
          console.error(`Search failed with code ${code}`)
          resolve(NextResponse.json({ 
            success: false, 
            error: errorOutput || 'Search failed',
            movies: []
          }))
        }
      })

      setTimeout(() => {
        pythonProcess.kill()
        resolve(NextResponse.json({ 
          success: false, 
          error: 'Search timeout',
          movies: []
        }))
      }, 30000)
    })
    
  } catch (error) {
    console.error('Search API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', movies: [] },
      { status: 500 }
    )
  }
}
