import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import * as path from 'path'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'

interface Movie {
  id: number;
  title: string;
  vote_average: number;
  vote_count: number;
  release_date: string;
  overview: string;
  genres: string;
  original_language: string;
  poster_path?: string;
  popularity: number;
  runtime?: number;
  imdb_id?: string;
}

// Function to check cache for existing analysis
async function checkIntensityCache(movieTitle: string, movieId?: number): Promise<any> {
  try {
    const cachePath = path.join(process.cwd(), 'movie', 'intensity_cache.json')
    
    if (!existsSync(cachePath)) {
      return null
    }

    const cacheContent = await readFile(cachePath, 'utf-8')
    const cache = JSON.parse(cacheContent)

    // Try to find by movie ID first
    if (movieId) {
      const cacheKey = `id_${movieId}`
      if (cache[cacheKey]) {
        console.log(`✅ Found cached analysis for movie ID: ${movieId}`)
        return {
          ...cache[cacheKey],
          success: true,
          cached: true
        }
      }
    }

    // Try to find by title (case-insensitive)
    const titleLower = movieTitle.toLowerCase().replace(/\s+/g, '_')
    for (const [key, value] of Object.entries(cache)) {
      const cachedData = value as any
      if (cachedData.movie_title && 
          cachedData.movie_title.toLowerCase().replace(/\s+/g, '_') === titleLower) {
        console.log(`✅ Found cached analysis for movie title: ${movieTitle}`)
        return {
          ...cachedData,
          success: true,
          cached: true
        }
      }
    }

    return null
  } catch (error) {
    console.error('Error reading cache:', error)
    return null
  }
}

// Function to search for a movie in the dataset
async function searchMovieInDataset(title: string): Promise<any> {
  return new Promise((resolve) => {
    try {
      const scriptPath = path.join(process.cwd(), 'backend_api.py');
      
      const fs = require('fs');
      if (!fs.existsSync(scriptPath)) {
        console.error('❌ Python backend file not found');
        resolve({ success: false, error: 'Python backend not available' });
        return;
      }

      console.log(`🔍 Searching for movie: ${title}`);
      
      const pythonProcess = spawn('python', ['-c', `
import sys
import json
import pandas as pd
sys.path.append('${process.cwd().replace(/\\/g, '\\\\')}')

try:
    # Load the dataset
    df = pd.read_csv('data/archive/TMDB_movie_dataset_v11.csv')
    
    # Search for the movie (case-insensitive)
    title_lower = "${title.replace(/"/g, '\\"')}".lower()
    matches = df[df['title'].str.lower().str.contains(title_lower, na=False, regex=False)]
    
    if matches.empty:
        # Try exact match
        matches = df[df['title'].str.lower() == title_lower]
    
    if not matches.empty:
        # Get the first match
        movie = matches.iloc[0]
        result = {
            "success": True,
            "movie": {
                "id": int(movie.get('id', 0)) if pd.notna(movie.get('id')) else 0,
                "title": str(movie.get('title', '')),
                "vote_average": float(movie.get('vote_average', 0)) if pd.notna(movie.get('vote_average')) else 0.0,
                "vote_count": int(movie.get('vote_count', 0)) if pd.notna(movie.get('vote_count')) else 0,
                "release_date": str(movie.get('release_date', '')) if pd.notna(movie.get('release_date')) else '',
                "overview": str(movie.get('overview', '')) if pd.notna(movie.get('overview')) else '',
                "genres": str(movie.get('genres', '')) if pd.notna(movie.get('genres')) else '',
                "original_language": str(movie.get('original_language', '')) if pd.notna(movie.get('original_language')) else '',
                "poster_path": str(movie.get('poster_path', '')) if pd.notna(movie.get('poster_path')) else '',
                "popularity": float(movie.get('popularity', 0)) if pd.notna(movie.get('popularity')) else 0.0,
                "runtime": int(movie.get('runtime', 0)) if pd.notna(movie.get('runtime')) else 0,
                "imdb_id": str(movie.get('imdb_id', '')) if pd.notna(movie.get('imdb_id')) else ''
            }
        }
    else:
        result = {
            "success": False,
            "error": "Movie not found in dataset"
        }
    
    print(json.dumps(result))
    
except Exception as e:
    error_result = {
        "success": False,
        "error": str(e)
    }
    print(json.dumps(error_result))
`]);

      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0 && output.trim()) {
          try {
            const result = JSON.parse(output.trim());
            resolve(result);
          } catch (parseError) {
            console.error('❌ Failed to parse search output');
            resolve({ success: false, error: 'Failed to parse search results' });
          }
        } else {
          console.error(`❌ Search failed with code ${code}`);
          resolve({ success: false, error: errorOutput || 'Movie search failed' });
        }
      });
      
      setTimeout(() => {
        pythonProcess.kill();
        resolve({ success: false, error: 'Search timeout' });
      }, 30000);
      
    } catch (error) {
      console.error('❌ Failed to search movie:', error);
      resolve({ success: false, error: `Search error: ${error}` });
    }
  });
}

