"""
GraphQL client for StandVirtual API
"""
import requests
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)
from typing import Optional
import logging

from config import (
    GRAPHQL_ENDPOINT,
    HEADERS,
    MAX_RETRIES,
    RETRY_BACKOFF_MULTIPLIER,
    get_request_body,
)

logger = logging.getLogger(__name__)


class RateLimitError(Exception):
    """Raised when API returns 429 rate limit"""
    pass


class GraphQLClient:
    """Client for StandVirtual GraphQL API"""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=RETRY_BACKOFF_MULTIPLIER, min=4, max=60),
        retry=retry_if_exception_type((requests.RequestException, RateLimitError)),
        before_sleep=lambda retry_state: logger.warning(
            f"Retry attempt {retry_state.attempt_number} after error"
        )
    )
    def fetch_page(self, page: int) -> dict:
        """
        Fetch a single page of listings from the API.

        Args:
            page: Page number (1-indexed)

        Returns:
            Parsed JSON response

        Raises:
            RateLimitError: If rate limited (429)
            requests.RequestException: For other HTTP errors
        """
        body = get_request_body(page)

        response = self.session.post(
            GRAPHQL_ENDPOINT,
            json=body,
            timeout=30
        )

        if response.status_code == 429:
            logger.warning(f"Rate limited on page {page}")
            raise RateLimitError("Rate limited by API")

        response.raise_for_status()

        data = response.json()

        # Check for GraphQL errors
        if "errors" in data:
            error_msg = data["errors"][0].get("message", "Unknown GraphQL error")
            logger.error(f"GraphQL error: {error_msg}")
            raise requests.RequestException(f"GraphQL error: {error_msg}")

        return data

    def extract_listings(self, response: dict) -> list[dict]:
        """
        Extract listing data from API response.

        Args:
            response: Raw API response

        Returns:
            List of parsed listing dictionaries
        """
        try:
            ads = response["data"]["listingScreen"]["ads"]["edges"]
        except (KeyError, TypeError):
            logger.error("Unexpected response structure")
            return []

        listings = []

        for edge in ads:
            node = edge.get("node", {})
            if not node:
                continue

            # Parse listing data
            listing = self._parse_listing(node)
            if listing:
                listings.append(listing)

        return listings

    def _parse_listing(self, node: dict) -> Optional[dict]:
        """Parse a single listing node into our schema format"""
        try:
            # Extract price
            price_data = node.get("price", {})
            price_amount = price_data.get("amount", {})
            price = price_amount.get("units", 0)

            # Extract price evaluation
            price_eval = node.get("priceEvaluation", {})
            price_evaluation = price_eval.get("indicator") if price_eval else None

            # Extract location
            location = node.get("location", {})
            city = location.get("city", {}).get("name") if location.get("city") else None
            region = location.get("region", {}).get("name") if location.get("region") else None

            # Extract seller info
            seller_link = node.get("sellerLink", {})
            seller_name = seller_link.get("name") if seller_link else None
            seller_type = node.get("sellerType")

            # Extract thumbnail
            thumbnail = node.get("thumbnail", {})
            thumbnail_url = thumbnail.get("x1") if thumbnail else None

            # Extract badges
            badges = node.get("badges", [])
            badges_list = [b.get("type") for b in badges if b.get("type")] if badges else []

            # Extract parameters
            params = {p["key"]: p["value"] for p in node.get("parameters", []) if p.get("key")}

            return {
                "id": str(node.get("id")),
                "title": node.get("title", ""),
                "url": node.get("url", ""),
                "price": price,
                "price_evaluation": price_evaluation,
                "make": params.get("make", ""),
                "model": params.get("model", ""),
                "version": params.get("version"),
                "year": int(params.get("first_registration_year", 0)) if params.get("first_registration_year") else None,
                "mileage": int(params.get("mileage", 0)) if params.get("mileage") else None,
                "fuel_type": params.get("fuel_type"),
                "gearbox": params.get("gearbox"),
                "engine_capacity": int(params.get("engine_capacity", 0)) if params.get("engine_capacity") else None,
                "engine_power": int(params.get("engine_power", 0)) if params.get("engine_power") else None,
                "city": city,
                "region": region,
                "seller_name": seller_name,
                "seller_type": seller_type,
                "thumbnail_url": thumbnail_url,
                "badges": badges_list,
            }
        except Exception as e:
            logger.error(f"Error parsing listing: {e}")
            return None

    def get_total_pages(self, response: dict) -> int:
        """Extract total page count from response"""
        try:
            total_count = response["data"]["listingScreen"]["ads"]["totalCount"]
            from config import PAGE_SIZE
            return (total_count + PAGE_SIZE - 1) // PAGE_SIZE
        except (KeyError, TypeError):
            logger.error("Could not extract total count")
            return 0

    def close(self):
        """Close the session"""
        self.session.close()
