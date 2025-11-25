# Recommendation System Project

This project implements various recommendation algorithms using Kaggle data to provide personalized recommendations.

## Project Structure

```
recc/
├── data/                   # Raw and processed data files
├── notebooks/             # Jupyter notebooks for exploration and experiments
├── src/                   # Source code for recommendation algorithms
├── models/                # Trained models and saved artifacts
├── requirements.txt       # Python dependencies
└── README.md             # Project documentation
```

## Setup Instructions

1. **Create virtual environment:**
   ```bash
   python -m venv rec_env
   rec_env\Scripts\activate  # On Windows
   # source rec_env/bin/activate  # On Linux/Mac
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Place your Kaggle data in the `data/` directory**

## Recommendation Approaches

### 1. Collaborative Filtering
- **User-based**: Recommends items based on similar users' preferences
- **Item-based**: Recommends items similar to those the user has liked
- **Matrix Factorization**: Uses SVD, NMF, or other techniques

### 2. Content-Based Filtering
- Uses item features to recommend similar items
- Implements TF-IDF for text-based features
- Profile-based recommendations

### 3. Hybrid Approaches
- Combines collaborative and content-based methods
- Weighted hybrid systems
- Meta-learning approaches

## Getting Started

1. Start with `notebooks/01_data_exploration.ipynb` to understand your data
2. Use `notebooks/02_data_preprocessing.ipynb` for data cleaning and preparation
3. Explore different recommendation algorithms in subsequent notebooks
4. Use the modules in `src/` for production-ready implementations

## Evaluation Metrics

- **Accuracy**: RMSE, MAE
- **Ranking**: Precision@K, Recall@K, NDCG
- **Diversity**: Intra-list diversity, coverage
- **Novelty**: Recommendation novelty scores