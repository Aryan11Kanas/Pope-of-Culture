import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

// Fallback data based on common TMDB genres and languages
const fallbackGenres = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 
  'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery', 
  'Romance', 'Science Fiction', 'Thriller', 'War', 'Western'
];

const fallbackLanguages = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ar', name: 'Arabic' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' }
];

async function getPythonFilters(): Promise<any> {
  return new Promise((resolve) => {
    try {
      const scriptPath = path.join(process.cwd(), 'backend_api.py');
      
      // Check if Python backend file exists
      const fs = require('fs');
      if (!fs.existsSync(scriptPath)) {
        console.log('Python backend not found, using fallback data');
        resolve(null);
        return;
      }
      
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
    
    if api.is_loaded:
        # Get genres and languages
        genres = api.get_genres()
        languages = api.get_languages()
        
        result = {
            "success": True,
            "genres": genres,
            "languages": languages
        }
    else:
        result = {"success": False, "error": "API not loaded"}
    
    print(json.dumps(result))
    
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
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
              resolve(result);
            } else {
              console.warn('Python API returned error:', result.error);
              resolve(null);
            }
          } catch (parseError) {
            console.warn('Failed to parse Python output:', parseError);
            resolve(null);
          }
        } else {
          console.warn(`Python process failed with code ${code}:`, errorOutput);
          resolve(null);
        }
      });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        pythonProcess.kill();
        console.warn('Python process timeout');
        resolve(null);
      }, 30000);
      
    } catch (error) {
      console.warn('Failed to call Python API:', error);
      resolve(null);
    }
  });
}

export async function GET() {
  try {
    console.log('🔍 Getting available genres and languages from dataset');
    
    // Try Python backend first
    const pythonResult = await getPythonFilters();
    
    if (pythonResult && pythonResult.success) {
      console.log(`✅ Python backend returned ${pythonResult.genres.length} genres and ${pythonResult.languages.length} languages`);
      
      // Filter out empty genres and limit to reasonable size
      const cleanGenres = pythonResult.genres
        .filter((genre: string) => genre && genre.trim().length > 0)
        .filter((genre: string) => !genre.includes('[') && !genre.includes('{'))
        .slice(0, 30) // Limit to 30 most common genres
        .sort();
      
      // Filter and format languages
      const cleanLanguages = pythonResult.languages
        .filter((lang: any) => lang.code && lang.name && lang.code.length <= 3)
        .slice(0, 20) // Limit to 20 most common languages
        .sort((a: any, b: any) => a.name.localeCompare(b.name));
      
      return NextResponse.json({
        success: true,
        genres: cleanGenres,
        languages: cleanLanguages,
        source: 'python',
        message: `Loaded ${cleanGenres.length} genres and ${cleanLanguages.length} languages from dataset`
      });
    }
    
    // Fallback to hardcoded data
    console.log('⚠️ Using fallback filter data');
    return NextResponse.json({
      success: true,
      genres: fallbackGenres,
      languages: fallbackLanguages,
      source: 'fallback',
      message: `Using fallback data: ${fallbackGenres.length} genres and ${fallbackLanguages.length} languages`
    });

  } catch (error) {
    console.error('❌ Filters API error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to get filters',
        genres: fallbackGenres,
        languages: fallbackLanguages,
        source: 'fallback'
      },
      { status: 500 }
    );
  }
}