// Function to get Gemini intensity analysis
async function getGeminiAnalysis(movie: Movie): Promise<any> {
  return new Promise((resolve) => {
    try {
      console.log(`🤖 Analyzing movie intensity: ${movie.title}`);
      
      const movieJson = JSON.stringify(movie);
      const movieJsonBase64 = Buffer.from(movieJson).toString('base64');
      
      const pythonProcess = spawn('python', ['-c', `
import sys
import json
import os
import base64
sys.path.append('${process.cwd().replace(/\\/g, '\\\\')}')

# Redirect print statements to stderr to keep stdout clean for JSON
original_stdout = sys.stdout
class StderrWriter:
    def write(self, text):
        sys.stderr.write(text)
    def flush(self):
        sys.stderr.flush()

try:
    from movie.gemini_analyzer import MovieAnalyzer
    
    # Redirect prints to stderr during analysis
    sys.stdout = StderrWriter()
    
    # Decode movie data from base64
    movie_json_base64 = "${movieJsonBase64}"
    movie_json = base64.b64decode(movie_json_base64).decode('utf-8')
    movie = json.loads(movie_json)
    
    # Initialize analyzer
    analyzer = MovieAnalyzer()
    
    # Analyze intensity
    result = analyzer.analyze_movie_intensity(movie)
    
    # Restore stdout for JSON output
    sys.stdout = original_stdout
    
    # Ensure clean JSON output with proper encoding
    print(json.dumps(result, ensure_ascii=False))
    
except Exception as e:
    import traceback
    sys.stdout = original_stdout
    error_result = {
        "success": False,
        "error": str(e),
        "traceback": traceback.format_exc()
    }
    print(json.dumps(error_result, ensure_ascii=False))
`]);

      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0 && output.trim()) {
          try {
            const result = JSON.parse(output.trim());
            if (result.success) {
              console.log(`✅ Analysis complete for ${movie.title}`);
            } else {
              console.log(`⚠️ Analysis failed: ${result.error}`);
            }
            resolve(result);
          } catch (parseError) {
            console.error('❌ Failed to parse analysis output');
            resolve({ success: false, error: 'Failed to parse analysis response' });
          }
        } else {
          console.log(`⚠️ Analysis unavailable (code ${code})`);
          resolve({ success: false, error: errorOutput || 'Analysis not available' });
        }
      });
      
      setTimeout(() => {
        pythonProcess.kill();
        console.log('⚠️ Analysis timeout (120s)');
        resolve({ success: false, error: 'Analysis timeout' });
      }, 120000);
      
    } catch (error) {
      console.log('⚠️ Analysis error:', error);
      resolve({ success: false, error: `Analysis error: ${error}` });
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const { title } = await request.json()
    
    if (!title) {
      return NextResponse.json(
        { error: 'Movie title is required' },
        { status: 400 }
      )
    }

    // First, check the cache for existing analysis
    const cachedAnalysis = await checkIntensityCache(title)
    
    if (cachedAnalysis) {
      // If we have cached analysis, we still need movie data for display
      const searchResult = await searchMovieInDataset(title)
      
      if (searchResult.success && searchResult.movie) {
        return NextResponse.json({
          success: true,
          movie: searchResult.movie,
          intensity: cachedAnalysis
        })
      } else {
        // Return cached analysis with minimal movie info
        return NextResponse.json({
          success: true,
          movie: {
            title: cachedAnalysis.movie_title || title,
            id: cachedAnalysis.movie_id,
            genres: cachedAnalysis.genres || 'Unknown',
            release_date: cachedAnalysis.release_date || '',
            vote_average: 0,
            vote_count: 0,
            overview: '',
            original_language: 'unknown',
            popularity: 0
          },
          intensity: cachedAnalysis
        })
      }
    }

    // If not in cache, search for the movie
    const searchResult = await searchMovieInDataset(title)
    
    if (!searchResult.success || !searchResult.movie) {
      return NextResponse.json(
        { error: searchResult.error || 'Movie not found' },
        { status: 404 }
      )
    }

    const movie = searchResult.movie

    // Get intensity analysis (will create new analysis)
    const intensityAnalysis = await getGeminiAnalysis(movie)

    return NextResponse.json({
      success: true,
      movie: movie,
      intensity: intensityAnalysis
    })
    
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
