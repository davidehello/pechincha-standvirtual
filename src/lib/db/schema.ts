import { pgTable, text, integer, real, boolean, timestamp, serial, index } from 'drizzle-orm/pg-core';

// Main car listings table
export const listings = pgTable('listings', {
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
  isActive: boolean('is_active').default(true),
  listingDate: timestamp('listing_date'),
  firstSeenAt: timestamp('first_seen_at'),
  lastSeenAt: timestamp('last_seen_at'),
  createdAt: timestamp('created_at'),
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
export const scrapeRuns = pgTable('scrape_runs', {
  id: serial('id').primaryKey(),
  status: text('status').notNull(),               // pending, running, completed, failed
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  pagesScraped: integer('pages_scraped').default(0),
  listingsFound: integer('listings_found').default(0),
  listingsNew: integer('listings_new').default(0),
  listingsUpdated: integer('listings_updated').default(0),
  listingsInactive: integer('listings_inactive').default(0),  // Listings marked as unavailable
  errorMessage: text('error_message'),
});

// Saved/favorited deals
export const savedDeals = pgTable('saved_deals', {
  id: serial('id').primaryKey(),
  listingId: text('listing_id').notNull().references(() => listings.id),
  notes: text('notes'),
  savedAt: timestamp('saved_at'),
});

// Price history for tracking changes
export const priceHistory = pgTable('price_history', {
  id: serial('id').primaryKey(),
  listingId: text('listing_id').notNull().references(() => listings.id),
  price: integer('price').notNull(),
  recordedAt: timestamp('recorded_at'),
});

// User settings (algorithm weights, etc.)
export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value'),                           // JSON for complex values
  updatedAt: timestamp('updated_at'),
});

// Type exports
export type TListing = typeof listings.$inferSelect;
export type TNewListing = typeof listings.$inferInsert;
export type TScrapeRun = typeof scrapeRuns.$inferSelect;
export type TNewScrapeRun = typeof scrapeRuns.$inferInsert;
export type TSavedDeal = typeof savedDeals.$inferSelect;
export type TPriceHistory = typeof priceHistory.$inferSelect;
export type TSetting = typeof settings.$inferSelect;
