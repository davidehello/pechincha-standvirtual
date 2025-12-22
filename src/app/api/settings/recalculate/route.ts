import { NextResponse } from "next/server";
import { db, listings, settings } from "@/lib/db";
import { priceHistory } from "@/lib/db/schema";
import { eq, gte, or, desc, inArray } from "drizzle-orm";
import { TAlgorithmWeights, DEFAULT_WEIGHTS } from "@/types";

// Time decay configuration
const MAX_HISTORY_DAYS = 90;
const TIME_DECAY_WEIGHTS = {
  days_0_30: 1.0, // Full weight for last 30 days
  days_30_60: 0.75, // 75% weight for 30-60 days
  days_60_90: 0.5, // 50% weight for 60-90 days
};

// Expected mileage per year by fuel type (km/year)
const EXPECTED_MILEAGE_PER_YEAR: Record<string, number> = {
  diesel: 20000,
  gasoline: 12000,
  electric: 15000,
  hybrid: 15000,
  "plug-in-hybrid": 15000,
  lpg: 18000,
};

// Load weights from database
async function loadWeights(): Promise<TAlgorithmWeights> {
  try {
    const result = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "algorithm_weights"))
      .limit(1);

    if (result.length > 0 && result[0].value) {
      return JSON.parse(result[0].value);
    }
  } catch (error) {
    console.error("Error loading weights:", error);
  }
  return DEFAULT_WEIGHTS;
}

// Calculate time decay weight based on lastSeenAt date
function getTimeDecayWeight(lastSeenAt: Date | null): number {
  if (!lastSeenAt) return 0;

  const now = new Date();
  const daysDiff = Math.floor(
    (now.getTime() - lastSeenAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysDiff < 0) return 1.0; // Future date (shouldn't happen)
  if (daysDiff <= 30) return TIME_DECAY_WEIGHTS.days_0_30;
  if (daysDiff <= 60) return TIME_DECAY_WEIGHTS.days_30_60;
  if (daysDiff <= 90) return TIME_DECAY_WEIGHTS.days_60_90;
  return 0; // Older than 90 days - exclude
}

// Calculate weighted percentile for a price within a segment
function calculateWeightedPercentile(
  price: number,
  segmentPrices: Array<{ price: number; weight: number }>
): number {
  if (segmentPrices.length === 0) return 50;

  // Sort by price
  const sorted = [...segmentPrices].sort((a, b) => a.price - b.price);

  // Calculate total weight and weighted position
  let totalWeight = 0;
  let belowWeight = 0;

  for (const item of sorted) {
    totalWeight += item.weight;
    if (item.price < price) {
      belowWeight += item.weight;
    } else if (item.price === price) {
      belowWeight += item.weight / 2; // Half weight for equal prices
    }
  }

  if (totalWeight === 0) return 50;

  // Percentile: 0 = cheapest, 100 = most expensive
  const percentile = (belowWeight / totalWeight) * 100;

  // Score: lower percentile (cheaper) = higher score
  return Math.round(100 - percentile);
}

// Calculate scores for Price vs Segment using percentile-based comparison with historical data
async function calculatePriceVsSegmentScores(): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  const now = new Date();
  const cutoffDate = new Date(
    now.getTime() - MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000
  );

  // Get all listings from last 90 days (both active and recently inactive)
  const historicalListings = await db
    .select({
      id: listings.id,
      make: listings.make,
      model: listings.model,
      fuelType: listings.fuelType,
      year: listings.year,
      price: listings.price,
      isActive: listings.isActive,
      lastSeenAt: listings.lastSeenAt,
    })
    .from(listings)
    .where(or(eq(listings.isActive, true), gte(listings.lastSeenAt, cutoffDate)));

  // Group listings by segment with time-decay weights
  const segmentData = new Map<
    string,
    Array<{ price: number; weight: number; id: string; isActive: boolean }>
  >();

  for (const listing of historicalListings) {
    const yearGroup = Math.floor(listing.year / 3) * 3;
    const key = `${listing.make}|${listing.model}|${listing.fuelType}|${yearGroup}`;

    // Calculate weight based on recency
    const weight = listing.isActive
      ? 1.0
      : getTimeDecayWeight(listing.lastSeenAt);

    if (weight === 0) continue; // Skip if too old

    if (!segmentData.has(key)) {
      segmentData.set(key, []);
    }
    segmentData.get(key)!.push({
      price: listing.price,
      weight,
      id: listing.id,
      isActive: listing.isActive ?? false,
    });
  }

  // Calculate score for each active listing
  for (const listing of historicalListings) {
    if (!listing.isActive) continue; // Only score active listings

    const yearGroup = Math.floor(listing.year / 3) * 3;
    const key = `${listing.make}|${listing.model}|${listing.fuelType}|${yearGroup}`;
    const segmentPrices = segmentData.get(key) || [];

    const score = calculateWeightedPercentile(listing.price, segmentPrices);
    scores.set(listing.id, score);
  }

  return scores;
}

