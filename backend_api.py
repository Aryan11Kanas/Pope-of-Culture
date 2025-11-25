"""
Original Movie Recommendation API
This file was part of the project before line-count simplification attempts.
It provides complete dataset loading, merging, simple filtering, and a small sample interaction generator.
"""

import os
import time
import re
import pickle
from typing import List, Dict, Any

import pandas as pd
import numpy as np


def safe_float(v, default: float = 0.0) -> float:
    try:
        x = float(v)
        return default if pd.isna(x) or x != x else x
    except Exception:
        return default


def safe_int(v, default: int = 0) -> int:
    try:
        return int(float(v))
    except Exception:
        return default


def parse_votes(v):
    try:
        return int(str(v).replace(',', ''))
    except Exception:
        return 0


def map_language(lang):
    if pd.isna(lang):
        return 'unknown'
    s = str(lang).lower()
    if 'hindi' in s or 'bollywood' in s:
        return 'hi'
    if 'english' in s:
        return 'en'
    return 'unknown'


class MovieRecommendationAPI:
    def __init__(self, data_path: str = 'data/archive/TMDB_movie_dataset_v11.csv', fetch_posters: bool = False):
        self.data_path = data_path
        self.fetch_posters = fetch_posters
        self.movies_df = pd.DataFrame()
        self.interactions_df = pd.DataFrame()
        self.is_loaded = False
        self.cache_file = 'data/processed_movies_cache.pkl'
        self.load_data()

    def load_data(self):
        if self.load_from_cache():
            return
        tmdb = self.load_tmdb_data()
        indian = self.load_indian_movies_data()
        imdb = self.load_imdb_top1000_data()
        self.movies_df = self.combine_datasets(tmdb, indian, imdb)

        if not self.movies_df.empty:
            self.movies_df['vote_average'] = pd.to_numeric(self.movies_df.get('vote_average', 0), errors='coerce').fillna(0.0)
            self.movies_df['vote_count'] = pd.to_numeric(self.movies_df.get('vote_count', 0), errors='coerce').fillna(0).astype(int)
            if 'release_date' in self.movies_df.columns:
                self.movies_df['release_year'] = pd.to_datetime(self.movies_df['release_date'], errors='coerce').dt.year.fillna(0).astype(int)

        if not self.movies_df.empty:
            self.movies_df = self.movies_df[
                (self.movies_df['vote_average'] >= 6.0) &
                (self.movies_df['vote_count'] >= 2000) &
                (self.movies_df.get('release_year', 0) >= 1970)
            ]
            if 'original_language' in self.movies_df.columns:
                self.movies_df = self.movies_df[self.movies_df['original_language'].isin(['en', 'hi'])]

        self.create_sample_interactions()
        self.save_to_cache()
        self.is_loaded = True

    def load_tmdb_data(self):
        if not os.path.exists(self.data_path):
            return pd.DataFrame()
        chunks = []
        for chunk in pd.read_csv(self.data_path, chunksize=100000):
            if 'vote_average' in chunk.columns and 'vote_count' in chunk.columns:
                chunk = chunk[(pd.to_numeric(chunk['vote_average'], errors='coerce').fillna(0) >= 6.0) &
                              (pd.to_numeric(chunk['vote_count'], errors='coerce').fillna(0).astype(int) >= 2000)]
            chunks.append(chunk)
        if not chunks:
            return pd.DataFrame()
        df = pd.concat(chunks, ignore_index=True, sort=False)
        if 'imdb_id' not in df.columns:
            df['imdb_id'] = ''
        df['source'] = 'tmdb'
        return df

    def load_indian_movies_data(self):
        path = 'data/indian movies.csv'
        if not os.path.exists(path):
            return pd.DataFrame()
        df = pd.read_csv(path)
        out = pd.DataFrame()
        out['id'] = df.get('ID', pd.Series(dtype=str)).apply(lambda x: f"indian_{x}" if pd.notna(x) else f"indian_{hash(str(x))}")
        out['title'] = df.get('Movie Name', '')
        out['imdb_id'] = df.get('ID', '')
        out['vote_average'] = pd.to_numeric(df.get('Rating(10)', 0).replace('-', np.nan), errors='coerce').fillna(0.0)
        out['vote_count'] = df.get('Votes', '').apply(parse_votes)
        out['release_year'] = pd.to_numeric(df.get('Year', 2000), errors='coerce').fillna(2000).astype(int)
        out['release_date'] = out['release_year'].astype(str) + '-01-01'
        out['original_language'] = df.get('Language', '').apply(map_language)
        out['genres'] = df.get('Genre', '').fillna('Unknown')
        out['overview'] = ''
        out['poster_path'] = ''
        out['source'] = 'indian_movies'
        return out

    def load_imdb_top1000_data(self):
        path = 'data/imdb_top_1000.csv'
        if not os.path.exists(path):
            return pd.DataFrame()
        df = pd.read_csv(path)
        out = pd.DataFrame()
        out['id'] = df.index.map(lambda x: f"imdb_{x}")
        out['title'] = df.get('Series_Title', '')
        out['imdb_id'] = ''
        out['vote_average'] = pd.to_numeric(df.get('IMDB_Rating', 0), errors='coerce').fillna(0.0)
        out['vote_count'] = df.get('No_of_Votes', '').apply(parse_votes)
        out['release_year'] = pd.to_numeric(df.get('Released_Year', 2000), errors='coerce').fillna(2000).astype(int)
        out['release_date'] = out['release_year'].astype(str) + '-01-01'
        out['original_language'] = 'en'
        out['genres'] = df.get('Genre', '')
        out['overview'] = df.get('Overview', '')
        out['poster_path'] = df.get('Poster_Link', '')
        out['source'] = 'imdb_top1000'
        return out

    def combine_datasets(self, *dfs):
        parts = [d for d in dfs if isinstance(d, pd.DataFrame) and not d.empty]
        if not parts:
            return pd.DataFrame()
        combined = pd.concat(parts, ignore_index=True, sort=False)

        roman_map = {'ii':'2','iii':'3','iv':'4','v':'5','vi':'6','vii':'7','viii':'8','ix':'9','x':'10'}

        def normalize_title(s):
            s = str(s or '').lower()
            s = re.sub(r'[^a-z0-9 ]', ' ', s)
            s = re.sub(r'\b(' + '|'.join(roman_map.keys()) + r')\b', lambda m: roman_map[m.group(1)], s)
            return re.sub(r'\s+', ' ', s).strip()

        combined['norm_title'] = combined.get('title', '').apply(normalize_title)
        combined['imdb_id'] = combined.get('imdb_id', '').fillna('').astype(str).str.strip()
        combined['group_key'] = combined['imdb_id'].mask(combined.get('imdb_id', '') == '', combined['norm_title'])

        combined['vote_average'] = pd.to_numeric(combined.get('vote_average', 0), errors='coerce').fillna(0.0)
        combined['vote_count'] = pd.to_numeric(combined.get('vote_count', 0), errors='coerce').fillna(0).astype(int)
        combined['release_year'] = pd.to_numeric(combined.get('release_year', 0), errors='coerce').fillna(0).astype(int)

        agg_map = {
            'vote_average': 'mean',
            'vote_count': 'sum',
            'id': 'first',
            'title': 'first',
            'imdb_id': 'first',
            'poster_path': 'first',
            'overview': 'first',
            'genres': 'first',
            'original_language': 'first',
            'release_date': 'first',
            'source': lambda s: ','.join(sorted(set(s.dropna())))
        }
        grouped = combined.groupby(['group_key', 'release_year'], sort=False).agg(agg_map).reset_index(drop=True)
        grouped['vote_average'] = grouped['vote_average'].astype(float)
        grouped['vote_count'] = grouped['vote_count'].astype(int)
        return grouped

    def fetch_imdb_poster(self, imdb_id: str) -> str:
        return ''

    def enhance_posters(self, limit: int = 50):
        return

    def load_from_cache(self) -> bool:
        if not os.path.exists(self.cache_file):
            return False
        age = time.time() - os.path.getmtime(self.cache_file)
        if age > 24 * 3600:
            return False
        try:
            with open(self.cache_file, 'rb') as f:
                data = pickle.load(f)
            self.movies_df = data.get('movies_df', pd.DataFrame())
            self.interactions_df = data.get('interactions_df', pd.DataFrame())
            self.is_loaded = True
            return True
        except Exception:
            return False

    def save_to_cache(self):
        try:
            os.makedirs(os.path.dirname(self.cache_file) or '.', exist_ok=True)
            with open(self.cache_file, 'wb') as f:
                pickle.dump({'movies_df': self.movies_df, 'interactions_df': self.interactions_df}, f)
        except Exception:
            pass

    def create_sample_interactions(self):
        if self.movies_df.empty:
            self.interactions_df = pd.DataFrame()
            return
        np.random.seed(42)
        n_users = 500
        sample_pool = self.movies_df.nlargest(min(3000, len(self.movies_df)), 'vote_count') if 'vote_count' in self.movies_df.columns else self.movies_df
        n_interactions = 12000
        user_ids = np.random.randint(1, n_users + 1, n_interactions)
        movie_indices = np.random.choice(sample_pool.index, n_interactions)
        def pick_rating(avg):
            return (np.random.choice([4,5], p=[0.3,0.7]) if avg>=8 else
                    np.random.choice([3,4,5], p=[0.2,0.4,0.4]) if avg>=7 else
                    np.random.choice([1,2,3,4,5], p=[0.1,0.1,0.2,0.3,0.3]))
        ratings = [pick_rating(safe_float(self.movies_df.loc[idx,'vote_average']) if 'vote_average' in self.movies_df.columns else 3.0) for idx in movie_indices]
        self.interactions_df = pd.DataFrame({'user_id': user_ids, 'movie_id': movie_indices, 'rating': ratings}).drop_duplicates(['user_id','movie_id'])

    def get_recommendations(self, genre: str, language: str, excluded_ids: List[Any] = None, limit: int = 1) -> Dict[str, Any]:
        if not self.is_loaded:
            return {"error": "not loaded", "recommendations": []}
        excluded_ids = set(excluded_ids or [])

        df = self.movies_df.loc[~self.movies_df.index.isin(excluded_ids)].copy()
        df = df[(df['vote_average'] >= 6.0) & (df['original_language'] == language)]
        if 'genres' in df.columns and genre:
            df = df[df['genres'].str.contains(genre, case=False, na=False)]

        df['vote_average'] = pd.to_numeric(df.get('vote_average', 0), errors='coerce').fillna(0.0)
        df['vote_count'] = pd.to_numeric(df.get('vote_count', 0), errors='coerce').fillna(0).astype(int)
        df = df.sort_values(['vote_average', 'vote_count'], ascending=[False, False])

        excluded_titles = set()
        if excluded_ids:
            existing = self.movies_df.loc[self.movies_df.index.isin(excluded_ids), 'title'].dropna().str.lower()
            excluded_titles = set(existing.tolist())

        movies = []
        seen = set()
        for idx, m in df.iterrows():
            title_norm = str(m.get('title', '')).strip().lower()
            if not title_norm or title_norm in seen or title_norm in excluded_titles:
                continue
            avg = safe_float(m.get('vote_average', 0))
            movies.append({
                'id': int(idx),
                'title': str(m.get('title', 'Unknown')),
                'vote_average': avg,
                'vote_count': safe_int(m.get('vote_count', 0)),
                'release_date': str(m.get('release_date', '')),
                'overview': str(m.get('overview', '')),
                'genres': str(m.get('genres', '')),
                'original_language': str(m.get('original_language', language)),
                'poster_path': str(m.get('poster_path', '')),
            })
            seen.add(title_norm)
            if len(movies) >= limit:
                break
        return {'success': True, 'recommendations': movies, 'total': len(movies), 'filters': {'genre': genre, 'language': language}}

    def get_genres(self) -> List[str]:
        if self.movies_df.empty or 'genres' not in self.movies_df.columns:
            return []
        genres = {g.strip() for s in self.movies_df['genres'].dropna() for g in str(s).split(',')}
        return sorted(genres)

    def get_languages(self) -> List[Dict[str, str]]:
        return [{'code': 'en', 'name': 'English'}, {'code': 'hi', 'name': 'Hindi'}]


# global instance
api_instance = None


def get_api_instance(fetch_posters=False, force_reload=False):
    global api_instance
    if api_instance is None or force_reload:
        api_instance = MovieRecommendationAPI(fetch_posters=fetch_posters)
    return api_instance


def main():
    api = get_api_instance()
    if api.is_loaded:
        res = api.get_recommendations('Action', 'en', limit=1)
        if res.get('success'):
            for m in res['recommendations']:
                print(f"{m['title']} — {m['vote_average']}/10 ({m['vote_count']} votes)")
        else:
            print('No recommendations')
    else:
        print('API not ready')


if __name__ == '__main__':
    main()