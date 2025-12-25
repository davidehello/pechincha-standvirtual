"""
StandVirtual Car Listings Scraper

Main entry point for scraping car listings from StandVirtual.com
Supports both sequential and parallel (async) scraping modes.
"""
import sys
import time
import logging
import argparse
import asyncio
from typing import Optional
from pathlib import Path

from config import MAX_PAGES
from client import GraphQLClient, RateLimitError
from async_client import AsyncGraphQLClient
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

            # Mark listings as inactive if not seen in this scrape
            inactive_count = self.storage.mark_inactive_not_seen_since(scrape_start_time)

            # Update scrape run with final stats including inactive count
            self.storage.update_scrape_run(
                run_id,
                pages_scraped=checkpoint.last_page,
                listings_found=checkpoint.listings_found,
                listings_new=checkpoint.listings_new,
                listings_updated=checkpoint.listings_updated,
                listings_inactive=inactive_count,
            )

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
            logger.info(f"  Marked unavailable: {inactive_count}")
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
                "listings_inactive": inactive_count,
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


class AsyncScraper:
    """Async scraper for parallel requests - much faster than sequential"""

    def __init__(self, max_pages: Optional[int] = None, concurrency: int = 10):
        self.checkpoint_manager = CheckpointManager()
        self.storage = Storage()
        self.max_pages = max_pages or MAX_PAGES
        self.concurrency = concurrency

    async def run(self) -> dict:
        """
        Run the async parallel scraper.

        Returns:
            Summary statistics
        """
        logger.info(f"Starting async scraper with {self.concurrency} concurrent connections...")
        start_time = time.time()

        # Create scrape run record
        run_id = self.storage.create_scrape_run()
        scrape_start_time = int(time.time())

        try:
            async with AsyncGraphQLClient(concurrency=self.concurrency) as client:
                # Get total pages from first request
                first_result = await client.fetch_page(1)

                if "error" in first_result:
                    raise Exception(f"Failed to fetch first page: {first_result['error']}")

                first_response = first_result["data"]
                total_pages = min(client.get_total_pages(first_response), self.max_pages)
                total_count = first_response["data"]["advertSearch"]["totalCount"]

                expected_listings = total_pages * 32  # PAGE_SIZE = 32
                logger.info(f"Found {total_count:,} listings across {total_pages} pages (expecting ~{expected_listings:,} from pagination)")

                # Process first page
                listings = client.extract_listings(first_response)
                new_count, updated_count = self.storage.upsert_listings(listings)
                total_new = new_count
                total_updated = updated_count
                total_found = len(listings)

                logger.info(f"Page 1: {len(listings)} listings ({new_count} new)")

                # Fetch remaining pages in parallel
                remaining_pages = list(range(2, total_pages + 1))
                failed_pages = []  # Initialize here so it's always defined

                if remaining_pages:
                    # Write progress to checkpoint file for status API
                    progress_file = Path(__file__).parent / "data" / "checkpoint.json"
                    progress_file.parent.mkdir(parents=True, exist_ok=True)

                    def progress_callback(completed, total):
                        # Write progress to file every 10 pages for real-time UI updates
                        if completed % 10 == 0 or completed == total:
                            import json as json_module
                            progress_data = {
                                "last_page": completed + 1,  # +1 because we already processed page 1
                                "total_pages": total + 1,
                                "listings_found": total_found + (completed * 32),  # Estimate
                                "status": "running"
                            }
                            progress_file.write_text(json_module.dumps(progress_data))

                        if completed % 100 == 0 or completed == total:
                            elapsed = time.time() - start_time
                            rate = completed / elapsed * 60 if elapsed > 0 else 0
                            remaining = (total - completed) / rate if rate > 0 else 0
                            logger.info(
                                f"Progress: {completed}/{total} pages "
                                f"({rate:.0f} pages/min, ~{remaining:.1f} min remaining)"
                            )

                    logger.info(f"Fetching {len(remaining_pages)} pages in parallel...")
                    results = await client.fetch_pages(remaining_pages, progress_callback)

                    # Process results and collect failed pages for retry
                    logger.info("Processing results and saving in batches...")
                    batch_listings = []
                    batch_size = 1000  # Save every 1000 listings
                    failed_pages = []

                    for i, result in enumerate(results):
                        if "error" in result:
                            failed_pages.append(result["page"])
                            logger.warning(f"Page {result['page']} failed: {result['error']}")
                            continue

                        page_listings = client.extract_listings(result["data"])
                        if page_listings:
                            batch_listings.extend(page_listings)

                        # Save batch when we have enough listings
                        if len(batch_listings) >= batch_size:
                            logger.info(f"Saving batch of {len(batch_listings)} listings...")
                            save_start = time.time()
                            new_count, updated_count = self.storage.upsert_listings(batch_listings)
                            save_elapsed = time.time() - save_start
                            logger.info(f"Batch saved in {save_elapsed:.1f}s ({new_count} new, {updated_count} updated)")
                            total_new += new_count
                            total_updated += updated_count
                            total_found += len(batch_listings)
                            batch_listings = []

                            # Update scrape run progress
                            self.storage.update_scrape_run(
                                run_id,
                                pages_scraped=i + 2,  # +1 for first page, +1 for 0-index
                                listings_found=total_found,
                                listings_new=total_new,
                                listings_updated=total_updated,
                            )

                    # Retry failed pages up to 3 times
                    retry_round = 1
                    max_retry_rounds = 3
                    while failed_pages and retry_round <= max_retry_rounds:
                        logger.info(f"Retry round {retry_round}: {len(failed_pages)} failed pages to retry...")
                        await asyncio.sleep(2)  # Small delay before retry

                        retry_results = await client.fetch_pages(failed_pages, None)
                        still_failed = []

                        for result in retry_results:
                            if "error" in result:
                                still_failed.append(result["page"])
                                continue

                            page_listings = client.extract_listings(result["data"])
                            if page_listings:
                                batch_listings.extend(page_listings)
                                logger.info(f"Recovered page {result['page']}: {len(page_listings)} listings")

                        failed_pages = still_failed
                        retry_round += 1

                    if failed_pages:
                        logger.error(f"PERMANENTLY FAILED: {len(failed_pages)} pages after {max_retry_rounds} retry rounds: {failed_pages[:20]}{'...' if len(failed_pages) > 20 else ''}")

                    # Save remaining listings
                    if batch_listings:
                        logger.info(f"Saving final batch of {len(batch_listings)} listings...")
                        save_start = time.time()
                        new_count, updated_count = self.storage.upsert_listings(batch_listings)
                        save_elapsed = time.time() - save_start
                        logger.info(f"Final batch saved in {save_elapsed:.1f}s")
                        total_new += new_count
                        total_updated += updated_count
                        total_found += len(batch_listings)

                # Mark listings as inactive if not seen in this scrape
                logger.info("Marking inactive listings...")
                try:
                    inactive_count = self.storage.mark_inactive_not_seen_since(scrape_start_time)
                    logger.info(f"Marked {inactive_count} listings as inactive")
                except Exception as e:
                    logger.error(f"Error marking inactive listings: {e}")
                    inactive_count = 0

                # Update scrape run with final stats including inactive count
                logger.info("Updating scrape run stats...")
                try:
                    self.storage.update_scrape_run(
                        run_id,
                        pages_scraped=total_pages,
                        listings_found=total_found,
                        listings_new=total_new,
                        listings_updated=total_updated,
                        listings_inactive=inactive_count,
                    )
                except Exception as e:
                    logger.error(f"Error updating scrape run: {e}")

                # Final stats
                elapsed = time.time() - start_time
                logger.info("Getting database stats...")
                try:
                    stats = self.storage.get_stats()
                except Exception as e:
                    logger.error(f"Error getting stats: {e}")
                    stats = {"total_listings": 0, "active_listings": 0, "below_market_count": 0}

                # Calculate coverage percentage
                coverage_pct = (total_found / total_count * 100) if total_count > 0 else 0
                failed_count = len(failed_pages)

                # Build scrape details for storage
                scrape_details = {
                    "api_total_count": total_count,
                    "expected_from_pagination": total_pages * 32,
                    "coverage_percentage": round(coverage_pct, 1),
                    "pages_failed": failed_count,
                    "failed_page_numbers": failed_pages[:50] if failed_pages else [],  # Store first 50 failed pages
                    "duration_seconds": round(elapsed, 1),
                    "speed_pages_per_min": round(total_pages / elapsed * 60) if elapsed > 0 else 0,
                }

                # Complete run with details
                self.storage.complete_scrape_run(run_id, scrape_details=scrape_details)

                logger.info("=" * 50)
                logger.info("Scrape completed successfully!")
                logger.info(f"  Time: {elapsed:.1f}s ({elapsed/60:.1f} min)")
                logger.info(f"  Speed: {total_pages / elapsed * 60:.0f} pages/min")
                logger.info(f"  Pages scraped: {total_pages}")
                logger.info(f"  Pages failed: {failed_count}")
                logger.info(f"  API reported: {total_count:,} listings")
                logger.info(f"  Listings found: {total_found:,} ({coverage_pct:.1f}% coverage)")
                logger.info(f"  New listings: {total_new}")
                logger.info(f"  Updated listings: {total_updated}")
                logger.info(f"  Marked unavailable: {inactive_count}")
                logger.info(f"  Total in database: {stats['total_listings']}")
                logger.info(f"  Active listings: {stats['active_listings']}")
                logger.info(f"  Below market: {stats['below_market_count']}")
                logger.info("=" * 50)

                return {
                    "status": "completed",
                    "time_seconds": elapsed,
                    "pages_scraped": total_pages,
                    "listings_found": total_found,
                    "listings_new": total_new,
                    "listings_updated": total_updated,
                    "listings_inactive": inactive_count,
                    **stats,
                }

        except KeyboardInterrupt:
            logger.warning("Scrape interrupted by user")
            self.storage.complete_scrape_run(run_id, status="interrupted")
            return {"status": "interrupted"}

        except Exception as e:
            logger.error(f"Scrape failed: {e}")
            self.storage.complete_scrape_run(run_id, status="failed", error=str(e))
            raise


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
        "--parallel",
        action="store_true",
        help="Use parallel async mode (much faster, ~1 min vs ~13 min)"
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=10,
        help="Number of concurrent connections for parallel mode (default: 10)"
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

    if args.parallel:
        # Use async parallel scraper
        scraper = AsyncScraper(max_pages=max_pages, concurrency=args.concurrency)
        result = asyncio.run(scraper.run())
    else:
        # Use sequential scraper
        scraper = Scraper(max_pages=max_pages)
        result = scraper.run(resume=not args.no_resume)

    return 0 if result.get("status") in ("completed", "interrupted") else 1


if __name__ == "__main__":
    sys.exit(main())
