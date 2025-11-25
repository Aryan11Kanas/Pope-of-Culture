'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Search } from 'lucide-react'

interface Movie {
  id: number
  title: string
  imdb_id: string
  release_date: string
}

interface SentimentAnalysis {
  success: boolean
  movie_title?: string
  total_reviews?: number
  sentiment_summary?: string
  positive_count?: number
  negative_count?: number
  neutral_count?: number
  key_themes?: string[]
  overall_sentiment?: string
  error?: string
}

export default function SentimentsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [movies, setMovies] = useState<Movie[]>([])
  const [loading, setLoading] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analyzingMovie, setAnalyzingMovie] = useState<number | null>(null)
  const [sentimentResults, setSentimentResults] = useState<{ [key: number]: SentimentAnalysis }>({})

  const searchMovies = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a movie title to search')
      return
    }

    setSearchLoading(true)
    setError(null)
    setMovies([])

    try {
      const response = await fetch('/api/sentiments/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search movies')
      }

      if (data.movies && data.movies.length > 0) {
        setMovies(data.movies)
      } else {
        setError('No scrapable movies found with that title')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while searching')
    } finally {
      setSearchLoading(false)
    }
  }

  const analyzeSentiments = async (movie: Movie) => {
    setAnalyzingMovie(movie.id)
    setError(null)

    try {
      const response = await fetch('/api/sentiments/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          title: movie.title,
          imdb_id: movie.imdb_id 
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze sentiments')
      }

      setSentimentResults(prev => ({
        ...prev,
        [movie.id]: data
      }))
    } catch (err: any) {
      setError(err.message || 'An error occurred during analysis')
    } finally {
      setAnalyzingMovie(null)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchMovies()
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Web Sentiments</h1>
        <p className="text-muted-foreground">
          Search for movies and analyze IMDb review sentiments using AI
        </p>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search for movies with IMDb reviews..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={searchLoading}
                className="pl-10"
              />
            </div>
            <Button onClick={searchMovies} disabled={searchLoading}>
              {searchLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                'Search'
              )}
            </Button>
          </div>
          {error && (
            <p className="text-sm text-red-500 mt-2">❌ {error}</p>
          )}
        </CardContent>
      </Card>

      {/* Search Results */}
      {movies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Scrapable Movies ({movies.length})</CardTitle>
            <CardDescription>
              Movies with IMDb IDs available for sentiment analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {movies.map((movie) => (
                <div key={movie.id}>
                  <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold">{movie.title}</h3>
                        <Badge variant="outline" className="text-xs">
                          {movie.imdb_id}
                        </Badge>
                        {movie.release_date && (
                          <span className="text-sm text-muted-foreground">
                            ({new Date(movie.release_date).getFullYear()})
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => analyzeSentiments(movie)}
                      disabled={analyzingMovie === movie.id}
                      size="sm"
                    >
                      {analyzingMovie === movie.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        'Get Sentiments'
                      )}
                    </Button>
                  </div>

                  {/* Sentiment Results */}
                  {sentimentResults[movie.id] && sentimentResults[movie.id].success && (
                    <Card className="mt-3 ml-4 border-l-4 border-l-blue-500">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">Sentiment Analysis</CardTitle>
                          {sentimentResults[movie.id].overall_sentiment && (
                            <Badge 
                              variant={
                                sentimentResults[movie.id].overall_sentiment?.toLowerCase() === 'positive' ? 'default' :
                                sentimentResults[movie.id].overall_sentiment?.toLowerCase() === 'negative' ? 'destructive' :
                                'secondary'
                              }
                            >
                              {sentimentResults[movie.id].overall_sentiment}
                            </Badge>
                          )}
                        </div>
                        <CardDescription>
                          Based on {sentimentResults[movie.id].total_reviews || 0} IMDb reviews
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Sentiment Summary */}
                        {sentimentResults[movie.id].sentiment_summary && (
                          <div>
                            <h4 className="font-semibold text-sm mb-2">📝 Summary</h4>
                            <p className="text-sm text-muted-foreground">
                              {sentimentResults[movie.id].sentiment_summary}
                            </p>
                          </div>
                        )}

                        {/* Sentiment Distribution */}
                        {(sentimentResults[movie.id].positive_count !== undefined ||
                          sentimentResults[movie.id].negative_count !== undefined ||
                          sentimentResults[movie.id].neutral_count !== undefined) && (
                          <div>
                            <h4 className="font-semibold text-sm mb-2">📊 Distribution</h4>
                            <div className="flex gap-3">
                              {sentimentResults[movie.id].positive_count !== undefined && (
                                <div className="flex items-center gap-2">
                                  <Badge variant="default" className="bg-green-500">
                                    Positive: {sentimentResults[movie.id].positive_count}
                                  </Badge>
                                </div>
                              )}
                              {sentimentResults[movie.id].negative_count !== undefined && (
                                <div className="flex items-center gap-2">
                                  <Badge variant="destructive">
                                    Negative: {sentimentResults[movie.id].negative_count}
                                  </Badge>
                                </div>
                              )}
                              {sentimentResults[movie.id].neutral_count !== undefined && (
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary">
                                    Neutral: {sentimentResults[movie.id].neutral_count}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Key Themes */}
                        {sentimentResults[movie.id].key_themes && sentimentResults[movie.id].key_themes!.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-sm mb-2">🔑 Key Themes</h4>
                            <div className="flex flex-wrap gap-2">
                              {sentimentResults[movie.id].key_themes!.map((theme, index) => (
                                <Badge key={index} variant="outline">
                                  {theme}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Error Display */}
                  {sentimentResults[movie.id] && !sentimentResults[movie.id].success && (
                    <Card className="mt-3 ml-4 border-l-4 border-l-red-500">
                      <CardContent className="py-4">
                        <p className="text-sm text-red-600">
                          ❌ {sentimentResults[movie.id].error || 'Failed to analyze sentiments'}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Results Message */}
      {!searchLoading && movies.length === 0 && searchQuery && !error && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              Search for movies to see which ones can be analyzed for sentiments
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
