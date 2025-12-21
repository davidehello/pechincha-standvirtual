"""
StandVirtual Car Listings Scraper

Main entry point for scraping car listings from StandVirtual.com
"""
import sys
import time
import logging
import argparse
from typing import Optional

from config import MAX_PAGES
from client import GraphQLClient, RateLimitError
from rate_limiter import AdaptiveRateLimiter
from checkpoint import CheckpointManager, Checkpoint
from storage import Storage

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ]
)
logger = logging.getLogger(__name__)


class Scraper:
    """Main scraper orchestrator"""

    def __init__(self, max_pages: Optional[int] = None):
        self.client = GraphQLClient()
        self.rate_limiter = AdaptiveRateLimiter()
        self.checkpoint_manager = CheckpointManager()
        self.storage = Storage()
        self.max_pages = max_pages or MAX_PAGES

    def run(self, resume: bool = True) -> dict:
        """
        Run the scraper.

        Args:
            resume: Whether to resume from checkpoint

        Returns:
            Summary statistics
        """
        logger.info("Starting StandVirtual scraper...")

        # Check for existing checkpoint
        checkpoint: Optional[Checkpoint] = None
        if resume:
            checkpoint = self.checkpoint_manager.load()

        # Create scrape run record
        run_id = self.storage.create_scrape_run()
        scrape_start_time = int(time.time())

        try:
            # Get total pages from first request
            self.rate_limiter.wait()
            first_response = self.client.fetch_page(1)
            total_pages = min(self.client.get_total_pages(first_response), self.max_pages)

            if checkpoint and checkpoint.total_pages > 0:
                # Use checkpoint's total pages if resuming
                start_page = checkpoint.last_page + 1
                logger.info(f"Resuming from page {start_page}/{total_pages}")
            else:
                start_page = 1
                checkpoint = self.checkpoint_manager.create_initial(total_pages)
                logger.info(f"Starting fresh scrape: {total_pages} pages to process")

            # Process first page
            listings = self.client.extract_listings(first_response)
            new_count, updated_count = self.storage.upsert_listings(listings)
            checkpoint = self.checkpoint_manager.update(
                checkpoint,
                page=1,
                found_listings=len(listings),
                new_listings=new_count,
                updated_listings=updated_count,
            )
            self.rate_limiter.on_success()

            logger.info(f"Page 1/{total_pages}: {len(listings)} listings ({new_count} new, {updated_count} updated)")

            # Process remaining pages
            for page in range(max(2, start_page), total_pages + 1):
                try:
                    self.rate_limiter.wait()
                    response = self.client.fetch_page(page)
                    listings = self.client.extract_listings(response)

                    if not listings:
                        logger.warning(f"Page {page}: No listings found, may have reached end")
                        break

                    new_count, updated_count = self.storage.upsert_listings(listings)
                    checkpoint = self.checkpoint_manager.update(
                        checkpoint,
                        page=page,
                        found_listings=len(listings),
                        new_listings=new_count,
                        updated_listings=updated_count,
                    )
                    self.rate_limiter.on_success()

                    # Update scrape run
                    self.storage.update_scrape_run(
                        run_id,
                        pages_scraped=page,
                        listings_found=checkpoint.listings_found,
                        listings_new=checkpoint.listings_new,
                        listings_updated=checkpoint.listings_updated,
                    )

                    # Progress logging every 10 pages
                    if page % 10 == 0:
                        stats = self.rate_limiter.get_stats()
                        logger.info(
                            f"Page {page}/{total_pages}: "
                            f"{checkpoint.listings_found} total, "
                            f"{checkpoint.listings_new} new, "
                            f"{checkpoint.listings_updated} updated "
                            f"(delay: {stats['current_delay']:.1f}s)"
                        )

                except RateLimitError:
                    self.rate_limiter.on_rate_limit()
                    logger.warning(f"Rate limited on page {page}, backing off...")
                    continue  # Retry same page

                except Exception as e:
                    self.rate_limiter.on_error()
                    logger.error(f"Error on page {page}: {e}")
                    # Continue to next page
                    continue

            # Mark listings not seen in this run as inactive
            self.storage.mark_inactive_not_seen_since(scrape_start_time)

            # Mark checkpoint as completed
            checkpoint = self.checkpoint_manager.mark_completed(checkpoint)
            self.storage.complete_scrape_run(run_id)

            # Final stats
            stats = self.storage.get_stats()
            logger.info("=" * 50)
            logger.info("Scrape completed successfully!")
            logger.info(f"  Pages scraped: {checkpoint.last_page}")
            logger.info(f"  Listings found: {checkpoint.listings_found}")
            logger.info(f"  New listings: {checkpoint.listings_new}")
            logger.info(f"  Updated listings: {checkpoint.listings_updated}")
            logger.info(f"  Total in database: {stats['total_listings']}")
            logger.info(f"  Active listings: {stats['active_listings']}")
            logger.info(f"  Below market: {stats['below_market_count']}")
            logger.info("=" * 50)

            return {
                "status": "completed",
                "pages_scraped": checkpoint.last_page,
                "listings_found": checkpoint.listings_found,
                "listings_new": checkpoint.listings_new,
                "listings_updated": checkpoint.listings_updated,
                **stats,
            }

        except KeyboardInterrupt:
            logger.warning("Scrape interrupted by user")
            if checkpoint:
                self.checkpoint_manager.save(checkpoint)
            self.storage.complete_scrape_run(run_id, status="interrupted")
            return {"status": "interrupted"}

        except Exception as e:
            logger.error(f"Scrape failed: {e}")
            if checkpoint:
                self.checkpoint_manager.mark_failed(checkpoint, str(e))
            self.storage.complete_scrape_run(run_id, status="failed", error=str(e))
            raise

        finally:
            self.client.close()


def main():
    """CLI entry point"""
    parser = argparse.ArgumentParser(description="StandVirtual Car Listings Scraper")
    parser.add_argument(
        "--max-pages",
        type=int,
        default=None,
        help="Maximum pages to scrape (default: no limit)"
    )
    parser.add_argument(
        "--no-resume",
        action="store_true",
        help="Don't resume from checkpoint, start fresh"
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Test mode: only scrape 5 pages"
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose logging"
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    max_pages = args.max_pages
    if args.test:
        max_pages = 5
        logger.info("Test mode: limiting to 5 pages")

    scraper = Scraper(max_pages=max_pages)
    result = scraper.run(resume=not args.no_resume)

    return 0 if result.get("status") in ("completed", "interrupted") else 1


if __name__ == "__main__":
    sys.exit(main())
