"""
Async GraphQL client for parallel StandVirtual API requests
"""
import asyncio
import aiohttp
import logging
from typing import Optional

from config import (
    GRAPHQL_ENDPOINT,
    HEADERS,
    MAX_RETRIES,
    get_request_body,
)

logger = logging.getLogger(__name__)

# Concurrency settings
CONCURRENT_REQUESTS = 10  # Tested safe at this level
BATCH_SIZE = 50  # Process in batches to manage memory


class AsyncGraphQLClient:
    """Async client for parallel StandVirtual API requests"""

    def __init__(self, concurrency: int = CONCURRENT_REQUESTS):
        self.concurrency = concurrency
        self.session: Optional[aiohttp.ClientSession] = None
        self._semaphore: Optional[asyncio.Semaphore] = None

    async def __aenter__(self):
        connector = aiohttp.TCPConnector(limit=self.concurrency)
        self.session = aiohttp.ClientSession(
            headers=HEADERS,
            connector=connector,
            timeout=aiohttp.ClientTimeout(total=30)
        )
        self._semaphore = asyncio.Semaphore(self.concurrency)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def fetch_page(self, page: int, retries: int = MAX_RETRIES) -> dict:
        """
        Fetch a single page with retry logic.

        Returns:
            Dict with 'page', 'data' or 'error' keys
        """
        async with self._semaphore:
            for attempt in range(retries):
                try:
                    async with self.session.post(
                        GRAPHQL_ENDPOINT,
                        json=get_request_body(page)
                    ) as response:
                        if response.status == 429:
                            # Rate limited - wait and retry
                            wait_time = 2 ** attempt
                            logger.warning(f"Rate limited on page {page}, waiting {wait_time}s")
                            await asyncio.sleep(wait_time)
                            continue

                        if response.status != 200:
                            logger.error(f"HTTP {response.status} on page {page}")
                            return {"page": page, "error": f"HTTP {response.status}"}

                        data = await response.json()

                        if "errors" in data:
                            error_msg = data["errors"][0].get("message", "Unknown")
                            logger.error(f"GraphQL error on page {page}: {error_msg}")
                            return {"page": page, "error": error_msg}

                        return {"page": page, "data": data}

                except asyncio.TimeoutError:
                    logger.warning(f"Timeout on page {page}, attempt {attempt + 1}")
                    await asyncio.sleep(1)
                except Exception as e:
                    logger.error(f"Error on page {page}: {e}")
                    return {"page": page, "error": str(e)}

            return {"page": page, "error": "Max retries exceeded"}

    async def fetch_pages(self, pages: list[int], progress_callback=None) -> list[dict]:
        """
        Fetch multiple pages in parallel.

        Args:
            pages: List of page numbers to fetch
            progress_callback: Optional callback(completed, total) for progress updates

        Returns:
            List of results, each with 'page' and 'data' or 'error'
        """
        results = []
        total = len(pages)
        completed = 0

        # Process in batches to manage memory
        for i in range(0, total, BATCH_SIZE):
            batch = pages[i:i + BATCH_SIZE]
            tasks = [self.fetch_page(page) for page in batch]
            batch_results = await asyncio.gather(*tasks)
            results.extend(batch_results)

            completed += len(batch)
            if progress_callback:
                progress_callback(completed, total)

        return results

    def extract_listings(self, response: dict) -> list[dict]:
        """Extract listing data from API response."""
        try:
            edges = response["data"]["advertSearch"]["edges"]
        except (KeyError, TypeError):
            logger.error("Unexpected response structure")
            return []

        listings = []
        for edge in edges:
            node = edge.get("node", {})
            if not node:
                continue

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

            # Extract badges (can be list of strings or objects)
            badges = node.get("badges", [])
            if badges and isinstance(badges[0], str):
                badges_list = badges
            else:
                badges_list = [b.get("type") for b in badges if b and b.get("type")] if badges else []

            # Extract parameters
            params = {p["key"]: p["value"] for p in node.get("parameters", []) if p.get("key")}

            # Parse createdAt timestamp from API
            created_at_str = node.get("createdAt")
            listing_date = None
            if created_at_str:
                try:
                    from datetime import datetime
                    # Parse ISO format: "2025-12-12T22:50:46Z"
                    dt = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
                    listing_date = int(dt.timestamp())
                except (ValueError, AttributeError):
                    pass

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
                "listing_date": listing_date,
            }
        except Exception as e:
            logger.error(f"Error parsing listing: {e}")
            return None

    def get_total_pages(self, response: dict) -> int:
        """Extract total page count from response"""
        try:
            total_count = response["data"]["advertSearch"]["totalCount"]
            from config import PAGE_SIZE
            return (total_count + PAGE_SIZE - 1) // PAGE_SIZE
        except (KeyError, TypeError):
            logger.error("Could not extract total count")
            return 0
