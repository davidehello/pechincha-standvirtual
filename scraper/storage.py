"""
SQLite storage layer for listings
"""
import sqlite3
import json
import time
import logging
from pathlib import Path
from typing import Optional
from contextlib import contextmanager

from config import DATABASE_PATH

logger = logging.getLogger(__name__)


class Storage:
    """SQLite storage for car listings"""

    def __init__(self, db_path: Path = DATABASE_PATH):
        self.db_path = db_path
        self._ensure_tables()

    def _ensure_tables(self):
        """Create tables if they don't exist"""
        with self._get_connection() as conn:
            conn.executescript("""
                -- Main listings table
                CREATE TABLE IF NOT EXISTS listings (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    url TEXT NOT NULL,
                    price INTEGER NOT NULL,
                    price_evaluation TEXT,
                    make TEXT NOT NULL,
                    model TEXT NOT NULL,
                    version TEXT,
                    year INTEGER NOT NULL,
                    mileage INTEGER,
                    fuel_type TEXT,
                    gearbox TEXT,
                    engine_capacity INTEGER,
                    engine_power INTEGER,
                    city TEXT,
                    region TEXT,
                    seller_name TEXT,
                    seller_type TEXT,
                    thumbnail_url TEXT,
                    badges TEXT,
                    deal_score REAL,
                    score_breakdown TEXT,
                    is_active INTEGER DEFAULT 1,
                    first_seen_at INTEGER,
                    last_seen_at INTEGER,
                    created_at INTEGER
                );

                -- Scrape runs table
                CREATE TABLE IF NOT EXISTS scrape_runs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    status TEXT NOT NULL,
                    started_at INTEGER,
                    completed_at INTEGER,
                    pages_scraped INTEGER DEFAULT 0,
                    listings_found INTEGER DEFAULT 0,
                    listings_new INTEGER DEFAULT 0,
                    listings_updated INTEGER DEFAULT 0,
                    error_message TEXT
                );

                -- Saved deals table
                CREATE TABLE IF NOT EXISTS saved_deals (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    listing_id TEXT NOT NULL REFERENCES listings(id),
                    notes TEXT,
                    saved_at INTEGER
                );

                -- Price history table
                CREATE TABLE IF NOT EXISTS price_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    listing_id TEXT NOT NULL REFERENCES listings(id),
                    price INTEGER NOT NULL,
                    recorded_at INTEGER
                );

                -- Settings table
                CREATE TABLE IF NOT EXISTS settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key TEXT NOT NULL UNIQUE,
                    value TEXT,
                    updated_at INTEGER
                );

                -- Indexes for performance
                CREATE INDEX IF NOT EXISTS idx_listings_make ON listings(make);
                CREATE INDEX IF NOT EXISTS idx_listings_model ON listings(model);
                CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price);
                CREATE INDEX IF NOT EXISTS idx_listings_year ON listings(year);
                CREATE INDEX IF NOT EXISTS idx_listings_deal_score ON listings(deal_score);
                CREATE INDEX IF NOT EXISTS idx_listings_price_evaluation ON listings(price_evaluation);
                CREATE INDEX IF NOT EXISTS idx_listings_region ON listings(region);
            """)

    @contextmanager
    def _get_connection(self):
        """Get database connection with WAL mode"""
        conn = sqlite3.connect(self.db_path)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def upsert_listing(self, listing: dict) -> tuple[bool, bool]:
        """
        Insert or update a listing.

        Returns:
            Tuple of (is_new, is_updated)
        """
        now = int(time.time())

        with self._get_connection() as conn:
            # Check if listing exists
            existing = conn.execute(
                "SELECT id, price FROM listings WHERE id = ?",
                (listing["id"],)
            ).fetchone()

            if existing:
                # Update existing listing
                old_price = existing["price"]
                new_price = listing["price"]

                conn.execute("""
                    UPDATE listings SET
                        title = ?,
                        url = ?,
                        price = ?,
                        price_evaluation = ?,
                        make = ?,
                        model = ?,
                        version = ?,
                        year = ?,
                        mileage = ?,
                        fuel_type = ?,
                        gearbox = ?,
                        engine_capacity = ?,
                        engine_power = ?,
                        city = ?,
                        region = ?,
                        seller_name = ?,
                        seller_type = ?,
                        thumbnail_url = ?,
                        badges = ?,
                        is_active = 1,
                        last_seen_at = ?
                    WHERE id = ?
                """, (
                    listing["title"],
                    listing["url"],
                    listing["price"],
                    listing["price_evaluation"],
                    listing["make"],
                    listing["model"],
                    listing.get("version"),
                    listing["year"],
                    listing.get("mileage"),
                    listing.get("fuel_type"),
                    listing.get("gearbox"),
                    listing.get("engine_capacity"),
                    listing.get("engine_power"),
                    listing.get("city"),
                    listing.get("region"),
                    listing.get("seller_name"),
                    listing.get("seller_type"),
                    listing.get("thumbnail_url"),
                    json.dumps(listing.get("badges", [])),
                    now,
                    listing["id"]
                ))

                # Track price change
                if old_price != new_price:
                    conn.execute(
                        "INSERT INTO price_history (listing_id, price, recorded_at) VALUES (?, ?, ?)",
                        (listing["id"], new_price, now)
                    )
                    logger.debug(f"Price changed for {listing['id']}: {old_price} -> {new_price}")

                return (False, True)
            else:
                # Insert new listing
                conn.execute("""
                    INSERT INTO listings (
                        id, title, url, price, price_evaluation,
                        make, model, version, year, mileage,
                        fuel_type, gearbox, engine_capacity, engine_power,
                        city, region, seller_name, seller_type,
                        thumbnail_url, badges, is_active,
                        first_seen_at, last_seen_at, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
                """, (
                    listing["id"],
                    listing["title"],
                    listing["url"],
                    listing["price"],
                    listing["price_evaluation"],
                    listing["make"],
                    listing["model"],
                    listing.get("version"),
                    listing["year"],
                    listing.get("mileage"),
                    listing.get("fuel_type"),
                    listing.get("gearbox"),
                    listing.get("engine_capacity"),
                    listing.get("engine_power"),
                    listing.get("city"),
                    listing.get("region"),
                    listing.get("seller_name"),
                    listing.get("seller_type"),
                    listing.get("thumbnail_url"),
                    json.dumps(listing.get("badges", [])),
                    now, now, now
                ))

                # Add initial price to history
                conn.execute(
                    "INSERT INTO price_history (listing_id, price, recorded_at) VALUES (?, ?, ?)",
                    (listing["id"], listing["price"], now)
                )

                return (True, False)

    def upsert_listings(self, listings: list[dict]) -> tuple[int, int]:
        """
        Batch upsert listings.

        Returns:
            Tuple of (new_count, updated_count)
        """
        new_count = 0
        updated_count = 0

        for listing in listings:
            try:
                is_new, is_updated = self.upsert_listing(listing)
                if is_new:
                    new_count += 1
                elif is_updated:
                    updated_count += 1
            except Exception as e:
                logger.error(f"Failed to upsert listing {listing.get('id')}: {e}")

        return new_count, updated_count

    def mark_inactive_not_seen_since(self, timestamp: int):
        """Mark listings not seen since timestamp as inactive"""
        with self._get_connection() as conn:
            result = conn.execute(
                "UPDATE listings SET is_active = 0 WHERE last_seen_at < ? AND is_active = 1",
                (timestamp,)
            )
            count = result.rowcount
            if count > 0:
                logger.info(f"Marked {count} listings as inactive")

    def create_scrape_run(self) -> int:
        """Create a new scrape run record"""
        now = int(time.time())
        with self._get_connection() as conn:
            cursor = conn.execute(
                "INSERT INTO scrape_runs (status, started_at) VALUES ('running', ?)",
                (now,)
            )
            return cursor.lastrowid

    def update_scrape_run(
        self,
        run_id: int,
        pages_scraped: int = 0,
        listings_found: int = 0,
        listings_new: int = 0,
        listings_updated: int = 0,
    ):
        """Update scrape run progress"""
        with self._get_connection() as conn:
            conn.execute("""
                UPDATE scrape_runs SET
                    pages_scraped = ?,
                    listings_found = ?,
                    listings_new = ?,
                    listings_updated = ?
                WHERE id = ?
            """, (pages_scraped, listings_found, listings_new, listings_updated, run_id))

    def complete_scrape_run(self, run_id: int, status: str = "completed", error: Optional[str] = None):
        """Mark scrape run as completed or failed"""
        now = int(time.time())
        with self._get_connection() as conn:
            conn.execute("""
                UPDATE scrape_runs SET
                    status = ?,
                    completed_at = ?,
                    error_message = ?
                WHERE id = ?
            """, (status, now, error, run_id))

    def get_stats(self) -> dict:
        """Get database statistics"""
        with self._get_connection() as conn:
            total = conn.execute("SELECT COUNT(*) FROM listings").fetchone()[0]
            active = conn.execute("SELECT COUNT(*) FROM listings WHERE is_active = 1").fetchone()[0]
            below_market = conn.execute(
                "SELECT COUNT(*) FROM listings WHERE price_evaluation = 'BELOW' AND is_active = 1"
            ).fetchone()[0]

            return {
                "total_listings": total,
                "active_listings": active,
                "below_market_count": below_market,
            }
