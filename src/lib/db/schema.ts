import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

// Main car listings table
export const listings = sqliteTable('listings', {
  id: text('id').primaryKey(),                    // External ID from API
  title: text('title').notNull(),
  url: text('url').notNull(),

  // Price
  price: integer('price').notNull(),              // EUR
  priceEvaluation: text('price_evaluation'),      // BELOW, IN, ABOVE

  // Vehicle specs
  make: text('make').notNull(),
  model: text('model').notNull(),
  version: text('version'),
  year: integer('year').notNull(),
  mileage: integer('mileage'),
  fuelType: text('fuel_type'),
  gearbox: text('gearbox'),
  engineCapacity: integer('engine_capacity'),     // cm3
  enginePower: integer('engine_power'),           // cv

  // Location
  city: text('city'),
  region: text('region'),

  // Seller
  sellerName: text('seller_name'),
  sellerType: text('seller_type'),                // professional/private

  // Images
  thumbnailUrl: text('thumbnail_url'),

  // Badges
  badges: text('badges'),                          // JSON array

  // Calculated scores
  dealScore: real('deal_score'),                  // 0-100
  scoreBreakdown: text('score_breakdown'),        // JSON

  // Metadata
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  listingDate: integer('listing_date', { mode: 'timestamp' }), // Original listing date from API
  firstSeenAt: integer('first_seen_at', { mode: 'timestamp' }),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }),
}, (table) => [
  index('idx_listings_make').on(table.make),
  index('idx_listings_model').on(table.model),
  index('idx_listings_price').on(table.price),
  index('idx_listings_year').on(table.year),
  index('idx_listings_deal_score').on(table.dealScore),
  index('idx_listings_price_evaluation').on(table.priceEvaluation),
  index('idx_listings_region').on(table.region),
]);

// Scrape run history
export const scrapeRuns = sqliteTable('scrape_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  status: text('status').notNull(),               // pending, running, completed, failed
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  pagesScraped: integer('pages_scraped').default(0),
  listingsFound: integer('listings_found').default(0),
  listingsNew: integer('listings_new').default(0),
  listingsUpdated: integer('listings_updated').default(0),
  errorMessage: text('error_message'),
});

// Saved/favorited deals
export const savedDeals = sqliteTable('saved_deals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  listingId: text('listing_id').notNull().references(() => listings.id),
  notes: text('notes'),
  savedAt: integer('saved_at', { mode: 'timestamp' }),
});

// Price history for tracking changes
export const priceHistory = sqliteTable('price_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  listingId: text('listing_id').notNull().references(() => listings.id),
  price: integer('price').notNull(),
  recordedAt: integer('recorded_at', { mode: 'timestamp' }),
});

// User settings (algorithm weights, etc.)
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  value: text('value'),                           // JSON for complex values
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

// Type exports
export type TListing = typeof listings.$inferSelect;
export type TNewListing = typeof listings.$inferInsert;
export type TScrapeRun = typeof scrapeRuns.$inferSelect;
export type TNewScrapeRun = typeof scrapeRuns.$inferInsert;
export type TSavedDeal = typeof savedDeals.$inferSelect;
export type TPriceHistory = typeof priceHistory.$inferSelect;
export type TSetting = typeof settings.$inferSelect;
