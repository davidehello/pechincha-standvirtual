"""
Migration script to copy local SQLite database to Turso cloud database.
Run this once after setting up your Turso database.

Usage:
    TURSO_DATABASE_URL=libsql://your-db.turso.io TURSO_AUTH_TOKEN=your-token python migrate_to_turso.py
"""
import sqlite3
import os
import sys
from pathlib import Path

# Try to import libsql
try:
    import libsql_experimental as libsql
except ImportError:
    print("ERROR: libsql-experimental not installed. Run: pip install libsql-experimental")
    sys.exit(1)

# Local database path
LOCAL_DB = Path(__file__).parent / "data" / "listings.db"

# Turso credentials from environment
TURSO_URL = os.environ.get("TURSO_DATABASE_URL")
TURSO_TOKEN = os.environ.get("TURSO_AUTH_TOKEN")

if not TURSO_URL or not TURSO_TOKEN:
    print("ERROR: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables are required")
    print("\nUsage:")
    print("  TURSO_DATABASE_URL=libsql://your-db.turso.io TURSO_AUTH_TOKEN=your-token python migrate_to_turso.py")
    sys.exit(1)

if not LOCAL_DB.exists():
    print(f"ERROR: Local database not found at {LOCAL_DB}")
    sys.exit(1)


def migrate():
    """Migrate all data from local SQLite to Turso"""
    print(f"Connecting to local database: {LOCAL_DB}")
    local_conn = sqlite3.connect(LOCAL_DB)
    local_conn.row_factory = sqlite3.Row

    print(f"Connecting to Turso: {TURSO_URL}")
    turso_conn = libsql.connect(database=TURSO_URL, auth_token=TURSO_TOKEN)

    # Create tables in Turso
    print("Creating tables in Turso...")
    turso_conn.executescript("""
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

        CREATE TABLE IF NOT EXISTS saved_deals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            listing_id TEXT NOT NULL REFERENCES listings(id),
            notes TEXT,
            saved_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS price_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            listing_id TEXT NOT NULL REFERENCES listings(id),
            price INTEGER NOT NULL,
            recorded_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL UNIQUE,
            value TEXT,
            updated_at INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_listings_make ON listings(make);
        CREATE INDEX IF NOT EXISTS idx_listings_model ON listings(model);
        CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price);
        CREATE INDEX IF NOT EXISTS idx_listings_year ON listings(year);
        CREATE INDEX IF NOT EXISTS idx_listings_deal_score ON listings(deal_score);
        CREATE INDEX IF NOT EXISTS idx_listings_price_evaluation ON listings(price_evaluation);
        CREATE INDEX IF NOT EXISTS idx_listings_region ON listings(region);
    """)
    turso_conn.commit()

    # Migrate listings
    print("Migrating listings...")
    listings = local_conn.execute("SELECT * FROM listings").fetchall()
    print(f"  Found {len(listings)} listings")

    batch_size = 500
    for i in range(0, len(listings), batch_size):
        batch = listings[i:i+batch_size]
        turso_conn.executemany("""
            INSERT OR REPLACE INTO listings VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [tuple(row) for row in batch])
        turso_conn.commit()
        print(f"  Migrated {min(i+batch_size, len(listings))}/{len(listings)} listings")

    # Migrate price_history
    print("Migrating price history...")
    history = local_conn.execute("SELECT * FROM price_history").fetchall()
    print(f"  Found {len(history)} price history entries")

    for i in range(0, len(history), batch_size):
        batch = history[i:i+batch_size]
        turso_conn.executemany("""
            INSERT OR REPLACE INTO price_history VALUES (?, ?, ?, ?)
        """, [tuple(row) for row in batch])
        turso_conn.commit()
        print(f"  Migrated {min(i+batch_size, len(history))}/{len(history)} entries")

    # Migrate saved_deals
    print("Migrating saved deals...")
    saved = local_conn.execute("SELECT * FROM saved_deals").fetchall()
    print(f"  Found {len(saved)} saved deals")
    if saved:
        turso_conn.executemany("""
            INSERT OR REPLACE INTO saved_deals VALUES (?, ?, ?, ?)
        """, [tuple(row) for row in saved])
        turso_conn.commit()

    # Migrate scrape_runs (last 10 only)
    print("Migrating recent scrape runs...")
    runs = local_conn.execute("SELECT * FROM scrape_runs ORDER BY id DESC LIMIT 10").fetchall()
    print(f"  Found {len(runs)} recent runs")
    if runs:
        turso_conn.executemany("""
            INSERT OR REPLACE INTO scrape_runs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [tuple(row) for row in runs])
        turso_conn.commit()

    # Migrate settings
    print("Migrating settings...")
    settings = local_conn.execute("SELECT * FROM settings").fetchall()
    print(f"  Found {len(settings)} settings")
    if settings:
        turso_conn.executemany("""
            INSERT OR REPLACE INTO settings VALUES (?, ?, ?, ?)
        """, [tuple(row) for row in settings])
        turso_conn.commit()

    local_conn.close()
    turso_conn.close()

    print("\n✅ Migration complete!")
    print(f"   Listings: {len(listings)}")
    print(f"   Price history: {len(history)}")
    print(f"   Saved deals: {len(saved)}")


if __name__ == "__main__":
    migrate()
