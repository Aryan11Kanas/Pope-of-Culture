'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Star, Film, Calendar, Clock, Globe, Heart, Loader2 } from "lucide-react"
import Image from 'next/image'

interface Movie {
  id: number
  title: string
  vote_average: number
  vote_count: number
  release_date: string
  overview: string
  genres: string
  original_language: string
  poster_path: string
  popularity: number
  runtime?: number
}

interface IntensityRating {
  score: number
  description: string
}

interface IntensityAnalysis {
  success: boolean
  movie_title: string
  movie_id?: number
  cached?: boolean
  intensity_ratings: {
    beginning: IntensityRating
    first_half: IntensityRating
    interval: IntensityRating
    second_half: IntensityRating
    climax: IntensityRating
  }
  overall_arc?: string
  peak_moments?: string
  pacing_assessment?: string
  full_analysis?: string
  plot_path?: string
  error?: string
}

interface RecommendationHistory {
  id: string
  timestamp: Date
  genre: string
  language: string
  movies: Movie[]
}

export default function DashboardPage() {
  const [selectedGenre, setSelectedGenre] = useState<string>('')
  const [selectedLanguage, setSelectedLanguage] = useState<string>('')
  const [recommendation, setRecommendation] = useState<Movie | null>(null)
  const [intensityAnalysis, setIntensityAnalysis] = useState<IntensityAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingFilters, setLoadingFilters] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recommendedMovieIds, setRecommendedMovieIds] = useState<number[]>([])
  const [availableGenres, setAvailableGenres] = useState<string[]>([])
  const [availableLanguages, setAvailableLanguages] = useState<{code: string, name: string}[]>([])

  // Load available genres and languages from API
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const response = await fetch('/api/filters')
        const data = await response.json()
        
        if (data.success) {
          setAvailableGenres(data.genres)
          setAvailableLanguages(data.languages)
          console.log(`Loaded ${data.genres.length} genres and ${data.languages.length} languages from ${data.source}`)
        } else {
          console.error('Failed to load filters:', data.error)
        }
      } catch (err) {
        console.error('Error loading filters:', err)
      } finally {
        setLoadingFilters(false)
      }
    }
    
    loadFilters()
  }, [])

  // Get recommended movies from localStorage to prevent duplicates
  useEffect(() => {
    const history = localStorage.getItem('recommendationHistory')
    if (history) {
      const parsedHistory: RecommendationHistory[] = JSON.parse(history)
      const allRecommendedIds = parsedHistory.flatMap(entry => entry.movies.map(movie => movie.id))
      setRecommendedMovieIds(allRecommendedIds)
    }
  }, [])

  const getRecommendations = async () => {
    if (!selectedGenre || !selectedLanguage) {
      setError('Please select both genre and language')
      return
    }

    console.log('🔄 Getting new recommendation...')
    console.log('Excluding IDs:', recommendedMovieIds)
    
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          genre: selectedGenre,
          language: selectedLanguage,
          excludedIds: recommendedMovieIds
        }),
      })

      const data = await response.json()

      if (data.success && data.recommendations.length > 0) {
        const movie = data.recommendations[0]
        setRecommendation(movie)
        
        // Set intensity analysis if available
        if (data.intensity) {
          const cacheStatus = data.intensity.cached ? '💾 CACHED' : '🆕 NEW'
          console.log(`📊 ${cacheStatus} - Intensity Analysis for:`, data.intensity.movie_title)
          if (data.intensity.intensity_ratings) {
            console.log('Scores:', Object.entries(data.intensity.intensity_ratings).map(([k, v]: [string, any]) => `${k}: ${v.score}`))
          }
          setIntensityAnalysis(data.intensity)
        } else {
          console.log('⚠️ No intensity analysis in response')
          setIntensityAnalysis(null)
        }
        
        // Save to history
        const newEntry: RecommendationHistory = {
          id: Date.now().toString(),
          timestamp: new Date(),
          genre: selectedGenre,
          language: selectedLanguage,
          movies: [movie]
        }

        const existingHistory = localStorage.getItem('recommendationHistory')
        const history: RecommendationHistory[] = existingHistory ? JSON.parse(existingHistory) : []
        history.unshift(newEntry)
        
        // Keep only last 50 entries
        if (history.length > 50) {
          history.splice(50)
        }
        
        localStorage.setItem('recommendationHistory', JSON.stringify(history))
        
        // Update excluded IDs
        const newRecommendedIds = [...recommendedMovieIds, movie.id]
        setRecommendedMovieIds(newRecommendedIds)
        
      } else {
        setError(data.error || 'Failed to get recommendations')
      }
    } catch (err) {
      setError('Failed to connect to recommendation service')
      console.error('Recommendation error:', err)
    } finally {
      setLoading(false)
    }
  }

  const getRatingColor = (rating: number) => {
    if (rating >= 9) return 'bg-green-100 text-green-800'
    if (rating >= 8) return 'bg-blue-100 text-blue-800'
    if (rating >= 7) return 'bg-yellow-100 text-yellow-800'
    if (rating >= 6) return 'bg-orange-100 text-orange-800'
    return 'bg-gray-100 text-gray-800'
  }

  const MovieCard = ({ movie }: { movie: Movie }) => (
    <Card key={movie.id} className="overflow-hidden hover:shadow-md transition-shadow">
      <div className="flex">
        {movie.poster_path && (
          <div className="w-24 h-36 relative flex-shrink-0 mr-4">
            <Image
              src={movie.poster_path.startsWith('http') ? movie.poster_path : `https://image.tmdb.org/t/p/w500${movie.poster_path}`}
              alt={movie.title}
              fill
              className="object-cover rounded"
            />
          </div>
        )}
        
        <CardContent className="flex-1 p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg leading-tight">{movie.title}</h3>
              <Badge className={getRatingColor(movie.vote_average)}>
                <Star className="w-3 h-3 mr-1" />
                {movie.vote_average.toFixed(1)}
              </Badge>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}
              </div>
              {movie.runtime && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {movie.runtime}m
                </div>
              )}
              <div className="flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {movie.original_language.toUpperCase()}
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground line-clamp-2">
              {movie.overview}
            </p>
            
            <div className="flex flex-wrap gap-1">
              {movie.genres.split(', ').map((genre, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {genre}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Movie Recommendation</h1>
        <p className="text-muted-foreground">Discover great movies based on your preferences using AI-powered recommendations.</p>
      </div>

      {/* Movie Recommendation Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="w-5 h-5" />
            Get Movie Recommendation
          </CardTitle>
          <CardDescription>
            Select your preferred genre and language to get personalized movie recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Genre</label>
              <Select value={selectedGenre} onValueChange={setSelectedGenre} disabled={loadingFilters}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingFilters ? "Loading genres..." : "Select genre"} />
                </SelectTrigger>
                <SelectContent>
                  {availableGenres.map((genre) => (
                    <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Language</label>
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage} disabled={loadingFilters}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingFilters ? "Loading languages..." : "Select language"} />
                </SelectTrigger>
                <SelectContent>
                  {availableLanguages.map((language) => (
                    <SelectItem key={language.code} value={language.code}>{language.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button 
                onClick={getRecommendations} 
                disabled={loading || !selectedGenre || !selectedLanguage}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Getting Recommendation...
                  </>
                ) : (
                  <>
                    <Heart className="w-4 h-4 mr-2" />
                    Get Recommendation
                  </>
                )}
              </Button>
            </div>
          </div>
          
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommendation Display */}
      {recommendation && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Recommendation</CardTitle>
              <CardDescription>
                Perfect match for {selectedGenre} in {availableLanguages.find(lang => lang.code === selectedLanguage)?.name || selectedLanguage}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MovieCard movie={recommendation} />
            </CardContent>
          </Card>

          {/* Intensity Analysis Display */}
          {intensityAnalysis && intensityAnalysis.success && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-xl">📊</span>
                  Intensity Analysis - AI Powered
                  {intensityAnalysis.cached && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Cached
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Gemini AI analysis of "{intensityAnalysis.movie_title}" across different runtime segments
                  {intensityAnalysis.cached && ' (loaded from cache)'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Intensity Graph */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Intensity Progression (out of 10)</h4>
                  <div className="space-y-3">
                    {['beginning', 'first_half', 'interval', 'second_half', 'climax'].map((segment) => {
                      const data = intensityAnalysis.intensity_ratings[segment as keyof typeof intensityAnalysis.intensity_ratings]
                      const segmentLabels: { [key: string]: string } = {
                        beginning: 'Beginning',
                        first_half: 'First Half',
                        interval: 'Interval',
                        second_half: 'Second Half',
                        climax: 'Climax'
                      }
                      
                      return (
                        <div key={segment} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{segmentLabels[segment]}</span>
                            <Badge variant="outline">{data.score}/10</Badge>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                data.score >= 9 ? 'bg-red-500' :
                                data.score >= 7 ? 'bg-orange-500' :
                                data.score >= 5 ? 'bg-yellow-500' :
                                'bg-blue-500'
                              }`}
                              style={{ width: `${data.score * 10}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Matplotlib Graph */}
                {intensityAnalysis.plot_path && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-sm mb-3">Intensity Progression Graph</h4>
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

          {/* Show message if analysis is unavailable */}
          {intensityAnalysis && !intensityAnalysis.success && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="py-4">
                <p className="text-sm text-yellow-800">
                  <span className="font-semibold">ℹ️ AI Analysis Unavailable:</span> {intensityAnalysis.error || 'Gemini API not configured'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}