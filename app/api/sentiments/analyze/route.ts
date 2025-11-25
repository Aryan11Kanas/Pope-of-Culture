import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'

export async function POST(request: NextRequest) {
  try {
    const { title, imdb_id } = await request.json()
    
    if (!title || !imdb_id) {
      return NextResponse.json(
        { error: 'Title and IMDb ID are required' },
        { status: 400 }
      )
    }

    console.log(`🎭 Analyzing sentiments for: ${title} (${imdb_id})`)

    const pythonProcess = spawn('python', ['-c', `
import sys
import json
import os

# Redirect print statements to stderr
original_stdout = sys.stdout
class StderrWriter:
    def write(self, text):
        sys.stderr.write(text)
    def flush(self):
        sys.stderr.flush()

try:
    sys.stdout = StderrWriter()
    
    # Import after stdout redirect
    from movie.gemini_analyzer import MovieAnalyzer
    
    # Create a movie-like object with IMDb ID
    movie = {
        "title": "${title.replace(/"/g, '\\"')}",
        "imdb_id": "${imdb_id}",
        "overview": ""
    }
    
    # Initialize analyzer
    analyzer = MovieAnalyzer()
    
    # Fetch reviews
    reviews = analyzer._fetch_movie_reviews(movie)
    
    if not reviews or len(reviews) == 0:
        sys.stdout = original_stdout
        result = {
            "success": False,
            "error": "No reviews found for this movie"
        }
        print(json.dumps(result))
    else:
        # Prepare sentiment analysis prompt
        reviews_text = "\\n\\n---\\n\\n".join([f"Review {i+1}: {review[:500]}" for i, review in enumerate(reviews[:20])])
        
        prompt = f"""Analyze the sentiment of these IMDb reviews for "${title.replace(/"/g, '\\"')}":

{reviews_text}

Provide a comprehensive sentiment analysis with:
1. Overall sentiment (Positive/Negative/Mixed)
2. Sentiment distribution (count of positive, negative, neutral reviews)
3. Key themes mentioned by reviewers
4. A brief summary of what reviewers generally think

Format your response as JSON with these fields:
- overall_sentiment: string
- positive_count: number
- negative_count: number  
- neutral_count: number
- key_themes: array of strings
- sentiment_summary: string (2-3 sentences)"""

        # Call Gemini API if available
        if not analyzer.use_mock:
            response = analyzer._call_gemini_api(prompt)
            
            # Try to parse JSON from response
            import re
            json_match = re.search(r'\\{[^{}]*(?:\\{[^{}]*\\}[^{}]*)*\\}', response, re.DOTALL)
            if json_match:
                sentiment_data = json.loads(json_match.group())
            else:
                # Fallback parsing
                sentiment_data = {
                    "overall_sentiment": "Mixed",
                    "sentiment_summary": response[:500],
                    "positive_count": 0,
                    "negative_count": 0,
                    "neutral_count": 0,
                    "key_themes": []
                }
        else:
            # Mock sentiment analysis
            sentiment_data = {
                "overall_sentiment": "Positive",
                "positive_count": int(len(reviews) * 0.6),
                "negative_count": int(len(reviews) * 0.2),
                "neutral_count": int(len(reviews) * 0.2),
                "key_themes": ["Acting", "Story", "Direction", "Cinematography"],
                "sentiment_summary": "Most reviewers appreciate the film's storytelling and performances."
            }
        
        sys.stdout = original_stdout
        
        result = {
            "success": True,
            "movie_title": "${title.replace(/"/g, '\\"')}",
            "total_reviews": len(reviews),
            **sentiment_data
        }
        
        print(json.dumps(result, ensure_ascii=False))
    
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
      // Print stderr to console so it shows in terminal
      process.stderr.write(message)
    })

    return new Promise((resolve) => {
      pythonProcess.on('close', (code) => {
        if (code === 0 && output.trim()) {
          try {
            const result = JSON.parse(output.trim())
            console.log(`✅ Sentiment analysis complete for ${title}`)
            resolve(NextResponse.json(result))
          } catch (parseError) {
            console.error('Failed to parse sentiment output')
            resolve(NextResponse.json({ 
              success: false, 
              error: 'Failed to parse sentiment analysis'
            }))
          }
        } else {
          console.error(`Sentiment analysis failed with code ${code}`)
          resolve(NextResponse.json({ 
            success: false, 
            error: errorOutput || 'Sentiment analysis failed'
          }))
        }
      })

      // 120 second timeout for scraping + analysis
      setTimeout(() => {
        pythonProcess.kill()
        resolve(NextResponse.json({ 
          success: false, 
          error: 'Analysis timeout (scraping may have taken too long)'
        }))
      }, 120000)
    })
    
  } catch (error) {
    console.error('Sentiment Analysis API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