// Calculate price drop bonus score
async function calculatePriceDropScores(): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  const now = new Date();

  // Get all active listing IDs
  const activeListings = await db
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.isActive, true));

  const activeIds = activeListings.map((l) => l.id);
  if (activeIds.length === 0) return scores;

  // Get price history for all active listings from last 30 days
  const recentPriceHistory = await db
    .select({
      listingId: priceHistory.listingId,
      price: priceHistory.price,
      recordedAt: priceHistory.recordedAt,
    })
    .from(priceHistory)
    .where(inArray(priceHistory.listingId, activeIds))
    .orderBy(desc(priceHistory.recordedAt));

  // Group by listing
  const pricesByListing = new Map<
    string,
    Array<{ price: number; recordedAt: Date | null }>
  >();
  for (const record of recentPriceHistory) {
    if (!pricesByListing.has(record.listingId)) {
      pricesByListing.set(record.listingId, []);
    }
    pricesByListing.get(record.listingId)!.push({
      price: record.price,
      recordedAt: record.recordedAt,
    });
  }

  // Calculate score for each listing
  for (const [listingId, prices] of pricesByListing) {
    if (prices.length < 2) {
      scores.set(listingId, 0); // No price history = no bonus
      continue;
    }

    const currentPrice = prices[0].price;
    const previousPrice = prices[1].price;
    const priceChange = ((currentPrice - previousPrice) / previousPrice) * 100;

    // Only reward price drops
    if (priceChange >= 0) {
      scores.set(listingId, 0);
      continue;
    }

    const dropPercent = Math.abs(priceChange);
    const recordedAt = prices[0].recordedAt;
    const daysSinceChange = recordedAt
      ? Math.floor((now.getTime() - recordedAt.getTime()) / (1000 * 60 * 60 * 24))
      : 30;

    // Score based on drop magnitude and recency
    let score = 0;
    if (dropPercent >= 20 && daysSinceChange <= 7) {
      score = 100; // 20%+ drop in last 7 days
    } else if (dropPercent >= 10 && daysSinceChange <= 14) {
      score = 80; // 10-20% drop in last 14 days
    } else if (dropPercent >= 5 && daysSinceChange <= 30) {
      score = 60; // 5-10% drop in last 30 days
    } else if (dropPercent > 0 && daysSinceChange <= 30) {
      score = 40; // Any drop in last 30 days
    }

    scores.set(listingId, score);
  }

  // Set 0 for listings without price history
  for (const listing of activeListings) {
    if (!scores.has(listing.id)) {
      scores.set(listing.id, 0);
    }
  }

  return scores;
}

// Calculate individual component scores with fuel-type adjusted mileage
function calculateComponentScores(listing: {
  priceEvaluation: string | null;
  year: number;
  mileage: number | null;
  price: number;
  fuelType: string | null;
}): {
  priceEvaluation: number;
  mileageQuality: number;
  pricePerKm: number;
} {
  const currentYear = new Date().getFullYear();

  // Price Evaluation Score (StandVirtual's evaluation)
  const priceEval = (listing.priceEvaluation || "").toUpperCase();
  let priceEvaluationScore: number;
  if (priceEval === "BELOW") {
    priceEvaluationScore = 100;
  } else if (priceEval === "IN") {
    priceEvaluationScore = 50;
  } else if (priceEval === "ABOVE") {
    priceEvaluationScore = 10;
  } else {
    priceEvaluationScore = 50; // Unknown = average
  }

  // Mileage Quality Score - adjusted by fuel type
  let mileageQualityScore = 50;
  if (listing.year && listing.mileage) {
    const carAge = Math.max(1, currentYear - listing.year);
    const fuelType = (listing.fuelType || "gasoline").toLowerCase();
    const expectedPerYear =
      EXPECTED_MILEAGE_PER_YEAR[fuelType] ||
      EXPECTED_MILEAGE_PER_YEAR["gasoline"];
    const expectedMileage = carAge * expectedPerYear;
    const mileageRatio =
      expectedMileage > 0 ? listing.mileage / expectedMileage : 1;

    // More granular scoring
    if (mileageRatio <= 0.4) {
      mileageQualityScore = 100; // Exceptionally low mileage
    } else if (mileageRatio <= 0.6) {
      mileageQualityScore = 90;
    } else if (mileageRatio <= 0.8) {
      mileageQualityScore = 80;
    } else if (mileageRatio <= 1.0) {
      mileageQualityScore = 70; // Expected mileage
    } else if (mileageRatio <= 1.2) {
      mileageQualityScore = 55;
    } else if (mileageRatio <= 1.4) {
      mileageQualityScore = 40;
    } else if (mileageRatio <= 1.6) {
      mileageQualityScore = 25;
    } else {
      mileageQualityScore = 10; // Very high mileage
    }
  }

  // Price per Km Score - relative value
  let pricePerKmScore = 50;
  if (listing.mileage && listing.mileage > 0) {
    const pricePerKm = listing.price / listing.mileage;
    // Typical range: 0.05€/km (great) to 0.50€/km (poor)
    if (pricePerKm <= 0.05) {
      pricePerKmScore = 100;
    } else if (pricePerKm <= 0.08) {
      pricePerKmScore = 90;
    } else if (pricePerKm <= 0.12) {
      pricePerKmScore = 75;
    } else if (pricePerKm <= 0.18) {
      pricePerKmScore = 60;
    } else if (pricePerKm <= 0.25) {
      pricePerKmScore = 45;
    } else if (pricePerKm <= 0.35) {
      pricePerKmScore = 30;
    } else {
      pricePerKmScore = 15;
    }
  }

  return {
    priceEvaluation: priceEvaluationScore,
    mileageQuality: mileageQualityScore,
    pricePerKm: pricePerKmScore,
  };
}

