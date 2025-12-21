"""
Configuration for StandVirtual scraper
"""
import os
from pathlib import Path

# API Configuration
GRAPHQL_ENDPOINT = "https://www.standvirtual.com/graphql"
PERSISTED_QUERY_HASH = "e78bd5939b000e39e9f2ca157b3068e014d4036b7e4af4c05086dd2c185f7a93"

# Pagination
PAGE_SIZE = 32
MAX_PAGES = 1400  # Safety limit (~44,800 listings max)

# Rate Limiting
# No rate limiting detected - bottleneck is server response time (~0.6s)
# Using minimal delay for safety margin
REQUESTS_PER_MINUTE = 100  # ~100 req/min max throughput
MIN_DELAY_SECONDS = 0.1    # Minimal delay for safety
MAX_DELAY_SECONDS = 0.3
MAX_RETRIES = 5
RETRY_BACKOFF_MULTIPLIER = 2.0

# Paths
SCRAPER_DIR = Path(__file__).parent
DATA_DIR = SCRAPER_DIR / "data"
DATABASE_PATH = DATA_DIR / "listings.db"
CHECKPOINT_PATH = DATA_DIR / "checkpoint.json"

# Ensure data directory exists
DATA_DIR.mkdir(exist_ok=True)

# Turso configuration (for production)
TURSO_DATABASE_URL = os.environ.get("TURSO_DATABASE_URL")
TURSO_AUTH_TOKEN = os.environ.get("TURSO_AUTH_TOKEN")
USE_TURSO = bool(TURSO_DATABASE_URL and TURSO_AUTH_TOKEN)

# Request Headers (mimic browser)
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
    "Content-Type": "application/json",
    "Origin": "https://www.standvirtual.com",
    "Referer": "https://www.standvirtual.com/carros",
}

# GraphQL Query Variables Template
def get_query_variables(page: int) -> dict:
    """Generate GraphQL variables for a specific page"""
    return {
        "page": page,
        "filters": [{"name": "category_id", "value": "29"}],  # Cars category
        "parameters": [
            "make",
            "model",
            "version",
            "fuel_type",
            "gearbox",
            "mileage",
            "engine_capacity",
            "engine_power",
            "first_registration_year"
        ],
        "includePriceEvaluation": True,
        "includeFilters": False,
        "includeFiltersCounters": False,
        "includeSuggestedFilters": False,
        "includeNewSearch": False,
        "includeSortOptions": False,
        "includeRatings": False,
        "includePromotedAds": False,
        "includeNewPromotedAds": False,
        "includeClick2Buy": False,
        "includeTopAds": False,
        "includeCepik": False,
        "promotedInput": {
            "filter": []
        },
    }

# GraphQL Request Body Template
def get_request_body(page: int) -> dict:
    """Generate full GraphQL request body for a page"""
    return {
        "operationName": "listingScreen",
        "variables": get_query_variables(page),
        "extensions": {
            "persistedQuery": {
                "sha256Hash": PERSISTED_QUERY_HASH,
                "version": 1
            }
        }
    }
