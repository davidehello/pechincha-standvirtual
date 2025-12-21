/**
 * Deal scoring algorithm
 *
 * Calculates a 0-100 score based on:
 * - priceVsSegment (35%): How cheap vs identical cars (same make/model/fuel/year range)
 * - priceEvaluation (25%): API's BELOW/IN/ABOVE indicator
 * - mileageQuality (25%): Low mileage for age
 * - pricePerKm (15%): Value efficiency (price / mileage)
 */

import { TAlgorithmWeights, TScoreBreakdown, DEFAULT_WEIGHTS } from "@/types";

interface TListingForScore {
  price: number;
  year: number;
  mileage: number | null;
  priceEvaluation: string | null;
}

interface TSegmentStats {
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  avgPricePerKm: number;
}

/**
 * Calculate price vs segment score (0-100)
 * Score 100 if at segment minimum, 0 if at segment maximum
 */
function calculatePriceVsSegmentScore(
  price: number,
  stats: TSegmentStats
): number {
  const { minPrice, maxPrice } = stats;

  // If only one car in segment or min equals max
  if (maxPrice <= minPrice) {
    return 50; // Neutral score
  }

  // Calculate percentile (lower price = higher score)
  const range = maxPrice - minPrice;
  const position = price - minPrice;
  const percentile = 1 - position / range;

  return Math.max(0, Math.min(100, percentile * 100));
}

/**
 * Calculate price evaluation score from API indicator
 */
function calculatePriceEvaluationScore(
  priceEvaluation: string | null
): number {
  switch (priceEvaluation) {
    case "BELOW":
      return 100;
    case "IN":
      return 50;
    case "ABOVE":
      return 0;
    default:
      return 50; // Unknown = neutral
  }
}

/**
 * Calculate mileage quality score (0-100)
 * Based on expected 15,000 km/year average
 */
function calculateMileageQualityScore(
  mileage: number | null,
  year: number
): number {
  if (!mileage || mileage <= 0) {
    return 50; // Unknown = neutral
  }

  const currentYear = new Date().getFullYear();
  const age = Math.max(1, currentYear - year);
  const expectedMileage = age * 15000;

  // Ratio of actual to expected
  const ratio = mileage / expectedMileage;

  // Score mapping:
  // 0.5 ratio (50% of expected) = 100 points
  // 1.0 ratio (100% of expected) = 50 points
  // 1.5+ ratio (150%+ of expected) = 0 points
  if (ratio <= 0.5) {
    return 100;
  } else if (ratio >= 1.5) {
    return 0;
  } else if (ratio <= 1.0) {
    // Linear interpolation from 100 to 50
    return 100 - (ratio - 0.5) * 100;
  } else {
    // Linear interpolation from 50 to 0
    return 50 - (ratio - 1.0) * 100;
  }
}

/**
 * Calculate price per km score (0-100)
 * Lower price per km = better score
 */
function calculatePricePerKmScore(
  price: number,
  mileage: number | null,
  segmentAvgPricePerKm: number
): number {
  if (!mileage || mileage <= 0) {
    return 50; // Unknown = neutral
  }

  const pricePerKm = price / mileage;

  // If segment average is unknown, use a reasonable default
  const avgPricePerKm = segmentAvgPricePerKm || 0.2; // Default ~0.20 EUR/km

  // Ratio of actual to segment average
  const ratio = pricePerKm / avgPricePerKm;

  // Score mapping:
  // 0.5 ratio (50% of average) = 100 points
  // 1.0 ratio (100% of average) = 50 points
  // 1.5+ ratio (150%+ of average) = 0 points
  if (ratio <= 0.5) {
    return 100;
  } else if (ratio >= 1.5) {
    return 0;
  } else if (ratio <= 1.0) {
    return 100 - (ratio - 0.5) * 100;
  } else {
    return 50 - (ratio - 1.0) * 100;
  }
}

/**
 * Calculate overall deal score
 */
export function calculateDealScore(
  listing: TListingForScore,
  segmentStats: TSegmentStats,
  weights: TAlgorithmWeights = DEFAULT_WEIGHTS
): TScoreBreakdown {
  // Calculate individual component scores
  const priceVsSegment = calculatePriceVsSegmentScore(
    listing.price,
    segmentStats
  );

  const priceEvaluation = calculatePriceEvaluationScore(
    listing.priceEvaluation
  );

  const mileageQuality = calculateMileageQualityScore(
    listing.mileage,
    listing.year
  );

  const pricePerKm = calculatePricePerKmScore(
    listing.price,
    listing.mileage,
    segmentStats.avgPricePerKm
  );

  // Calculate weighted total
  const total =
    priceVsSegment * weights.priceVsSegment +
    priceEvaluation * weights.priceEvaluation +
    mileageQuality * weights.mileageQuality +
    pricePerKm * weights.pricePerKm;

  return {
    priceVsSegment: Math.round(priceVsSegment * 10) / 10,
    priceEvaluation: Math.round(priceEvaluation * 10) / 10,
    mileageQuality: Math.round(mileageQuality * 10) / 10,
    pricePerKm: Math.round(pricePerKm * 10) / 10,
    total: Math.round(total * 10) / 10,
  };
}

/**
 * Get score label based on value
 */
export function getScoreLabel(score: number): string {
  if (score >= 90) return "Exceptional";
  if (score >= 80) return "Great";
  if (score >= 70) return "Good";
  if (score >= 60) return "Fair";
  if (score >= 50) return "Average";
  return "Below Average";
}
