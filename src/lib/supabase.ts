import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy initialization to avoid errors during build
let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
  }

  _supabase = createClient(supabaseUrl, supabaseKey);
  return _supabase;
}

// Type definitions matching the database schema
export interface TListing {
  id: string;
  title: string;
  url: string;
  price: number;
  price_evaluation: string | null;
  make: string;
  model: string;
  version: string | null;
  year: number;
  mileage: number | null;
  fuel_type: string | null;
  gearbox: string | null;
  engine_capacity: number | null;
  engine_power: number | null;
  city: string | null;
  region: string | null;
  seller_name: string | null;
  seller_type: string | null;
  thumbnail_url: string | null;
  badges: string | null;
  deal_score: number | null;
  score_breakdown: string | null;
  is_active: boolean | null;
  listing_date: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  created_at: string | null;
}

export interface TScrapeRun {
  id: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  pages_scraped: number | null;
  listings_found: number | null;
  listings_new: number | null;
  listings_updated: number | null;
  listings_inactive: number | null;
  error_message: string | null;
}

export interface TSavedDeal {
  id: number;
  listing_id: string;
  notes: string | null;
  saved_at: string | null;
}

export interface TPriceHistory {
  id: number;
  listing_id: string;
  price: number;
  recorded_at: string | null;
}

export interface TSetting {
  id: number;
  key: string;
  value: string | null;
  updated_at: string | null;
}

// Helper to convert snake_case to camelCase for frontend
export function toCamelCase<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = obj[key];
  }
  return result;
}

// Convert listing from DB format to frontend format
export function convertListing(listing: TListing): Record<string, unknown> {
  return {
    id: listing.id,
    title: listing.title,
    url: listing.url,
    price: listing.price,
    priceEvaluation: listing.price_evaluation,
    make: listing.make,
    model: listing.model,
    version: listing.version,
    year: listing.year,
    mileage: listing.mileage,
    fuelType: listing.fuel_type,
    gearbox: listing.gearbox,
    engineCapacity: listing.engine_capacity,
    enginePower: listing.engine_power,
    city: listing.city,
    region: listing.region,
    sellerName: listing.seller_name,
    sellerType: listing.seller_type,
    thumbnailUrl: listing.thumbnail_url,
    badges: listing.badges,
    dealScore: listing.deal_score,
    scoreBreakdown: listing.score_breakdown,
    isActive: listing.is_active,
    listingDate: listing.listing_date,
    firstSeenAt: listing.first_seen_at,
    lastSeenAt: listing.last_seen_at,
    createdAt: listing.created_at,
  };
}

// Calculate duration in seconds between two dates
function calculateDurationSeconds(startedAt: string | null, completedAt: string | null): number | null {
  if (!startedAt) return null;

  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();

  return Math.round((end - start) / 1000);
}

// Format duration as human-readable string
function formatDuration(seconds: number | null): string | null {
  if (seconds === null) return null;

  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
}

// Convert scrape run from DB format to frontend format
export function convertScrapeRun(run: TScrapeRun): Record<string, unknown> {
  const durationSeconds = calculateDurationSeconds(run.started_at, run.completed_at);
  const isRunning = run.status === 'running';

  // For running scrapes, calculate elapsed time from now
  const elapsedSeconds = isRunning ? calculateDurationSeconds(run.started_at, null) : null;

  return {
    id: run.id,
    status: run.status,
    startedAt: run.started_at,
    completedAt: run.completed_at,
    pagesScraped: run.pages_scraped,
    listingsFound: run.listings_found,
    listingsNew: run.listings_new,
    listingsUpdated: run.listings_updated,
    listingsInactive: run.listings_inactive,
    errorMessage: run.error_message,
    // Duration fields
    durationSeconds: isRunning ? null : durationSeconds,
    duration: isRunning ? null : formatDuration(durationSeconds),
    elapsedSeconds: elapsedSeconds,
    elapsed: formatDuration(elapsedSeconds),
  };
}
