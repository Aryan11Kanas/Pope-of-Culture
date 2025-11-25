# 🎬 Pope of Culture - Movie Recommendation & Analysis System

A full-stack movie recommendation platform that combines Next.js frontend with Python backend, featuring AI-powered sentiment analysis and personalized movie recommendations using collaborative filtering and content-based algorithms.

## ✨ Features

- **🎯 Personalized Recommendations**: Multiple recommendation algorithms including collaborative filtering, content-based, and hybrid approaches
- **📊 Sentiment Analysis**: AI-powered sentiment analysis of movie reviews using Google Gemini
- **📈 Visual Analytics**: Interactive charts and graphs for movie analysis and user behavior
- **🔍 Advanced Filtering**: Filter movies by genre, year, rating, and more
- **💬 Review Management**: Fetch and analyze reviews from various sources
## 🛠️ Tech Stack

### Frontend
- **Next.js 15** - React framework for production
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework

### Backend
- **Python 3.x** - Core backend language
- **FastAPI/Flask** - RESTful API framework
- **Pandas & NumPy** - Data processing and analysis
- **Google Gemini AI** - Advanced sentiment analysis


### Data & ML
- Collaborative Filtering (User-based & Item-based)
- Content-Based Filtering
- Hybrid Recommendation Systems

## 📁 Project Structure

```
recc/
├── app/                    # Next.js app directory
│   ├── (dashboard)/       # Dashboard routes and pages
│   ├── api/               # API routes
│   └── globals.css        # Global styles
├── components/            # React components
│   └── ui/               # Reusable UI components
├── data/                  # Datasets and data files
│   ├── raw/              # Raw datasets
│   └── processed/        # Processed data
├── movie/                 # Python movie analysis module
│   ├── gemini_analyzer.py # AI sentiment analysis
│   └── __init__.py
├── backend_api.py         # Python backend API
├── review_fetcher.py      # Review scraping utilities
├── requirements.txt       # Python dependencies
├── package.json          # Node.js dependencies
└── README.md             # Project documentation
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and npm/yarn
- **Python** 3.9+
- **Google Gemini API Key** (for sentiment analysis)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/pope-of-culture.git
   cd pope-of-culture
   ```

2. **Install frontend dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Create Python virtual environment:**
   ```bash
   python -m venv rec_env
   rec_env\Scripts\activate  # On Windows
   # source rec_env/bin/activate  # On Linux/Mac
   ```

4. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

5. **Set up environment variables:**
   
   Copy `.env.example` to `.env` and add your API keys:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add:
   ```
   GEMINI_API_KEY=your-gemini-api-key-here
   ```

6. **Prepare your data:**
   
   Place your movie datasets in the `data/` directory. The project supports various CSV formats including TMDB, IMDb, and custom datasets.

### Running the Application

1. **Start the Next.js development server:**
   ```bash
   npm run dev
   ```
   Visit [http://localhost:3000](http://localhost:3000)

2. **Start the Python backend:**
   ```bash
   python backend_api.py
   ```

## 📊 Recommendation Algorithms

### 1. Collaborative Filtering
- **User-based**: Recommends movies based on similar users' preferences
- **Item-based**: Suggests movies similar to those you've liked
- **Matrix Factorization**: Uses SVD and dimensionality reduction

### 2. Content-Based Filtering
- Uses movie features (genre, cast, director, plot)
- TF-IDF for text-based features
- Cosine similarity for recommendations

### 3. Hybrid Approaches
- Combines collaborative and content-based methods
- Weighted ensemble techniques
- Context-aware recommendations

## 🎯 Usage

### Dashboard
Access the main dashboard at `/dashboard` to view:
- Overall analytics and statistics
- User engagement metrics
- Popular movies and trends

### Recommendations
Navigate to `/recommendations` to:
- Get personalized movie suggestions
- Filter by genre, year, and rating
- View similar movies

### Sentiment Analysis
Visit `/sentiments` to:
- Analyze movie reviews
- View sentiment trends
- Compare sentiment across movies

### Analytics
Check `/analysis` for:
- Detailed movie analytics
- Visual data representations
- Performance metrics

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Movie data from TMDB, IMDb, and Kaggle datasets
- Google Gemini AI for sentiment analysis
- Open source community for excellent libraries

## 📧 Contact

For questions or feedback, please open an issue on GitHub.

---

Made with ❤️ by the Pope of Culture team


1. Start with `notebooks/01_data_exploration.ipynb` to understand your data
2. Use `notebooks/02_data_preprocessing.ipynb` for data cleaning and preparation
3. Explore different recommendation algorithms in subsequent notebooks
4. Use the modules in `src/` for production-ready implementations

## Evaluation Metrics

- **Accuracy**: RMSE, MAE
- **Ranking**: Precision@K, Recall@K, NDCG
- **Diversity**: Intra-list diversity, coverage
- **Novelty**: Recommendation novelty scores