import time
import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    TimeoutException,
    ElementClickInterceptedException,
    StaleElementReferenceException,
    NoSuchElementException,
)
import os


def collect_imdb_reviews_for_title(
    title: str,
    dataset_path: str = "tmdb_movies_since_1971.csv",
    output_file: str = None,
    min_reviews: int = 15,
    max_reviews: int = 35,
    headless: bool = True,
) -> list[str]:
    """Collect IMDb reviews for a movie title in the dataset.

    Args:
        title: Movie title to look up in the dataset (case-insensitive exact match).
        dataset_path: CSV path that must contain columns 'title' and 'imdb_id'.
        output_file: CSV file to write results to. If None, uses "{title}_reviews.csv".
        min_reviews: Soft minimum number of reviews to aim for.
        max_reviews: Maximum reviews to collect.
        headless: Run Chrome headless.

    Returns:
        List of collected review texts (trimmed to max_reviews). Also writes to output_file.
    """
    df = pd.read_csv(dataset_path)
    row = df[df["title"].str.lower() == title.lower()]
    if row.empty:
        print("❌ Movie not found in dataset!")
        return []

    imdb_id = row.iloc[0]["imdb_id"]
    print(f"Found IMDb ID: {imdb_id}")
    
    # Set default output file if not provided
    if output_file is None:
        # Create temp directory if it doesn't exist
        temp_dir = "temp"
        os.makedirs(temp_dir, exist_ok=True)
        
        # Create a clean filename from the title
        safe_title = "".join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in title)
        safe_title = '_'.join(safe_title.split()).lower()
        output_file = os.path.join(temp_dir, f"{safe_title}_reviews.json")

    # Setup Selenium
    options = webdriver.ChromeOptions()
    # Faster navigation; don't wait for all resources
    try:
        options.page_load_strategy = "eager"
    except Exception:
        pass
    if headless:
        options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/91.0.4472.124 Safari/537.36"
    )
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    # Reasonable timeouts
    try:
        driver.set_page_load_timeout(45)
        driver.set_script_timeout(30)
    except Exception:
        pass
    wait = WebDriverWait(driver, 12)

    url = f"https://www.imdb.com/title/{imdb_id}/reviews/?ref_=ttrt_ov_ql_2"
    try:
        driver.get(url)
    except Exception as e:
        # Occasionally page load stalls; continue to try extracting content
        print(f"Warning: navigation encountered an issue: {e}. Proceeding to locate reviews...")
    time.sleep(2)

    # Wait for initial reviews or containers to appear (new or legacy layout)
    try:
        wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, "article[class*='user-review-item'], div.review-container"))
    except TimeoutException:
        print("Timed out waiting for reviews to load. Page may be blocked or layout changed.")

    collected_reviews: list[str] = []
    seen_texts: set[str] = set()

    while len(collected_reviews) < max_reviews:
        # Prefer new layout articles; fallback to legacy containers
        review_articles = driver.find_elements(By.CSS_SELECTOR, "article[class*='user-review-item']")
        legacy_containers = []
        if not review_articles:
            legacy_containers = driver.find_elements(By.CSS_SELECTOR, "div.review-container")
            print(f"Found {len(legacy_containers)} legacy review containers")
        else:
            print(f"Found {len(review_articles)} review articles")

        elements_to_scan = review_articles if review_articles else legacy_containers

        for article in elements_to_scan:
            # Skip if spoiler div exists
            try:
                article.find_element(By.CSS_SELECTOR, 'div[data-testid="review-spoiler-content"]')
                print("Skipped spoiler review")
                continue
            except Exception:
                pass

            try:
                # Try new layout text element first, fallback to legacy text container
                try:
                    review_text = article.find_element(By.CSS_SELECTOR, "div.ipc-html-content-inner-div").text.strip()
                except NoSuchElementException:
                    review_text = article.find_element(By.CSS_SELECTOR, "div.text.show-more__control").text.strip()

                if review_text and review_text not in seen_texts:
                    seen_texts.add(review_text)
                    collected_reviews.append(review_text)
                    print(f"Collected review #{len(collected_reviews)}")
            except Exception as e:
                print(f"Failed to extract review text: ")
                continue

            if len(collected_reviews) >= max_reviews:
                break

        # Click "Load More" / "See all" button if available; else try scrolling
        if len(collected_reviews) < max_reviews:
            prev_count = len(
                driver.find_elements(
                    By.CSS_SELECTOR, "article[class*='user-review-item'], div.review-container"
                )
            )
            clicked = False
            try:
                # Prefer new button selector provided by user
                load_more = wait.until(
                    EC.element_to_be_clickable(
                        (By.CSS_SELECTOR, "button.ipc-see-more__button:not([aria-disabled='true'])")
                    )
                )
                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", load_more)
                time.sleep(0.3)
                try:
                    load_more.click()
                except (ElementClickInterceptedException, StaleElementReferenceException):
                    driver.execute_script("arguments[0].click();", load_more)
                clicked = True
                print("Clicked Load More (ipc-see-more__button)")
            except Exception as e1:
                try:
                    # Legacy button fallback
                    legacy_btn = wait.until(
                        EC.element_to_be_clickable((By.CSS_SELECTOR, "button.ipl-load-more__button"))
                    )
                    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", legacy_btn)
                    time.sleep(0.3)
                    try:
                        legacy_btn.click()
                    except (ElementClickInterceptedException, StaleElementReferenceException):
                        driver.execute_script("arguments[0].click();", legacy_btn)
                    clicked = True
                    print("Clicked Load More (ipl-load-more__button)")
                except Exception as e2:
                    print(f"No clickable Load More found (new: {e1}, legacy: {e2}). Trying scroll...")

            if clicked:
                try:
                    wait.until(
                        lambda d: len(
                            d.find_elements(
                                By.CSS_SELECTOR, "article[class*='user-review-item'], div.review-container"
                            )
                        )
                        > prev_count
                    )
                except TimeoutException:
                    print("No additional reviews loaded after click")
                time.sleep(1)
            else:
                # Fallback to infinite scroll
                driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(2)
                new_count = len(
                    driver.find_elements(
                        By.CSS_SELECTOR, "article[class*='user-review-item'], div.review-container"
                    )
                )
                if new_count <= prev_count:
                    print("No more content to load")
                    break
        else:
            break

    driver.quit()

    final_reviews = collected_reviews[:max_reviews]

    # Ensure the directory exists before saving
    os.makedirs(os.path.dirname(output_file) or ".", exist_ok=True)
    
    # Change file extension to .json if it's .csv
    if output_file.endswith('.csv'):
        output_file = output_file[:-4] + '.json'
    
    # Save to JSON format
    import json
    reviews_data = {
        "title": title,
        "imdb_id": imdb_id,
        "total_reviews": len(final_reviews),
        "reviews": [
            {
                "review_number": i + 1,
                "text": review
            }
            for i, review in enumerate(final_reviews)
        ]
    }
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(reviews_data, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Saved {len(final_reviews)} reviews to: {output_file}")

    if len(final_reviews) < min_reviews:
        print(f"⚠ Only {len(final_reviews)} reviews collected (min desired {min_reviews}).")

    return final_reviews


if __name__ == "__main__":
    print("=" * 60)
    print("IMDb Review Fetcher")
    print("=" * 60)
    
    # Ask for movie title
    title = input("\nEnter movie title: ").strip()
    
    if not title:
        print("❌ No title entered. Exiting.")
        exit(1)
    
    print(f"\n🔍 Looking up '{title}' in database...")
    
    # Look up the movie in the database first
    try:
        df = pd.read_csv("tmdb_movies_since_1971.csv")
        row = df[df["title"].str.lower() == title.lower()]
        
        if row.empty:
            print(f"❌ Movie '{title}' not found in database!")
            print("\nTip: Make sure the title matches exactly as it appears in the database.")
            exit(1)
        
        imdb_id = row.iloc[0]["imdb_id"]
        actual_title = row.iloc[0]["title"]
        
        print(f"✓ Found: {actual_title}")
        print(f"✓ IMDb ID: {imdb_id}")
        print(f"\n🌐 Starting to scrape reviews from IMDb...")
        
    except FileNotFoundError:
        print("❌ Database file 'tmdb_movies_since_1971.csv' not found!")
        exit(1)
    except Exception as e:
        print(f"❌ Error reading database: {e}")
        exit(1)
    
    # Now scrape the reviews
    try:
        reviews = collect_imdb_reviews_for_title(title)
        
        if reviews:
            print(f"\n{'=' * 60}")
            print(f"✓ Successfully collected {len(reviews)} reviews!")
            print(f"{'=' * 60}")
        else:
            print("\n⚠ No reviews were collected.")
            
    except KeyboardInterrupt:
        print("\n\n⚠ Scraping interrupted by user.")
        exit(1)
    except Exception as e:
        print(f"\n❌ Error during scraping: {e}")
        exit(1)
