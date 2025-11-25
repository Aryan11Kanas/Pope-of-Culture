import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import * as path from 'path'

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
}

// Function to call Python backend for recommendations
async function getPythonRecommendations(genre: string, language: string, excludedIds: number[] = []): Promise<any> {
  return new Promise((resolve) => {
    try {
      const scriptPath = path.join(process.cwd(), 'backend_api.py');
      
      // Check if Python backend file exists
      const fs = require('fs');
      if (!fs.existsSync(scriptPath)) {
        console.error('❌ Python backend file not found at:', scriptPath);
        resolve({ success: false, error: 'Python backend not available' });
        return;
      }

      console.log(`🔍 Calling Python backend for ${genre} movies in ${language}`);
      
      const pythonProcess = spawn('python', ['-c', `
import sys
import json
import os
sys.path.append('${process.cwd().replace(/\\/g, '\\\\')}')

# Suppress all console output except JSON result
class SuppressOutput:
    def __enter__(self):
        self._original_stdout = sys.stdout
        self._original_stderr = sys.stderr
        sys.stdout = open(os.devnull, 'w')
        sys.stderr = open(os.devnull, 'w')
        return self
    
    def __exit__(self, type, value, traceback):
        sys.stdout.close()
        sys.stderr.close()
        sys.stdout = self._original_stdout
        sys.stderr = self._original_stderr

try:
    with SuppressOutput():
        from backend_api import get_api_instance
        # Get API instance
        api = get_api_instance()
        # Get recommendations (limiting to 1 as per requirement)
        result = api.get_recommendations('${genre}', '${language}', ${JSON.stringify(excludedIds)}, 1)
    
    print(json.dumps(result))
    
except Exception as e:
    error_result = {
        "success": False,
        "error": str(e),
        "recommendations": []
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
            console.log(`✅ Python backend returned ${result.recommendations?.length || 0} recommendations`);
            resolve(result);
          } catch (parseError) {
            console.error('❌ Failed to parse Python output:', parseError);
            console.log('Python output:', output);
            resolve({ success: false, error: 'Failed to parse Python response' });
          }
        } else {
          console.error(`❌ Python process failed with code ${code}`);
          if (errorOutput) console.error('Python error:', errorOutput);
          resolve({ success: false, error: `Python process failed: ${errorOutput || 'Unknown error'}` });
        }
      });
      
      // Extended timeout for Python backend (45 seconds)
      setTimeout(() => {
        pythonProcess.kill();
        console.error('❌ Python process timeout (45 seconds)');
        resolve({ success: false, error: 'Python backend timeout' });
      }, 45000);
      
    } catch (error) {
      console.error('❌ Failed to call Python backend:', error);
      resolve({ success: false, error: `Backend error: ${error}` });
    }
  });
}

// Function to get Gemini intensity analysis for a movie
async function getGeminiAnalysis(movie: Movie): Promise<any> {
  return new Promise((resolve) => {
    try {
      console.log(`🤖 Analyzing movie intensity with Gemini: ${movie.title}`);
      
      const movieJson = JSON.stringify(movie);
      // Encode movie JSON as base64 to avoid escaping issues
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
              console.log(`✅ Gemini analysis complete for ${movie.title}`);
            } else {
              console.log(`⚠️  Gemini analysis failed: ${result.error}`);
              if (result.traceback) {
                console.log('Python traceback:', result.traceback);
              }
            }
            resolve(result);
          } catch (parseError) {
            console.error('❌ Failed to parse Gemini output:', parseError);
            console.log('Raw output (first 500 chars):', output.substring(0, 500));
            console.log('Full output length:', output.length);
            resolve({ success: false, error: 'Failed to parse Gemini response', raw_output: output.substring(0, 500) });
          }
        } else {
          console.log(`⚠️  Gemini analysis unavailable (code ${code})`);
          if (errorOutput) {
            console.log('Python stderr:', errorOutput);
          }
          resolve({ success: false, error: errorOutput || 'Gemini API not available' });
        }
      });
      
      // Timeout for Gemini analysis (120 seconds to allow for review fetching)
      setTimeout(() => {
        pythonProcess.kill();
        console.log('⚠️  Gemini analysis timeout (120s)');
        resolve({ success: false, error: 'Analysis timeout' });
      }, 120000);
      
    } catch (error) {
      console.log('⚠️  Gemini analysis error:', error);
      resolve({ success: false, error: `Analysis error: ${error}` });
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const { genre, language, excludedIds = [] } = await request.json()
    
    if (!genre || !language) {
      return NextResponse.json(
        { error: 'Genre and language are required' },
        { status: 400 }
      )
    }

    console.log(`🔍 Requesting recommendations: ${genre} movies in ${language}`);
    console.log(`📋 Excluded IDs: ${excludedIds.length > 0 ? excludedIds.join(', ') : 'none'}`);

    // Call Python backend for real data
    const result = await getPythonRecommendations(genre, language, excludedIds);

    if (!result.success) {
      console.error('❌ Python backend error:', result.error);
      // Fallback: don't return HTTP 500. Return a safe empty result so frontend stays usable.
      return NextResponse.json({
        success: false,
        recommendations: [],
        total: 0,
        filters: { genre, language },
        excludedCount: excludedIds.length,
        source: 'python_backend',
        details: result.error,
        message: 'Python backend unavailable; falling back to empty recommendations.'
      }, { status: 200 });
    }

    // Ensure we only return 1 movie as per requirement
    const recommendations = result.recommendations?.slice(0, 1) || [];

    // If we have a recommendation, analyze it with Gemini
    let intensityAnalysis = null;
    if (recommendations.length > 0) {
      const movie = recommendations[0];
      intensityAnalysis = await getGeminiAnalysis(movie);
    }

    return NextResponse.json({
      success: true,
      recommendations,
      total: recommendations.length,
      filters: { genre, language },
      excludedCount: excludedIds.length,
      source: 'python_backend',
      intensity: intensityAnalysis,
      message: recommendations.length === 0 ? 
        `No ${genre} movies found in ${language} with rating ≥ 6.0` : 
        `Found 1 recommendation from TMDB dataset${intensityAnalysis?.success ? ' with AI analysis' : ''}`
    })

  } catch (error) {
    console.error('❌ Recommendation API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Movie Recommendations API - Using Python Backend with 1.3M TMDB Movies',
    endpoints: {
      POST: '/api/recommendations - Get movie recommendations from Python backend',
    },
    note: 'This API now uses only the Python backend with the full TMDB dataset. No mock data fallback.',
    filters: {
      genres: ['Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery', 'Romance', 'Science Fiction', 'TV Movie', 'Thriller', 'War', 'Western'],
      languages: ['en', 'es', 'fr', 'de', 'it', 'ja', 'ko', 'zh', 'hi', 'ar']
    }
  })
}