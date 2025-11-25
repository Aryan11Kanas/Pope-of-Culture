import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'

export async function POST(request: NextRequest) {
  try {
    const { title } = await request.json()
    
    if (!title) {
      return NextResponse.json(
        { error: 'Movie title is required' },
        { status: 400 }
      )
    }

    console.log(`🎬 Analyzing movie: ${title}`)

    const pythonProcess = spawn('python', ['-c', `
import sys
import json

# Redirect print statements to stderr
original_stdout = sys.stdout
class StderrWriter:
    def write(self, text):
        sys.stderr.write(text)
    def flush(self):
        sys.stderr.flush()

try:
    sys.stdout = StderrWriter()
    
    from movie.gemini_analyzer import MovieAnalyzer
    import pandas as pd
    
    df = pd.read_csv('tmdb_movies_since_1971.csv')
    title = "${title.replace(/"/g, '\\"')}"
    movie_row = df[df['title'].str.lower() == title.lower()]
    
    if movie_row.empty:
        movie = {
            "title": title,
            "overview": "",
            "genres": "Unknown",
            "vote_average": 0,
            "release_date": "",
            "id": None,
            "imdb_id": None
        }
    else:
        movie = movie_row.iloc[0].to_dict()
        import numpy as np
        for key, value in movie.items():
            if hasattr(value, 'item'):
                movie[key] = value.item()
            elif pd.isna(value):
                movie[key] = None
    
    analyzer = MovieAnalyzer()
    analysis = analyzer.analyze_movie_intensity(movie)
    
    sys.stdout = original_stdout
    
    result = {
        "success": True,
        "movie": movie,
        "intensity": {
            "success": True,
            "movie_title": analysis.get("movie_title", title),
            "intensity_ratings": analysis.get("intensity_ratings", {}),
            "overall_arc": analysis.get("overall_arc", ""),
            "peak_moments": analysis.get("peak_moments", ""),
            "pacing_assessment": analysis.get("pacing_assessment", ""),
            "plot_path": analysis.get("plot_path", ""),
            "cached": analysis.get("cached", False)
        }
    }
    
    print(json.dumps(result, ensure_ascii=False, default=str))
    
except Exception as e:
    import traceback
    sys.stdout = original_stdout
    error_result = {
        "success": False,
        "error": str(e),
        "traceback": traceback.format_exc()
    }
    print(json.dumps(error_result))
`])

    let output = ''
    let errorOutput = ''

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString()
    })

    pythonProcess.stderr.on('data', (data) => {
      const message = data.toString()
      errorOutput += message
      process.stderr.write(message)
    })

    return new Promise((resolve) => {
      pythonProcess.on('close', (code) => {
        if (code === 0 && output.trim()) {
          try {
            const result = JSON.parse(output.trim())
            
            if (result.success) {
              console.log(`✅ Analysis complete for ${title}`)
              resolve(NextResponse.json(result))
            } else {
              console.error(`Analysis failed: ${result.error}`)
              resolve(NextResponse.json(result, { status: 400 }))
            }
          } catch (parseError) {
            console.error('Failed to parse analysis output:', output)
            resolve(NextResponse.json({ 
              success: false, 
              error: 'Failed to parse analysis results'
            }, { status: 500 }))
          }
        } else {
          console.error(`Analysis failed with code ${code}`)
          resolve(NextResponse.json({ 
            success: false, 
            error: errorOutput || 'Analysis failed'
          }, { status: 500 }))
        }
      })

      setTimeout(() => {
        pythonProcess.kill()
        resolve(NextResponse.json({ 
          success: false, 
          error: 'Analysis timeout'
        }, { status: 500 }))
      }, 120000)
    })
    
  } catch (error) {
    console.error('Analysis API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
