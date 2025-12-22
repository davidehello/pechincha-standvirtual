"""
SQLite storage layer for listings - optimized for batch operations
Supports both local SQLite and Turso (libSQL) for production
"""
import sqlite3
import json
import time
import logging
from pathlib import Path
from typing import Optional
from contextlib import contextmanager

from config import DATABASE_PATH, USE_TURSO, TURSO_DATABASE_URL, TURSO_AUTH_TOKEN
from scoring import calculate_deal_score

logger = logging.getLogger(__name__)

# Try to import libsql for Turso support
try:
    import libsql_experimental as libsql
    LIBSQL_AVAILABLE = True
except ImportError:
    LIBSQL_AVAILABLE = False


class Storage:
    """SQLite storage for car listings - optimized for high-throughput batch writes"""

    def __init__(self, db_path: Path = DATABASE_PATH):
        self.db_path = db_path
        self.use_turso = USE_TURSO and LIBSQL_AVAILABLE

        if self.use_turso:
            logger.info(f"Using Turso database: {TURSO_DATABASE_URL}")
        else:
            logger.info(f"Using local SQLite database: {db_path}")

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
                    listing_date INTEGER,
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
                    listings_inactive INTEGER DEFAULT 0,
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
        """Get database connection with performance optimizations"""
        if self.use_turso:
            # Use Turso (libSQL)
            conn = libsql.connect(
                database=TURSO_DATABASE_URL,
                auth_token=TURSO_AUTH_TOKEN
            )
        else:
            # Use local SQLite
            conn = sqlite3.connect(self.db_path)
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=NORMAL")  # Faster than FULL, still safe with WAL
            conn.execute("PRAGMA cache_size=-64000")   # 64MB cache
            conn.execute("PRAGMA temp_store=MEMORY")   # Temp tables in memory

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
        Insert or update a single listing.
        For bulk operations, use bulk_upsert_listings instead.

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
        Batch upsert listings - legacy method, calls bulk_upsert_listings.

        Returns:
            Tuple of (new_count, updated_count)
        """
        return self.bulk_upsert_listings(listings)

    def bulk_upsert_listings(self, listings: list[dict]) -> tuple[int, int]:
        """
        Ultra-optimized bulk upsert using temp table and single UPDATE/INSERT statements.

        This is ~100x faster than row-by-row operations because:
        1. Uses a temp table to stage all data
        2. Single UPDATE for all existing rows
        3. Single INSERT for all new rows
        4. No subqueries per row

        Returns:
            Tuple of (new_count, updated_count)
        """
        if not listings:
            return 0, 0

        now = int(time.time())

        with self._get_connection() as conn:
            # Create temp table (in memory due to PRAGMA temp_store=MEMORY)
            conn.execute("""
                CREATE TEMP TABLE IF NOT EXISTS temp_listings (
                    id TEXT PRIMARY KEY,
                    title TEXT,
                    url TEXT,
                    price INTEGER,
                    price_evaluation TEXT,
                    make TEXT,
                    model TEXT,
                    version TEXT,
                    year INTEGER,
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
                    listing_date INTEGER,
                    deal_score REAL,
                    score_breakdown TEXT
                )
            """)

            # Clear temp table
            conn.execute("DELETE FROM temp_listings")

            # Calculate deal scores for each listing
            listings_with_scores = []
            for listing in listings:
                score, breakdown = calculate_deal_score(listing)
                listings_with_scores.append((
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
                    listing.get("listing_date"),
                    score,
                    json.dumps(breakdown),
                ))

            # Bulk insert into temp table (use INSERT OR REPLACE to handle duplicates from pagination)
            conn.executemany("""
                INSERT OR REPLACE INTO temp_listings VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, listings_with_scores)

            # Count existing vs new (for return values and price history)
            existing_ids = set(row[0] for row in conn.execute("""
                SELECT t.id FROM temp_listings t
                INNER JOIN listings l ON t.id = l.id
            """).fetchall())

            new_count = len(listings) - len(existing_ids)
            updated_count = len(existing_ids)

            # Get price changes for existing listings
            price_changes = conn.execute("""
                SELECT t.id, t.price FROM temp_listings t
                INNER JOIN listings l ON t.id = l.id
                WHERE t.price != l.price
            """).fetchall()

            # Update existing listings (single UPDATE statement)
            conn.execute(f"""
                UPDATE listings SET
                    title = (SELECT title FROM temp_listings WHERE temp_listings.id = listings.id),
                    url = (SELECT url FROM temp_listings WHERE temp_listings.id = listings.id),
                    price = (SELECT price FROM temp_listings WHERE temp_listings.id = listings.id),
                    price_evaluation = (SELECT price_evaluation FROM temp_listings WHERE temp_listings.id = listings.id),
                    make = (SELECT make FROM temp_listings WHERE temp_listings.id = listings.id),
                    model = (SELECT model FROM temp_listings WHERE temp_listings.id = listings.id),
                    version = (SELECT version FROM temp_listings WHERE temp_listings.id = listings.id),
                    year = (SELECT year FROM temp_listings WHERE temp_listings.id = listings.id),
                    mileage = (SELECT mileage FROM temp_listings WHERE temp_listings.id = listings.id),
                    fuel_type = (SELECT fuel_type FROM temp_listings WHERE temp_listings.id = listings.id),
                    gearbox = (SELECT gearbox FROM temp_listings WHERE temp_listings.id = listings.id),
                    engine_capacity = (SELECT engine_capacity FROM temp_listings WHERE temp_listings.id = listings.id),
                    engine_power = (SELECT engine_power FROM temp_listings WHERE temp_listings.id = listings.id),
                    city = (SELECT city FROM temp_listings WHERE temp_listings.id = listings.id),
                    region = (SELECT region FROM temp_listings WHERE temp_listings.id = listings.id),
                    seller_name = (SELECT seller_name FROM temp_listings WHERE temp_listings.id = listings.id),
                    seller_type = (SELECT seller_type FROM temp_listings WHERE temp_listings.id = listings.id),
                    thumbnail_url = (SELECT thumbnail_url FROM temp_listings WHERE temp_listings.id = listings.id),
                    badges = (SELECT badges FROM temp_listings WHERE temp_listings.id = listings.id),
                    listing_date = COALESCE((SELECT listing_date FROM temp_listings WHERE temp_listings.id = listings.id), listings.listing_date),
                    deal_score = (SELECT deal_score FROM temp_listings WHERE temp_listings.id = listings.id),
                    score_breakdown = (SELECT score_breakdown FROM temp_listings WHERE temp_listings.id = listings.id),
                    is_active = 1,
                    last_seen_at = {now}
                WHERE id IN (SELECT id FROM temp_listings)
            """)

            # Insert new listings (single INSERT statement)
            conn.execute(f"""
                INSERT INTO listings (
                    id, title, url, price, price_evaluation,
                    make, model, version, year, mileage,
                    fuel_type, gearbox, engine_capacity, engine_power,
                    city, region, seller_name, seller_type,
                    thumbnail_url, badges, deal_score, score_breakdown, is_active,
                    listing_date, first_seen_at, last_seen_at, created_at
                )
                SELECT
                    t.id, t.title, t.url, t.price, t.price_evaluation,
                    t.make, t.model, t.version, t.year, t.mileage,
                    t.fuel_type, t.gearbox, t.engine_capacity, t.engine_power,
                    t.city, t.region, t.seller_name, t.seller_type,
                    t.thumbnail_url, t.badges, t.deal_score, t.score_breakdown, 1,
                    t.listing_date, {now}, {now}, {now}
                FROM temp_listings t
                WHERE t.id NOT IN (SELECT id FROM listings)
            """)

            # Insert price history for new listings
            conn.execute(f"""
                INSERT INTO price_history (listing_id, price, recorded_at)
                SELECT t.id, t.price, {now}
                FROM temp_listings t
                WHERE t.id NOT IN (SELECT listing_id FROM price_history)
            """)

            # Insert price history for changed prices
            if price_changes:
                conn.executemany(
                    f"INSERT INTO price_history (listing_id, price, recorded_at) VALUES (?, ?, {now})",
                    [(row[0], row[1]) for row in price_changes]
                )

        return new_count, updated_count

    def mark_inactive_not_seen_since(self, timestamp: int) -> int:
        """Mark listings not seen since timestamp as inactive. Returns count of affected rows."""
        with self._get_connection() as conn:
            result = conn.execute(
                "UPDATE listings SET is_active = 0 WHERE last_seen_at < ? AND is_active = 1",
                (timestamp,)
            )
            count = result.rowcount
            if count > 0:
                logger.info(f"Marked {count} listings as inactive/unavailable")
            return count

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
        listings_inactive: int = 0,
    ):
        """Update scrape run progress"""
        with self._get_connection() as conn:
            conn.execute("""
                UPDATE scrape_runs SET
                    pages_scraped = ?,
                    listings_found = ?,
                    listings_new = ?,
                    listings_updated = ?,
                    listings_inactive = ?
                WHERE id = ?
            """, (pages_scraped, listings_found, listings_new, listings_updated, listings_inactive, run_id))

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
