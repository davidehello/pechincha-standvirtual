/**
 * Core types for Car Deal Finder
 */

// Price info from price history
export interface TPriceInfo {
  hasPriceChanges: boolean;
  priceChangePercent: number | null;
  priceChangeAmount: number | null;
  previousPrice: number | null;
}

// Listing type from database
export interface TListing {
  id: string;
  title: string;
  url: string;
  price: number;
  priceEvaluation: string | null;
  make: string;
  model: string;
  version: string | null;
  year: number;
  mileage: number | null;
  fuelType: string | null;
  gearbox: string | null;
  engineCapacity: number | null;
  enginePower: number | null;
  city: string | null;
  region: string | null;
  sellerName: string | null;
  sellerType: string | null;
  thumbnailUrl: string | null;
  badges: string | null;
  dealScore: number | null;
  scoreBreakdown: string | null;
  isActive: boolean | null;
  listingDate: Date | null;  // Original listing date from StandVirtual
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  createdAt: Date | null;
  priceInfo?: TPriceInfo;
}

// Score breakdown stored as JSON
export interface TScoreBreakdown {
  priceVsSegment: number;
  priceEvaluation: number;
  mileageQuality: number;
  pricePerKm: number;
  total: number;
}

// Algorithm weights (adjustable in settings)
export interface TAlgorithmWeights {
  priceVsSegment: number;
  priceEvaluation: number;
  mileageQuality: number;
  pricePerKm: number;
}

// Default weights
export const DEFAULT_WEIGHTS: TAlgorithmWeights = {
  priceVsSegment: 0.35,
  priceEvaluation: 0.25,
  mileageQuality: 0.25,
  pricePerKm: 0.15,
};

// Filter options for search
export interface TFilterOptions {
  priceMin?: number;
  priceMax?: number;
  yearMin?: number;
  yearMax?: number;
  mileageMin?: number;
  mileageMax?: number;
  makes?: string[];
  models?: string[];
  fuelTypes?: string[];
  gearboxTypes?: string[];
  regions?: string[];
  priceEvaluations?: string[];
  minDealScore?: number;
  enginePowerMin?: number;
  enginePowerMax?: number;
  engineCapacityMin?: number;
  engineCapacityMax?: number;
  hideUnavailable?: boolean;  // Hide listings not seen in latest scrape
}

// Sort options
export type TSortOption =
  | "score_desc"
  | "price_asc"
  | "price_desc"
  | "year_desc"
  | "year_asc"
  | "mileage_asc"
  | "mileage_desc";

// Scrape run type
export interface TScrapeRun {
  id: number;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  pagesScraped: number | null;
  listingsFound: number | null;
  listingsNew: number | null;
  listingsUpdated: number | null;
  errorMessage: string | null;
}

// API response types
export interface TDealsResponse {
  deals: TListing[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface TStatsResponse {
  totalListings: number;
  activeListings: number;
  belowMarketCount: number;
  averagePrice: number;
  averageMileage: number;
  topMakes: { make: string; count: number }[];
  lastScrapeRun: TScrapeRun | null;
}

// Price evaluation values
export type TPriceEvaluation = "BELOW" | "IN" | "ABOVE";

// Fuel types
export const FUEL_TYPES = [
  "diesel",
  "gasoline",
  "electric",
  "hybrid",
  "plug-in-hybrid",
  "lpg",
] as const;

// Gearbox types
export const GEARBOX_TYPES = ["manual", "automatic"] as const;
