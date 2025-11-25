'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Star, Film, Calendar, Clock, Globe, History, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
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

interface RecommendationHistory {
  id: string
  timestamp: Date
  genre: string
  language: string
  movies: Movie[]
}

export default function RecommendationsPage() {
  const [history, setHistory] = useState<RecommendationHistory[]>([])

  useEffect(() => {
    const loadHistory = () => {
      const storedHistory = localStorage.getItem('recommendationHistory')
      if (storedHistory) {
        const parsedHistory: RecommendationHistory[] = JSON.parse(storedHistory)
        // Convert timestamp strings back to Date objects
        const historyWithDates = parsedHistory.map(entry => ({
          ...entry,
          timestamp: new Date(entry.timestamp)
        }))
        setHistory(historyWithDates)
      }
    }

    loadHistory()
    
    // Listen for storage changes to update history in real-time
    const handleStorageChange = () => {
      loadHistory()
    }
    
    window.addEventListener('storage', handleStorageChange)
    
    // Also listen for custom events from the dashboard
    const handleHistoryUpdate = () => {
      loadHistory()
    }
    
    window.addEventListener('historyUpdated', handleHistoryUpdate)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('historyUpdated', handleHistoryUpdate)
    }
  }, [])

  const clearHistory = () => {
    localStorage.removeItem('recommendationHistory')
    setHistory([])
  }

  const removeHistoryItem = (id: string) => {
    const updatedHistory = history.filter(item => item.id !== id)
    setHistory(updatedHistory)
    localStorage.setItem('recommendationHistory', JSON.stringify(updatedHistory))
  }

  const getRatingColor = (rating: number) => {
    if (rating >= 9) return 'bg-green-100 text-green-800'
    if (rating >= 8) return 'bg-blue-100 text-blue-800'
    if (rating >= 7) return 'bg-yellow-100 text-yellow-800'
    if (rating >= 6) return 'bg-orange-100 text-orange-800'
    return 'bg-gray-100 text-gray-800'
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const getLanguageName = (code: string) => {
    const languages: { [key: string]: string } = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'ja': 'Japanese',
      'ko': 'Korean',
      'zh': 'Chinese',
      'hi': 'Hindi',
      'ar': 'Arabic',
      'pt': 'Portuguese',
      'ru': 'Russian'
    }
    return languages[code] || code.toUpperCase()
  }

  const MovieCard = ({ movie }: { movie: Movie }) => (
    <div className="flex bg-gray-50 rounded-lg p-3">
      {movie.poster_path && (
        <div className="w-16 h-24 relative flex-shrink-0 mr-3">
          <Image
            src={movie.poster_path.startsWith('http') ? movie.poster_path : `https://image.tmdb.org/t/p/w500${movie.poster_path}`}
            alt={movie.title}
            fill
            className="object-cover rounded"
          />
        </div>
      )}
      
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm leading-tight">{movie.title}</h4>
          <Badge className={`${getRatingColor(movie.vote_average)} text-xs`}>
            <Star className="w-2.5 h-2.5 mr-1" />
            {movie.vote_average.toFixed(1)}
          </Badge>
        </div>
        
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="w-2.5 h-2.5" />
            {movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}
          </div>
          {movie.runtime && (
            <div className="flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {movie.runtime}m
            </div>
          )}
          <div className="flex items-center gap-1">
            <Globe className="w-2.5 h-2.5" />
            {movie.original_language.toUpperCase()}
          </div>
        </div>
        
        <p className="text-xs text-muted-foreground line-clamp-2">
          {movie.overview}
        </p>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Recommendation History</h1>
          <p className="text-muted-foreground">View all your previous movie recommendations and discover patterns in your preferences.</p>
        </div>
        
        {history.length > 0 && (
          <Button variant="outline" onClick={clearHistory} className="text-red-600 hover:text-red-700">
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All History
          </Button>
        )}
      </div>

      {history.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <History className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">No recommendation history yet</h3>
            <p className="text-sm text-gray-500 text-center mb-6 max-w-md">
              Get started by requesting movie recommendations from the dashboard. Your recommendation history will appear here.
            </p>
            <Button onClick={() => window.location.href = '/dashboard'}>
              <Film className="w-4 h-4 mr-2" />
              Get Recommendations
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {history.map((entry) => (
            <Card key={entry.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {entry.genre} Movies in {getLanguageName(entry.language)}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {formatDate(entry.timestamp)}
                    </CardDescription>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => removeHistoryItem(entry.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent>
                <ScrollArea className="h-auto max-h-96">
                  <div className="space-y-3">
                    {entry.movies.map((movie) => (
                      <MovieCard key={movie.id} movie={movie} />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}