#!/usr/bin/env python3
"""
Sync local SQLite database to Turso cloud.
This copies all data from local SQLite to Turso in batch.
"""
import sqlite3
import json
import time
import requests
from pathlib import Path

# Turso credentials
TURSO_DATABASE_URL = "libsql://pechincha-standvirtual-davidehello.aws-eu-west-2.turso.io"
TURSO_AUTH_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3MzQ4NTI0NTUsImlkIjoiNmY4MmMwYjctZTRiNC00N2Y2LWE1NjgtM2U2MzE2MmIyMjVmIn0.e0ppSBFVjRNpOiXghuw7kNeNz9AWJRX1BKCK-fgSarCIYm0p6OLqhQxcFSBiI8WbBf3gsMqflkHD8pgqVgAA"

# Convert libsql URL to HTTP API URL
HTTP_URL = TURSO_DATABASE_URL.replace("libsql://", "https://")
LOCAL_DB = Path(__file__).parent / "data" / "listings.db"


def execute_turso(sql: str, params: list = None) -> dict:
    """Execute SQL on Turso via HTTP API"""
    url = f"{HTTP_URL}/v2/pipeline"
    headers = {
        "Authorization": f"Bearer {TURSO_AUTH_TOKEN}",
        "Content-Type": "application/json"
    }

    # Build request
    request = {
        "requests": [
            {
                "type": "execute",
                "stmt": {
                    "sql": sql,
                    "args": [{"type": "text" if isinstance(p, str) else "integer" if isinstance(p, int) else "float" if isinstance(p, float) else "null", "value": str(p) if p is not None else None} for p in (params or [])]
                }
            },
            {"type": "close"}
        ]
    }

    response = requests.post(url, json=request, headers=headers)
    if response.status_code != 200:
        raise Exception(f"Turso error: {response.status_code} - {response.text}")

    return response.json()


def execute_batch(statements: list) -> dict:
    """Execute multiple SQL statements in a batch"""
    url = f"{HTTP_URL}/v2/pipeline"
    headers = {
        "Authorization": f"Bearer {TURSO_AUTH_TOKEN}",
        "Content-Type": "application/json"
    }

    requests_list = []
    for sql, params in statements:
        args = []
        for p in (params or []):
            if p is None:
                args.append({"type": "null", "value": None})
            elif isinstance(p, str):
                args.append({"type": "text", "value": p})
            elif isinstance(p, int):
                args.append({"type": "integer", "value": str(p)})
            elif isinstance(p, float):
                args.append({"type": "float", "value": str(p)})
            else:
                args.append({"type": "text", "value": str(p)})

        requests_list.append({
            "type": "execute",
            "stmt": {"sql": sql, "args": args}
        })

    requests_list.append({"type": "close"})

    response = requests.post(url, json={"requests": requests_list}, headers=headers)
    if response.status_code != 200:
        raise Exception(f"Turso error: {response.status_code} - {response.text}")

    return response.json()


def sync_listings():
    """Sync all listings from local SQLite to Turso"""
    print(f"Opening local database: {LOCAL_DB}")
    conn = sqlite3.connect(LOCAL_DB)
    conn.row_factory = sqlite3.Row

    # Get all listings
    listings = conn.execute("SELECT * FROM listings").fetchall()
    print(f"Found {len(listings)} listings to sync")

    # First, ensure tables exist on Turso
    print("Creating tables on Turso...")
    create_table = """
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
        )
    """
    execute_turso(create_table)

    # Sync in batches of 50 (HTTP API has limits)
    batch_size = 50
    total = len(listings)
    synced = 0

    for i in range(0, total, batch_size):
        batch = listings[i:i + batch_size]
        statements = []

        for row in batch:
            sql = """
                INSERT OR REPLACE INTO listings (
                    id, title, url, price, price_evaluation,
                    make, model, version, year, mileage,
                    fuel_type, gearbox, engine_capacity, engine_power,
                    city, region, seller_name, seller_type,
                    thumbnail_url, badges, deal_score, score_breakdown,
                    is_active, listing_date, first_seen_at, last_seen_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            params = [
                row["id"], row["title"], row["url"], row["price"], row["price_evaluation"],
                row["make"], row["model"], row["version"], row["year"], row["mileage"],
                row["fuel_type"], row["gearbox"], row["engine_capacity"], row["engine_power"],
                row["city"], row["region"], row["seller_name"], row["seller_type"],
                row["thumbnail_url"], row["badges"], row["deal_score"], row["score_breakdown"],
                row["is_active"], row["listing_date"], row["first_seen_at"], row["last_seen_at"], row["created_at"]
            ]
            statements.append((sql, params))

        try:
            execute_batch(statements)
            synced += len(batch)
            print(f"Progress: {synced}/{total} ({100*synced//total}%)")
        except Exception as e:
            print(f"Error syncing batch {i//batch_size}: {e}")
            break

    conn.close()
    print(f"\nDone! Synced {synced} listings to Turso.")


if __name__ == "__main__":
    sync_listings()
