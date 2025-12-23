import { NextResponse } from 'next/server';
import postgres from 'postgres';

export async function POST() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return NextResponse.json({ error: 'DATABASE_URL not set' }, { status: 500 });
  }

  const sql = postgres(connectionString, { max: 1 });

  try {
    // Create tables
    await sql`
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
        is_active BOOLEAN DEFAULT TRUE,
        listing_date TIMESTAMP,
        first_seen_at TIMESTAMP,
        last_seen_at TIMESTAMP,
        created_at TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS scrape_runs (
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
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS saved_deals (
        id SERIAL PRIMARY KEY,
        listing_id TEXT NOT NULL REFERENCES listings(id),
        notes TEXT,
        saved_at TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS price_history (
        id SERIAL PRIMARY KEY,
        listing_id TEXT NOT NULL REFERENCES listings(id),
        price INTEGER NOT NULL,
        recorded_at TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT,
        updated_at TIMESTAMP
      )
    `;

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_listings_make ON listings(make)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_listings_model ON listings(model)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_listings_year ON listings(year)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_listings_deal_score ON listings(deal_score)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_listings_price_evaluation ON listings(price_evaluation)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_listings_region ON listings(region)`;

    await sql.end();

    return NextResponse.json({
      success: true,
      message: 'Database schema created successfully'
    });
  } catch (error) {
    console.error('Setup error:', error);
    await sql.end();
    return NextResponse.json(
      { error: 'Failed to create schema', details: String(error) },
      { status: 500 }
    );
  }
}