export async function POST() {
  try {
    // Load custom weights
    const weights = await loadWeights();

    // Get all active listings
    const allListings = await db
      .select({
        id: listings.id,
        priceEvaluation: listings.priceEvaluation,
        year: listings.year,
        mileage: listings.mileage,
        price: listings.price,
        make: listings.make,
        model: listings.model,
        fuelType: listings.fuelType,
      })
      .from(listings)
      .where(eq(listings.isActive, true));

    // Calculate all component scores
    const priceVsSegmentScores = await calculatePriceVsSegmentScores();
    const priceDropScores = await calculatePriceDropScores();

    let updatedCount = 0;

    // Process in batches of 1000
    const batchSize = 1000;
    for (let i = 0; i < allListings.length; i += batchSize) {
      const batch = allListings.slice(i, i + batchSize);

      for (const listing of batch) {
        // Get component scores
        const components = calculateComponentScores(listing);
        const priceVsSegmentScore = priceVsSegmentScores.get(listing.id) || 50;
        const priceDropScore = priceDropScores.get(listing.id) || 0;

        // Calculate weighted total score
        // Note: priceDropScore is a bonus, added on top (max 10 points bonus)
        const baseScore =
          priceVsSegmentScore * weights.priceVsSegment +
          components.priceEvaluation * weights.priceEvaluation +
          components.mileageQuality * weights.mileageQuality +
          components.pricePerKm * weights.pricePerKm;

        // Add price drop bonus (up to 10 extra points)
        const priceDropBonus = (priceDropScore / 100) * 10;
        const totalScore = Math.min(100, baseScore + priceDropBonus);

        // Build breakdown
        const breakdown = {
          priceVsSegment: {
            score: priceVsSegmentScore,
            weight: weights.priceVsSegment,
          },
          priceEvaluation: {
            score: components.priceEvaluation,
            weight: weights.priceEvaluation,
            value: listing.priceEvaluation || "UNKNOWN",
          },
          mileageQuality: {
            score: components.mileageQuality,
            weight: weights.mileageQuality,
            value: listing.mileage,
            fuelType: listing.fuelType,
          },
          pricePerKm: {
            score: components.pricePerKm,
            weight: weights.pricePerKm,
            value:
              listing.mileage && listing.mileage > 0
                ? Math.round((listing.price / listing.mileage) * 100) / 100
                : null,
          },
          priceDropBonus: {
            score: priceDropScore,
            bonus: priceDropBonus,
          },
        };

        await db
          .update(listings)
          .set({
            dealScore: Math.round(totalScore * 10) / 10,
            scoreBreakdown: JSON.stringify(breakdown),
          })
          .where(eq(listings.id, listing.id));

        updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      updatedCount,
      weights,
      message: `Recalculated scores for ${updatedCount.toLocaleString()} listings`,
    });
  } catch (error) {
    console.error("Error recalculating scores:", error);
    return NextResponse.json(
      { error: "Failed to recalculate scores" },
      { status: 500 }
    );
  }
}
