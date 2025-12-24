"""
PostgreSQL storage layer for listings - optimized for batch operations
Supports both local SQLite (dev) and PostgreSQL/Supabase (production)
"""
import sqlite3
import json
import time
import logging
from pathlib import Path
from typing import Optional
from contextlib import contextmanager

from config import DATABASE_PATH, USE_POSTGRES, DATABASE_URL
from scoring import calculate_deal_score

logger = logging.getLogger(__name__)

# Try to import psycopg2 for PostgreSQL support
try:
    import psycopg2
    from psycopg2.extras import execute_values, RealDictCursor
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False


class Storage:
    """Storage for car listings - supports SQLite (dev) and PostgreSQL (prod)"""

    def __init__(self, db_path: Path = DATABASE_PATH):
        self.db_path = db_path
        self.use_postgres = USE_POSTGRES and PSYCOPG2_AVAILABLE

        if self.use_postgres:
            # Debug: show connection info (mask password)
            if DATABASE_URL:
                from urllib.parse import urlparse
                parsed = urlparse(DATABASE_URL)
                logger.info(f"Using PostgreSQL database (Supabase)")
                logger.info(f"  Host: {parsed.hostname}")
                logger.info(f"  Port: {parsed.port}")
                logger.info(f"  User: {parsed.username}")
                logger.info(f"  DB: {parsed.path}")
        else:
            logger.info(f"Using local SQLite database: {db_path}")

        self._ensure_tables()

    def _ensure_tables(self):
        """Create tables if they don't exist"""
        if self.use_postgres:
            self._ensure_postgres_tables()
        else:
            self._ensure_sqlite_tables()

    def _ensure_postgres_tables(self):
        """Create PostgreSQL tables"""
        statements = [
            # Main listings table
            """CREATE TABLE IF NOT EXISTS listings (
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
                is_active BOOLEAN DEFAULT TRUE,
                listing_date TIMESTAMP,
                first_seen_at TIMESTAMP,
                last_seen_at TIMESTAMP,
                created_at TIMESTAMP
            )""",
            # Scrape runs table
            """CREATE TABLE IF NOT EXISTS scrape_runs (
                id SERIAL PRIMARY KEY,
                status TEXT NOT NULL,
                started_at TIMESTAMP,
                completed_at TIMESTAMP,
                pages_scraped INTEGER DEFAULT 0,
                listings_found INTEGER DEFAULT 0,
                listings_new INTEGER DEFAULT 0,
                listings_updated INTEGER DEFAULT 0,
                listings_inactive INTEGER DEFAULT 0,
                error_message TEXT
            )""",
            # Saved deals table
            """CREATE TABLE IF NOT EXISTS saved_deals (
                id SERIAL PRIMARY KEY,
                listing_id TEXT NOT NULL REFERENCES listings(id),
                notes TEXT,
                saved_at TIMESTAMP
            )""",
            # Price history table
            """CREATE TABLE IF NOT EXISTS price_history (
                id SERIAL PRIMARY KEY,
                listing_id TEXT NOT NULL REFERENCES listings(id),
                price INTEGER NOT NULL,
                recorded_at TIMESTAMP
            )""",
            # Settings table
            """CREATE TABLE IF NOT EXISTS settings (
                id SERIAL PRIMARY KEY,
                key TEXT NOT NULL UNIQUE,
                value TEXT,
                updated_at TIMESTAMP
            )""",
        ]

        # Indexes (PostgreSQL syntax)
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_listings_make ON listings(make)",
            "CREATE INDEX IF NOT EXISTS idx_listings_model ON listings(model)",
            "CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price)",
            "CREATE INDEX IF NOT EXISTS idx_listings_year ON listings(year)",
            "CREATE INDEX IF NOT EXISTS idx_listings_deal_score ON listings(deal_score)",
            "CREATE INDEX IF NOT EXISTS idx_listings_price_evaluation ON listings(price_evaluation)",
            "CREATE INDEX IF NOT EXISTS idx_listings_region ON listings(region)",
        ]

        with self._get_connection() as conn:
            cursor = conn.cursor()
            for statement in statements:
                cursor.execute(statement)
            for idx in indexes:
                cursor.execute(idx)
            conn.commit()

    def _ensure_sqlite_tables(self):
        """Create SQLite tables"""
        statements = [
            # Main listings table
            """CREATE TABLE IF NOT EXISTS listings (
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
            )""",
            # Scrape runs table
            """CREATE TABLE IF NOT EXISTS scrape_runs (
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
            )""",
            # Saved deals table
            """CREATE TABLE IF NOT EXISTS saved_deals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                listing_id TEXT NOT NULL REFERENCES listings(id),
                notes TEXT,
                saved_at INTEGER
            )""",
            # Price history table
            """CREATE TABLE IF NOT EXISTS price_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                listing_id TEXT NOT NULL REFERENCES listings(id),
                price INTEGER NOT NULL,
                recorded_at INTEGER
            )""",
            # Settings table
            """CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT NOT NULL UNIQUE,
                value TEXT,
                updated_at INTEGER
            )""",
            # Indexes for performance
            "CREATE INDEX IF NOT EXISTS idx_listings_make ON listings(make)",
            "CREATE INDEX IF NOT EXISTS idx_listings_model ON listings(model)",
            "CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price)",
            "CREATE INDEX IF NOT EXISTS idx_listings_year ON listings(year)",
            "CREATE INDEX IF NOT EXISTS idx_listings_deal_score ON listings(deal_score)",
            "CREATE INDEX IF NOT EXISTS idx_listings_price_evaluation ON listings(price_evaluation)",
            "CREATE INDEX IF NOT EXISTS idx_listings_region ON listings(region)",
        ]

        with self._get_connection() as conn:
            for statement in statements:
                conn.execute(statement)

    @contextmanager
    def _get_connection(self):
        """Get database connection"""
        if self.use_postgres:
            conn = psycopg2.connect(DATABASE_URL)
            try:
                yield conn
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()
        else:
            # Use local SQLite
            conn = sqlite3.connect(self.db_path)
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=NORMAL")
            conn.execute("PRAGMA cache_size=-64000")
            conn.execute("PRAGMA temp_store=MEMORY")
            conn.row_factory = sqlite3.Row
            try:
                yield conn
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()

    def upsert_listings(self, listings: list[dict]) -> tuple[int, int]:
        """
        Batch upsert listings.
        Returns: Tuple of (new_count, updated_count)
        """
        if self.use_postgres:
            return self._postgres_upsert_listings(listings)
        return self._sqlite_upsert_listings(listings)

    def _postgres_upsert_listings(self, listings: list[dict]) -> tuple[int, int]:
        """PostgreSQL upsert using ON CONFLICT"""
        if not listings:
            return 0, 0

        from datetime import datetime
        now = datetime.utcnow()

        with self._get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)

            # Get existing IDs and prices
            listing_ids = [l["id"] for l in listings]
            cursor.execute(
                "SELECT id, price FROM listings WHERE id = ANY(%s)",
                (listing_ids,)
            )
            existing_map = {row["id"]: row["price"] for row in cursor.fetchall()}

            new_count = 0
            updated_count = 0
            price_history_data = []

            # Prepare data for upsert
            upsert_data = []
            for listing in listings:
                score, breakdown = calculate_deal_score(listing)
                listing_id = listing["id"]
                new_price = listing["price"]

                is_existing = listing_id in existing_map
                if is_existing:
                    updated_count += 1
                    old_price = existing_map[listing_id]
                    if old_price != new_price:
                        price_history_data.append((listing_id, new_price, now))
                else:
                    new_count += 1
                    price_history_data.append((listing_id, new_price, now))

                # Convert listing_date if it's a unix timestamp
                listing_date = listing.get("listing_date")
                if listing_date and isinstance(listing_date, int):
                    listing_date = datetime.utcfromtimestamp(listing_date)

                upsert_data.append((
                    listing_id,
                    listing["title"],
                    listing["url"],
                    new_price,
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
                    score,
                    json.dumps(breakdown),
                    True,  # is_active
                    listing_date,
                    now,  # first_seen_at (for new)
                    now,  # last_seen_at
                    now,  # created_at (for new)
                ))

            # Bulk upsert using execute_values with ON CONFLICT
            if upsert_data:
                execute_values(
                    cursor,
                    """
                    INSERT INTO listings (
                        id, title, url, price, price_evaluation,
                        make, model, version, year, mileage,
                        fuel_type, gearbox, engine_capacity, engine_power,
                        city, region, seller_name, seller_type,
                        thumbnail_url, badges, deal_score, score_breakdown, is_active,
                        listing_date, first_seen_at, last_seen_at, created_at
                    ) VALUES %s
                    ON CONFLICT (id) DO UPDATE SET
                        title = EXCLUDED.title,
                        url = EXCLUDED.url,
                        price = EXCLUDED.price,
                        price_evaluation = EXCLUDED.price_evaluation,
                        make = EXCLUDED.make,
                        model = EXCLUDED.model,
                        version = EXCLUDED.version,
                        year = EXCLUDED.year,
                        mileage = EXCLUDED.mileage,
                        fuel_type = EXCLUDED.fuel_type,
                        gearbox = EXCLUDED.gearbox,
                        engine_capacity = EXCLUDED.engine_capacity,
                        engine_power = EXCLUDED.engine_power,
                        city = EXCLUDED.city,
                        region = EXCLUDED.region,
                        seller_name = EXCLUDED.seller_name,
                        seller_type = EXCLUDED.seller_type,
                        thumbnail_url = EXCLUDED.thumbnail_url,
                        badges = EXCLUDED.badges,
                        deal_score = EXCLUDED.deal_score,
                        score_breakdown = EXCLUDED.score_breakdown,
                        is_active = TRUE,
                        listing_date = COALESCE(EXCLUDED.listing_date, listings.listing_date),
                        last_seen_at = EXCLUDED.last_seen_at
                    """,
                    upsert_data
                )

            # Insert price history
            if price_history_data:
                execute_values(
                    cursor,
                    "INSERT INTO price_history (listing_id, price, recorded_at) VALUES %s",
                    price_history_data
                )

            conn.commit()

        return new_count, updated_count

    def _sqlite_upsert_listings(self, listings: list[dict]) -> tuple[int, int]:
        """SQLite bulk upsert using temp table"""
        if not listings:
            return 0, 0

        now = int(time.time())

        with self._get_connection() as conn:
            # Create temp table
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

            conn.execute("DELETE FROM temp_listings")

            # Calculate deal scores and prepare data
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

            conn.executemany("""
                INSERT OR REPLACE INTO temp_listings VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, listings_with_scores)

            # Count existing vs new
            existing_ids = set(row[0] for row in conn.execute("""
                SELECT t.id FROM temp_listings t
                INNER JOIN listings l ON t.id = l.id
            """).fetchall())

            new_count = len(listings) - len(existing_ids)
            updated_count = len(existing_ids)

            # Get price changes
            price_changes = conn.execute("""
                SELECT t.id, t.price FROM temp_listings t
                INNER JOIN listings l ON t.id = l.id
                WHERE t.price != l.price
            """).fetchall()

            # Update existing
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

            # Insert new
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

    def mark_inactive_not_seen_since(self, timestamp) -> int:
        """Mark listings not seen since timestamp as inactive"""
        with self._get_connection() as conn:
            if self.use_postgres:
                from datetime import datetime
                if isinstance(timestamp, int):
                    timestamp = datetime.utcfromtimestamp(timestamp)
                cursor = conn.cursor()
                cursor.execute(
                    "UPDATE listings SET is_active = FALSE WHERE last_seen_at < %s AND is_active = TRUE",
                    (timestamp,)
                )
                count = cursor.rowcount
            else:
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
        with self._get_connection() as conn:
            if self.use_postgres:
                from datetime import datetime
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO scrape_runs (status, started_at) VALUES ('running', %s) RETURNING id",
                    (datetime.utcnow(),)
                )
                return cursor.fetchone()[0]
            else:
                now = int(time.time())
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
            if self.use_postgres:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE scrape_runs SET
                        pages_scraped = %s,
                        listings_found = %s,
                        listings_new = %s,
                        listings_updated = %s,
                        listings_inactive = %s
                    WHERE id = %s
                """, (pages_scraped, listings_found, listings_new, listings_updated, listings_inactive, run_id))
            else:
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
        with self._get_connection() as conn:
            if self.use_postgres:
                from datetime import datetime
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE scrape_runs SET
                        status = %s,
                        completed_at = %s,
                        error_message = %s
                    WHERE id = %s
                """, (status, datetime.utcnow(), error, run_id))
            else:
                now = int(time.time())
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
            if self.use_postgres:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM listings")
                total = cursor.fetchone()[0]
                cursor.execute("SELECT COUNT(*) FROM listings WHERE is_active = TRUE")
                active = cursor.fetchone()[0]
                cursor.execute("SELECT COUNT(*) FROM listings WHERE price_evaluation = 'BELOW' AND is_active = TRUE")
                below_market = cursor.fetchone()[0]
            else:
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
