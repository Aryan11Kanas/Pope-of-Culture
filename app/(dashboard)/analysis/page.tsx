'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface IntensityRating {
  score: number
  description: string
}

interface IntensityAnalysis {
  success: boolean
  cached?: boolean
  movie_title?: string
  movie_id?: number | null
  intensity_ratings?: {
    beginning: IntensityRating
    first_half: IntensityRating
    interval: IntensityRating
    second_half: IntensityRating
    climax: IntensityRating
  }
  overall_arc?: string
  peak_moments?: string
  pacing_assessment?: string
  plot_path?: string
  error?: string
}

interface MovieSearchResult {
  id: number
  title: string
  vote_average: number
  vote_count: number
  release_date: string
  overview: string
  genres: string
  original_language: string
  poster_path?: string
  popularity: number
  runtime?: number
  imdb_id?: string
}

export default function AnalysisPage() {
  const [movieTitle, setMovieTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [movieData, setMovieData] = useState<MovieSearchResult | null>(null)
  const [intensityAnalysis, setIntensityAnalysis] = useState<IntensityAnalysis | null>(null)

  const searchAndAnalyze = async () => {
    if (!movieTitle.trim()) {
      setError('Please enter a movie title')
      return
    }

    setLoading(true)
    setError(null)
    setMovieData(null)
    setIntensityAnalysis(null)

    try {
      const response = await fetch('/api/analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: movieTitle.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze movie')
      }

      if (data.movie) {
        setMovieData(data.movie)
      }

      if (data.intensity) {
        setIntensityAnalysis(data.intensity)
      } else {
        setError('No analysis data received')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while analyzing the movie')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchAndAnalyze()
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Movie Analysis</h1>
        <p className="text-muted-foreground">
          Enter a movie title to get AI-powered intensity analysis
        </p>
      </div>

      {/* Search Input */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Input
              placeholder="e.g., The Godfather, Inception, Parasite..."
              value={movieTitle}
              onChange={(e) => setMovieTitle(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
              className="flex-1"
            />
            <Button onClick={searchAndAnalyze} disabled={loading}>
              {loading ? 'Analyzing...' : 'Analyze'}
            </Button>
          </div>
          {error && (
            <p className="text-sm text-red-500 mt-2">❌ {error}</p>
          )}
        </CardContent>
      </Card>

      {/* Movie Information */}
      {movieData && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>{movieData.title}</CardTitle>
                <CardDescription>
                  {movieData.release_date ? new Date(movieData.release_date).getFullYear() : 'N/A'} • {movieData.genres} • {movieData.original_language.toUpperCase()}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary">
                  ⭐ {movieData.vote_average.toFixed(1)}
                </Badge>
                {movieData.imdb_id && (
                  <Badge variant="outline">
                    🔗 IMDb
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{movieData.overview}</p>
          </CardContent>
        </Card>
      )}

      {/* Intensity Analysis */}
      {intensityAnalysis && intensityAnalysis.success && intensityAnalysis.intensity_ratings && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Intensity Analysis</CardTitle>
              {intensityAnalysis.cached && (
                <Badge variant="secondary">💾 Cached</Badge>
              )}
            </div>
            <CardDescription>
              AI-powered intensity breakdown across the movie's runtime
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Intensity Segments */}
            <div className="space-y-3">
              {Object.entries(intensityAnalysis.intensity_ratings).map(([segment, data]) => (
                <div key={segment} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold capitalize">
                      {segment.replace('_', ' ')}
                    </h3>
                    <Badge variant={data.score >= 8 ? 'destructive' : data.score >= 6 ? 'default' : 'secondary'}>
                      {data.score}/10
                    </Badge>
                  </div>
                  
                  {/* Visual intensity bar */}
                  <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        data.score >= 8 ? 'bg-red-500' :
                        data.score >= 6 ? 'bg-orange-500' :
                        data.score >= 4 ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${data.score * 10}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Matplotlib Graph */}
            {intensityAnalysis.plot_path && (
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Intensity Progression Graph</h4>
                <div className="relative w-full bg-gray-50 rounded-lg overflow-hidden">
                  <img 
                    src={`/api/graph?path=${encodeURIComponent(intensityAnalysis.plot_path)}`}
                    alt="Intensity progression graph"
                    className="w-full h-auto"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Analysis Unavailable */}
      {intensityAnalysis && !intensityAnalysis.success && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="py-4">
            <p className="text-sm text-yellow-800">
              <span className="font-semibold">ℹ️ AI Analysis Unavailable:</span> {intensityAnalysis.error || 'Could not analyze this movie'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
