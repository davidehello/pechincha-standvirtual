#!/usr/bin/env node
/**
 * Sync local SQLite database to Turso cloud.
 * Run with: node scripts/sync-to-turso.mjs
 */
import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Turso credentials - use wss:// for websocket connection
const TURSO_DATABASE_URL = 'wss://pechincha-standvirtual-davidehello.aws-eu-west-2.turso.io';
const TURSO_AUTH_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3MzQ4NTI0NTUsImlkIjoiNmY4MmMwYjctZTRiNC00N2Y2LWE1NjgtM2U2MzE2MmIyMjVmIn0.e0ppSBFVjRNpOiXghuw7kNeNz9AWJRX1BKCK-fgSarCIYm0p6OLqhQxcFSBiI8WbBf3gsMqflkHD8pgqVgAA';
const LOCAL_DB_PATH = join(__dirname, '..', 'scraper', 'data', 'listings.db');

async function main() {
  console.log('Connecting to local SQLite database...');
  const localClient = createClient({
    url: `file:${LOCAL_DB_PATH}`,
  });

  console.log('Connecting to Turso cloud database...');
  const tursoClient = createClient({
    url: TURSO_DATABASE_URL,
    authToken: TURSO_AUTH_TOKEN,
  });

  // Get count from local
  const localCount = await localClient.execute('SELECT COUNT(*) as count FROM listings');
  console.log(`Local database has ${localCount.rows[0].count} listings`);

  // Get all listings from local
  console.log('Fetching all listings from local database...');
  const listings = await localClient.execute('SELECT * FROM listings');
  console.log(`Fetched ${listings.rows.length} listings`);

  if (listings.rows.length === 0) {
    console.log('No listings to sync!');
    return;
  }

  // Clear existing data in Turso (optional, for clean sync)
  console.log('Clearing existing Turso data...');
  await tursoClient.execute('DELETE FROM listings');

  // Insert in batches
  const batchSize = 100;
  let synced = 0;

  for (let i = 0; i < listings.rows.length; i += batchSize) {
    const batch = listings.rows.slice(i, i + batchSize);

    // Build batch insert
    const statements = batch.map(row => ({
      sql: `INSERT OR REPLACE INTO listings (
        id, title, url, price, price_evaluation,
        make, model, version, year, mileage,
        fuel_type, gearbox, engine_capacity, engine_power,
        city, region, seller_name, seller_type,
        thumbnail_url, badges, deal_score, score_breakdown,
        is_active, listing_date, first_seen_at, last_seen_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        row.id, row.title, row.url, row.price, row.price_evaluation,
        row.make, row.model, row.version, row.year, row.mileage,
        row.fuel_type, row.gearbox, row.engine_capacity, row.engine_power,
        row.city, row.region, row.seller_name, row.seller_type,
        row.thumbnail_url, row.badges, row.deal_score, row.score_breakdown,
        row.is_active, row.listing_date, row.first_seen_at, row.last_seen_at, row.created_at
      ]
    }));

    // Execute batch
    await tursoClient.batch(statements);
    synced += batch.length;
    console.log(`Progress: ${synced}/${listings.rows.length} (${Math.round(100 * synced / listings.rows.length)}%)`);
  }

  // Verify
  const tursoCount = await tursoClient.execute('SELECT COUNT(*) as count FROM listings');
  console.log(`\nDone! Turso database now has ${tursoCount.rows[0].count} listings`);

  // Sync scrape_runs table too
  console.log('\nSyncing scrape_runs table...');
  const scrapeRuns = await localClient.execute('SELECT * FROM scrape_runs');
  if (scrapeRuns.rows.length > 0) {
    await tursoClient.execute('DELETE FROM scrape_runs');
    for (const row of scrapeRuns.rows) {
      await tursoClient.execute({
        sql: `INSERT INTO scrape_runs (id, status, started_at, completed_at, pages_scraped, listings_found, listings_new, listings_updated, listings_inactive, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [row.id, row.status, row.started_at, row.completed_at, row.pages_scraped, row.listings_found, row.listings_new, row.listings_updated, row.listings_inactive, row.error_message]
      });
    }
    console.log(`Synced ${scrapeRuns.rows.length} scrape runs`);
  }

  // Sync price_history table
  console.log('\nSyncing price_history table...');
  const priceHistory = await localClient.execute('SELECT * FROM price_history');
  if (priceHistory.rows.length > 0) {
    await tursoClient.execute('DELETE FROM price_history');
    const phBatchSize = 500;
    for (let i = 0; i < priceHistory.rows.length; i += phBatchSize) {
      const batch = priceHistory.rows.slice(i, i + phBatchSize);
      const statements = batch.map(row => ({
        sql: `INSERT INTO price_history (id, listing_id, price, recorded_at) VALUES (?, ?, ?, ?)`,
        args: [row.id, row.listing_id, row.price, row.recorded_at]
      }));
      await tursoClient.batch(statements);
    }
    console.log(`Synced ${priceHistory.rows.length} price history records`);
  }

  console.log('\nSync complete!');
}

main().catch(console.error);
