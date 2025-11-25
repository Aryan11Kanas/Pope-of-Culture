"""
Gemini AI Movie Analyzer
Provides detailed analysis of recommended movies using Google's Gemini AI
"""
import os
import sys
from typing import Dict, Any, Optional
from pathlib import Path
import requests
import json

# Matplotlib for saving intensity graphs (use non-interactive backend)
try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
except Exception:
    plt = None

# Try to load .env file if python-dotenv is available
try:
    from dotenv import load_dotenv
    # Look for .env file in project root
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    # python-dotenv not installed, will use system environment variables
    pass


class MovieAnalyzer:
    """
    Analyzes movies using Google Gemini AI to provide insights,
    recommendations, and detailed analysis.
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the MovieAnalyzer with Gemini API
        
        Args:
            api_key: Google Gemini API key. If None, reads from GEMINI_API_KEY env variable
        """
        self.api_key = api_key or os.getenv('GEMINI_API_KEY')
        self.use_mock = not self.api_key or self.api_key == 'DUMMY_KEY'
        
        # Use REST API directly with Gemini 2.0 Flash
        if not self.use_mock:
            self.api_url = f"https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key={self.api_key}"
        
        # Cache file path
        self.cache_file = Path(__file__).parent / 'intensity_cache.json'
        self._load_cache()
    

    def _load_cache(self):
        """Load intensity cache from JSON file"""
        try:
            if self.cache_file.exists():
                with open(self.cache_file, 'r', encoding='utf-8') as f:
                    self.intensity_cache = json.load(f)
            else:
                self.intensity_cache = {}
        except Exception as e:
            print(f"Warning: Could not load cache: {e}")
            self.intensity_cache = {}

    def _save_intensity_plot(self, movie: Dict[str, Any], intensity_ratings: Dict[str, Any]) -> Optional[str]:
        """Save a matplotlib plot (PNG) for the intensity ratings of a movie.

        Returns the path to the saved PNG as a string, or None on failure.
        """
        if plt is None:
            return None

        graphs_dir = Path(__file__).parent / 'intensity_graphs'
        try:
            graphs_dir.mkdir(parents=True, exist_ok=True)
        except Exception:
            return None

        title = str(movie.get('title', 'unknown'))
        movie_id = movie.get('id')
        safe_title = ''.join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in title).strip().replace(' ', '_')
        filename = f"{safe_title}"
        if movie_id:
            filename = f"{movie_id}_{filename}"
        out_path = graphs_dir / f"{filename}.png"

        labels = ['Beginning', 'First Half', 'Interval', 'Second Half', 'Climax']
        try:
            scores = [
                int(intensity_ratings.get('beginning', {}).get('score', 0)),
                int(intensity_ratings.get('first_half', {}).get('score', 0)),
                int(intensity_ratings.get('interval', {}).get('score', 0)),
                int(intensity_ratings.get('second_half', {}).get('score', 0)),
                int(intensity_ratings.get('climax', {}).get('score', 0)),
            ]
        except Exception:
            return None

        try:
            plt.figure(figsize=(6, 3.5))
            bars = plt.bar(labels, scores, color=['#60a5fa', '#f59e0b', '#f97316', '#ef4444', '#dc2626'])
            plt.ylim(0, 10)
            plt.ylabel('Intensity (0-10)')
            plt.title(f"Intensity Progression — {title}")
            for bar, val in zip(bars, scores):
                plt.text(bar.get_x() + bar.get_width() / 2, val + 0.2, str(val), ha='center', va='bottom', fontsize=9)
            plt.tight_layout()
            # Save to internal folder first
            plt.savefig(out_path, dpi=150)

            # Return the internal filesystem path for now (saved in movie/intensity_graphs)
            try:
                plt.close()
            except Exception:
                pass
            return str(out_path)
        except Exception:
            try:
                plt.close()
            except Exception:
                pass
            return None
    
    def _save_cache(self):
        """Save intensity cache to JSON file"""
        try:
            with open(self.cache_file, 'w', encoding='utf-8') as f:
                json.dump(self.intensity_cache, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Warning: Could not save cache: {e}")
    
    def _get_cache_key(self, movie: Dict[str, Any]) -> str:
        """Generate unique cache key for a movie"""
        # Use movie ID if available, otherwise use title + release date
        if 'id' in movie and movie['id']:
            return f"id_{movie['id']}"
        else:
            title = movie.get('title', 'unknown').lower().replace(' ', '_')
            year = movie.get('release_date', '')[:4] if movie.get('release_date') else 'unknown'
            return f"{title}_{year}"
    
    def analyze_movie_intensity(self, movie: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze movie intensity across different runtime segments
        Uses cache to avoid re-analyzing the same movie
        
        Args:
            movie: Dictionary containing movie information (single recommendation)
                   Expected keys: title, overview, genres, vote_average, etc.
        
        Returns:
            Dictionary with intensity ratings for each segment
        """
        # Check cache first
        cache_key = self._get_cache_key(movie)
        if cache_key in self.intensity_cache:
            cached_data = self.intensity_cache[cache_key].copy()
            cached_data['success'] = True
            cached_data['cached'] = True
            cached_data['movie_title'] = str(movie.get('title', 'Unknown'))
            cached_data['movie_id'] = movie.get('id', None)
            # include plot path if available in cache
            cached_data['plot_path'] = self.intensity_cache.get(cache_key, {}).get('plot_path')

            # If cache exists but plot is missing, try to generate it now (non-blocking best-effort)
            if not cached_data.get('plot_path'):
                try:
                    existing_ratings = self.intensity_cache.get(cache_key, {}).get('intensity_ratings')
                    if existing_ratings:
                        plot_path = self._save_intensity_plot(movie, existing_ratings)
                        if plot_path:
                            # update persistent cache and returned data
                            self.intensity_cache[cache_key]['plot_path'] = plot_path
                            self._save_cache()
                            cached_data['plot_path'] = plot_path
                except Exception:
                    # ignore plotting failures for cache-read path
                    pass

            return cached_data
        
        # Fetch reviews before analysis (non-blocking, only if IMDb ID is available)
        reviews = []
        if movie.get('imdb_id'):
            try:
                reviews = self._fetch_movie_reviews(movie)
            except Exception as e:
                print(f"⚠ Review fetching failed (continuing without reviews): {e}", file=sys.stderr)
        else:
            print(f"ℹ️ No IMDb ID available for '{movie.get('title', 'Unknown')}', skipping review fetch", file=sys.stderr)
        
        # Not in cache, call Gemini API
        prompt = self._create_intensity_prompt(movie, reviews)
        
        try:
            # Use mock data if no valid API key
            if self.use_mock:
                response_text = self._generate_mock_analysis(movie)
            else:
                response_text = self._call_gemini_api(prompt)
            
            # Debug: Print response for troubleshooting
            print(f"\n{'='*60}")
            print(f"GEMINI RESPONSE for '{movie.get('title', 'Unknown')}':")
            print(f"{'='*60}")
            print(response_text[:1000] if len(response_text) > 1000 else response_text)
            print(f"{'='*60}\n")
            
            intensity_data = self._parse_intensity_analysis(response_text)
            
            # Clean up any potential JSON-breaking characters in descriptions
            for segment in intensity_data.get('intensity_ratings', {}).values():
                if 'description' in segment and segment['description']:
                    # Ensure description is a clean string
                    segment['description'] = str(segment['description']).strip()
            
            # Clean other text fields
            for field in ['overall_arc', 'peak_moments', 'pacing_assessment', 'full_analysis']:
                if field in intensity_data and intensity_data[field]:
                    intensity_data[field] = str(intensity_data[field]).strip()
            
            intensity_data['success'] = True
            intensity_data['cached'] = False
            intensity_data['movie_title'] = str(movie.get('title', 'Unknown'))
            intensity_data['movie_id'] = movie.get('id', None)
            
            # Save to cache (store only the analysis data, not success/cached flags)
            cache_data = {
                'movie_title': str(movie.get('title', 'Unknown')),
                'movie_id': movie.get('id', None),
                'genres': movie.get('genres', 'Unknown'),
                'release_date': movie.get('release_date', 'Unknown'),
                'intensity_ratings': intensity_data['intensity_ratings'],
                'overall_arc': intensity_data.get('overall_arc', ''),
                'peak_moments': intensity_data.get('peak_moments', ''),
                'pacing_assessment': intensity_data.get('pacing_assessment', ''),
                'full_analysis': intensity_data.get('full_analysis', '')
            }
            # Generate and store plot (if matplotlib available)
            try:
                plot_path = self._save_intensity_plot(movie, cache_data['intensity_ratings'])
                if plot_path:
                    cache_data['plot_path'] = plot_path
            except Exception:
                cache_data['plot_path'] = None

            self.intensity_cache[cache_key] = cache_data
            self._save_cache()

            # Include plot path in returned data for frontend use
            intensity_data['plot_path'] = cache_data.get('plot_path')
            return intensity_data
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'movie_title': str(movie.get('title', 'Unknown')),
                'movie_id': movie.get('id', None),
                'cached': False
            }
    
    def _call_gemini_api(self, prompt: str) -> str:
        """Call Gemini API using REST"""
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }]
        }
        
        response = requests.post(
            self.api_url,
            headers={"Content-Type": "application/json"},
            json=payload,
            timeout=30
        )
        
        if response.status_code != 200:
            raise Exception(f"API request failed: {response.status_code} - {response.text}")
        
        result = response.json()
        return result['candidates'][0]['content']['parts'][0]['text']
    
    def _generate_mock_analysis(self, movie: Dict[str, Any]) -> str:
        """Generate mock intensity analysis when API key is not available"""
        title = movie.get('title', 'Unknown')
        genres = movie.get('genres', 'Unknown')
        
        # Generate plausible intensity scores based on genre
        genre_lower = str(genres).lower()
        if 'action' in genre_lower or 'thriller' in genre_lower:
            scores = [6, 7, 8, 9, 10]
        elif 'drama' in genre_lower:
            scores = [5, 6, 7, 8, 7]
        elif 'comedy' in genre_lower:
            scores = [6, 6, 5, 7, 8]
        elif 'horror' in genre_lower:
            scores = [7, 6, 5, 8, 9]
        else:
            scores = [6, 7, 7, 8, 9]
        
        return f"""Beginning: {scores[0]}/10
Description: The opening establishes the setting and introduces key characters

First Half: {scores[1]}/10
Description: Story develops with rising tension and character development

Interval: {scores[2]}/10
Description: Midpoint brings new revelations and plot twists

Second Half: {scores[3]}/10
Description: Escalating conflicts lead toward the climax

Climax: {scores[4]}/10
Description: Final confrontation delivers maximum intensity

Overall Intensity Arc: {title} builds tension progressively across its runtime

Peak Moments: Key action sequences and dramatic reveals

Pacing Assessment: Well-balanced progression with effective buildup"""

    def _create_intensity_prompt(self, movie: Dict[str, Any], reviews: list = None) -> str:
        """Create a prompt specifically for intensity analysis across runtime"""
        title = movie.get('title', 'Unknown')
        overview = movie.get('overview', 'No overview available')
        genres = movie.get('genres', 'Unknown')
        rating = movie.get('vote_average', 'N/A')
        release_date = movie.get('release_date', 'Unknown')
        
        # Build the base prompt
        prompt = f"""Analyze intensity for: "{title}" ({release_date}, {genres}, Rating: {rating}/10)

Plot: {overview}"""

        # Add reviews if available
        if reviews and len(reviews) > 0:
            prompt += f"\n\nUser Reviews ({len(reviews)} reviews from IMDb):\n"
            prompt += "\n---\n"
            # Include up to 10 reviews to keep prompt manageable
            for i, review in enumerate(reviews[:10], 1):
                # Truncate very long reviews
                review_text = review[:500] + "..." if len(review) > 500 else review
                prompt += f"Review {i}: {review_text}\n\n"
            
            if len(reviews) > 10:
                prompt += f"(and {len(reviews) - 10} more reviews...)\n"
            
            prompt += "---\n"
        
        prompt += """
Rate intensity (0-10) for each segment based on actual plot events and user reviews. Use this format:

Beginning: X/10
Description: What happens in the opening

First Half: X/10
Description: How the story develops

Interval: X/10
Description: Midpoint events

Second Half: X/10
Description: Rising action

Climax: X/10
Description: Final confrontation

Overall Intensity Arc: Summary

Peak Moments: Most intense scenes

Pacing Assessment: Overall pacing

IMPORTANT: Rate based on {title}'s actual story and audience reactions in reviews. Different genres have different intensity patterns - use the full 0-10 scale honestly."""
        
        return prompt
    
    
    def _parse_intensity_analysis(self, response_text: str) -> Dict[str, Any]:
        """
        Parse intensity analysis response into structured data
        
        Args:
            response_text: Raw text response from Gemini
        
        Returns:
            Structured dictionary with intensity ratings and descriptions
        """
        import re
        
        if not response_text or not isinstance(response_text, str):
            # Return default structure instead of raising error
            return {
                'full_analysis': '',
                'intensity_ratings': {
                    'beginning': {'score': 0, 'description': 'No data'},
                    'first_half': {'score': 0, 'description': 'No data'},
                    'interval': {'score': 0, 'description': 'No data'},
                    'second_half': {'score': 0, 'description': 'No data'},
                    'climax': {'score': 0, 'description': 'No data'}
                },
                'overall_arc': '',
                'peak_moments': '',
                'pacing_assessment': ''
            }
        
        result = {
            'full_analysis': response_text,
            'intensity_ratings': {
                'beginning': {'score': 0, 'description': ''},
                'first_half': {'score': 0, 'description': ''},
                'interval': {'score': 0, 'description': ''},
                'second_half': {'score': 0, 'description': ''},
                'climax': {'score': 0, 'description': ''}
            },
            'overall_arc': '',
            'peak_moments': '',
            'pacing_assessment': ''
        }
        
        try:
            # Extract intensity scores - simple pattern matching
            segments = {
                'beginning': r'beginning[:\-\s]+(\d+)/10',
                'first_half': r'first\s+half[:\-\s]+(\d+)/10',
                'interval': r'interval[:\-\s]+(\d+)/10',
                'second_half': r'second\s+half[:\-\s]+(\d+)/10',
                'climax': r'climax[:\-\s]+(\d+)/10'
            }
            
            for segment, pattern in segments.items():
                match = re.search(pattern, response_text, re.IGNORECASE)
                if match:
                    result['intensity_ratings'][segment]['score'] = int(match.group(1))
            
            # Extract descriptions - simple line-based parsing
            segment_map = {'beginning': 'beginning', 'first half': 'first_half', 'interval': 'interval', 
                           'second half': 'second_half', 'climax': 'climax'}
            current_seg = None
            
            for line in response_text.split('\n'):
                line_clean = line.strip()
                line_lower = line_clean.lower()
                
                # Check for segment headers
                for key, seg_name in segment_map.items():
                    if key in line_lower and ('/10' in line_lower or 'description' in line_lower):
                        current_seg = seg_name
                        break
                
                # Extract description
                if current_seg and 'description:' in line_lower:
                    desc = line_clean.split(':', 1)[1].strip() if ':' in line_clean else ''
                    result['intensity_ratings'][current_seg]['description'] = desc
                    current_seg = None
                
                # Extract other sections
                if 'overall' in line_lower and 'arc' in line_lower:
                    result['overall_arc'] = line_clean.split(':', 1)[1].strip() if ':' in line_clean else ''
                elif 'peak moment' in line_lower:
                    result['peak_moments'] = line_clean.split(':', 1)[1].strip() if ':' in line_clean else ''
                elif 'pacing' in line_lower:
                    result['pacing_assessment'] = line_clean.split(':', 1)[1].strip() if ':' in line_clean else ''
        
        except Exception as e:
            print(f"Warning: Error during parsing: {e}")
            # Return partial results even if parsing fails
        
        return result
    
    def _fetch_movie_reviews(self, movie: Dict[str, Any]) -> list:
        """
        Fetch IMDb reviews for the movie and save to a temporary file
        Only works if movie has an imdb_id field
        
        Args:
            movie: Dictionary containing movie information with imdb_id
        
        Returns:
            List of review texts (empty if fetching fails)
        """
        title = movie.get('title', '')
        imdb_id = movie.get('imdb_id', '')
        
        if not title:
            print("No title provided for review fetching", file=sys.stderr)
            return []
        
        if not imdb_id:
            print(f"No IMDb ID available for '{title}', cannot fetch reviews", file=sys.stderr)
            return []
        
        # First, try to read from existing temp file
        temp_dir = Path(__file__).parent.parent / "temp"
        safe_title = "".join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in title)
        safe_title = '_'.join(safe_title.split()).lower()
        temp_file = temp_dir / f"{safe_title}_reviews.json"
        
        # Check if temp file already exists
        if temp_file.exists():
            try:
                with open(temp_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if 'reviews' in data:
                        reviews = [r['text'] for r in data['reviews']]
                        print(f"✓ Loaded {len(reviews)} reviews from cache: {temp_file}", file=sys.stderr)
                        return reviews
            except Exception as e:
                print(f"⚠ Could not read cached reviews: {e}", file=sys.stderr)
        
        # Fetch new reviews if not cached - use direct IMDb scraping with imdb_id
        try:
            print(f"\n🔍 Fetching reviews for '{title}' (IMDb ID: {imdb_id})...", file=sys.stderr)
            
            # Call the scraper function with IMDb ID directly
            reviews = self._scrape_imdb_reviews_by_id(imdb_id, title, temp_file)
            
            if reviews:
                print(f"✓ Fetched {len(reviews)} reviews for '{title}'", file=sys.stderr)
            else:
                print(f"⚠ No reviews found for '{title}'", file=sys.stderr)
            
            return reviews
        except Exception as e:
            print(f"⚠ Error fetching reviews for '{title}': {e}", file=sys.stderr)
            return []
    
    def _scrape_imdb_reviews_by_id(self, imdb_id: str, title: str, output_file: Path, min_reviews: int = 15, max_reviews: int = 35) -> list:
        """
        Scrape IMDb reviews directly using IMDb ID
        
        Args:
            imdb_id: IMDb ID (e.g., 'tt0068646')
            title: Movie title for output file
            output_file: Path to save JSON file
            min_reviews: Minimum reviews to fetch
            max_reviews: Maximum reviews to fetch
        
        Returns:
            List of review texts
        """
        try:
            print(f"DEBUG: Starting scrape for {imdb_id}", file=sys.stderr)
            
            from selenium import webdriver
            from selenium.webdriver.common.by import By
            from selenium.webdriver.chrome.service import Service
            from webdriver_manager.chrome import ChromeDriverManager
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC
            from selenium.common.exceptions import TimeoutException, NoSuchElementException
            import time
            
            print(f"DEBUG: Selenium imports successful", file=sys.stderr)
            
            # Setup Chrome in headless mode
            options = webdriver.ChromeOptions()
            options.page_load_strategy = "eager"
            options.add_argument("--headless")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--disable-gpu")
            options.add_argument("--window-size=1920,1080")
            options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            
            print(f"DEBUG: Starting Chrome driver...", file=sys.stderr)
            driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
            driver.set_page_load_timeout(45)
            wait = WebDriverWait(driver, 15)
            
            url = f"https://www.imdb.com/title/{imdb_id}/reviews/"
            print(f"DEBUG: Navigating to {url}", file=sys.stderr)
            driver.get(url)
            time.sleep(3)
            
            collected_reviews = []
            seen_texts = set()
            
            # Try to load reviews
            print(f"DEBUG: Waiting for review elements...", file=sys.stderr)
            try:
                wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, "article[class*='user-review-item'], div.review-container"))
                print(f"DEBUG: Review elements found", file=sys.stderr)
            except TimeoutException:
                print(f"DEBUG: Timeout waiting for reviews", file=sys.stderr)
                driver.quit()
                return []
            
            attempts = 0
            while len(collected_reviews) < max_reviews and attempts < 8:
                attempts += 1
                print(f"DEBUG: Scraping attempt {attempts}, collected so far: {len(collected_reviews)}", file=sys.stderr)
                
                review_articles = driver.find_elements(By.CSS_SELECTOR, "article[class*='user-review-item']")
                if not review_articles:
                    review_articles = driver.find_elements(By.CSS_SELECTOR, "div.review-container")
                
                print(f"DEBUG: Found {len(review_articles)} review elements", file=sys.stderr)
                
                for article in review_articles:
                    if len(collected_reviews) >= max_reviews:
                        break
                    
                    try:
                        # Skip spoilers
                        article.find_element(By.CSS_SELECTOR, 'div[data-testid="review-spoiler-content"]')
                        continue
                    except:
                        pass
                    
                    try:
                        review_text = None
                        try:
                            review_text = article.find_element(By.CSS_SELECTOR, "div.ipc-html-content-inner-div").text.strip()
                        except NoSuchElementException:
                            try:
                                review_text = article.find_element(By.CSS_SELECTOR, "div.text.show-more__control").text.strip()
                            except NoSuchElementException:
                                try:
                                    review_text = article.find_element(By.CSS_SELECTOR, "div.content").text.strip()
                                except:
                                    pass
                        
                        if review_text and review_text not in seen_texts and len(review_text) > 50:
                            seen_texts.add(review_text)
                            collected_reviews.append(review_text)
                            print(f"DEBUG: Collected review #{len(collected_reviews)}", file=sys.stderr)
                    except Exception as e:
                        print(f"DEBUG: Failed to extract review: {e}", file=sys.stderr)
                        continue
                
                # Try to load more
                if len(collected_reviews) < max_reviews:
                    try:
                        load_more = driver.find_element(By.CSS_SELECTOR, "button.ipc-see-more__button:not([aria-disabled='true'])")
                        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", load_more)
                        time.sleep(0.5)
                        driver.execute_script("arguments[0].click();", load_more)
                        print(f"DEBUG: Clicked load more button", file=sys.stderr)
                        time.sleep(2)
                    except Exception as e:
                        print(f"DEBUG: No more load button: {e}", file=sys.stderr)
                        break
            
            driver.quit()
            print(f"DEBUG: Scraping complete, total reviews: {len(collected_reviews)}", file=sys.stderr)
            
            if len(collected_reviews) == 0:
                print(f"WARNING: No reviews collected from {url}", file=sys.stderr)
                return []
            
            # Save to JSON
            reviews_data = {
                "title": title,
                "imdb_id": imdb_id,
                "total_reviews": len(collected_reviews),
                "reviews": [{"review_number": i + 1, "text": review} for i, review in enumerate(collected_reviews)]
            }
            
            output_file.parent.mkdir(parents=True, exist_ok=True)
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(reviews_data, f, indent=2, ensure_ascii=False)
            
            return collected_reviews
            
        except ImportError as e:
            print(f"⚠ Import error (Selenium not installed?): {e}", file=sys.stderr)
            return []
        except Exception as e:
            import traceback
            print(f"⚠ Scraping error: {e}", file=sys.stderr)
            print(f"⚠ Traceback: {traceback.format_exc()}", file=sys.stderr)
            return []

