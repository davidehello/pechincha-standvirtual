#!/usr/bin/env python3
"""
Run scraper and save to Turso cloud database.
Run this script instead of main.py to send data to Turso.
"""
import os
import sys
import importlib

# Set Turso credentials FIRST
os.environ["TURSO_DATABASE_URL"] = "libsql://pechincha-standvirtual-davidehello.aws-eu-west-2.turso.io"
os.environ["TURSO_AUTH_TOKEN"] = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3MzQ4NTI0NTUsImlkIjoiNmY4MmMwYjctZTRiNC00N2Y2LWE1NjgtM2U2MzE2MmIyMjVmIn0.e0ppSBFVjRNpOiXghuw7kNeNz9AWJRX1BKCK-fgSarCIYm0p6OLqhQxcFSBiI8WbBf3gsMqflkHD8pgqVgAA"

if __name__ == "__main__":
    # Import config and reload it with new env vars
    import config
    importlib.reload(config)

    # Verify Turso is enabled
    print(f"TURSO_DATABASE_URL: {config.TURSO_DATABASE_URL[:50]}...")
    print(f"USE_TURSO: {config.USE_TURSO}")

    if not config.USE_TURSO:
        print("ERROR: Turso not enabled! Make sure libsql_experimental is installed.")
        sys.exit(1)

    # Reload storage with updated config
    import storage
    importlib.reload(storage)

    # Add args for parallel scraping
    sys.argv = ["run_turso.py", "--parallel", "--concurrency", "10"]

    # Import and reload main
    import main
    importlib.reload(main)

    sys.exit(main.main())
