import { NextResponse } from "next/server";
import { getSupabase, TListing, TPriceHistory } from "@/lib/supabase";
import { TAlgorithmWeights, DEFAULT_WEIGHTS } from "@/types";

// Time decay configuration
const MAX_HISTORY_DAYS = 90;
const TIME_DECAY_WEIGHTS = {
  days_0_30: 1.0,
  days_30_60: 0.75,
  days_60_90: 0.5,
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
    const supabase = getSupabase();
    const { data: result, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'algorithm_weights')
      .limit(1);

    if (!error && result && result.length > 0 && result[0].value) {
      return JSON.parse(result[0].value);
    }
  } catch (error) {
    console.error("Error loading weights:", error);
  }
  return DEFAULT_WEIGHTS;
}

// Calculate time decay weight based on lastSeenAt date
function getTimeDecayWeight(lastSeenAt: string | null): number {
  if (!lastSeenAt) return 0;

  const now = new Date();
  const lastSeen = new Date(lastSeenAt);
  const daysDiff = Math.floor(
    (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysDiff < 0) return 1.0;
  if (daysDiff <= 30) return TIME_DECAY_WEIGHTS.days_0_30;
  if (daysDiff <= 60) return TIME_DECAY_WEIGHTS.days_30_60;
  if (daysDiff <= 90) return TIME_DECAY_WEIGHTS.days_60_90;
  return 0;
}

// Calculate weighted percentile for a price within a segment
function calculateWeightedPercentile(
  price: number,
  segmentPrices: Array<{ price: number; weight: number }>
): number {
  if (segmentPrices.length === 0) return 50;

  const sorted = [...segmentPrices].sort((a, b) => a.price - b.price);

  let totalWeight = 0;
  let belowWeight = 0;

  for (const item of sorted) {
    totalWeight += item.weight;
    if (item.price < price) {
      belowWeight += item.weight;
    } else if (item.price === price) {
      belowWeight += item.weight / 2;
    }
  }

  if (totalWeight === 0) return 50;

  const percentile = (belowWeight / totalWeight) * 100;
  return Math.round(100 - percentile);
}

// Calculate individual component scores with fuel-type adjusted mileage
function calculateComponentScores(listing: {
  price_evaluation: string | null;
  year: number;
  mileage: number | null;
  price: number;
  fuel_type: string | null;
}): {
  priceEvaluation: number;
  mileageQuality: number;
  pricePerKm: number;
} {
  const currentYear = new Date().getFullYear();

  // Price Evaluation Score
  const priceEval = (listing.price_evaluation || "").toUpperCase();
  let priceEvaluationScore: number;
  if (priceEval === "BELOW") {
    priceEvaluationScore = 100;
  } else if (priceEval === "IN") {
    priceEvaluationScore = 50;
  } else if (priceEval === "ABOVE") {
    priceEvaluationScore = 10;
  } else {
    priceEvaluationScore = 50;
  }

  // Mileage Quality Score
  let mileageQualityScore = 50;
  if (listing.year && listing.mileage) {
    const carAge = Math.max(1, currentYear - listing.year);
    const fuelType = (listing.fuel_type || "gasoline").toLowerCase();
    const expectedPerYear =
      EXPECTED_MILEAGE_PER_YEAR[fuelType] ||
      EXPECTED_MILEAGE_PER_YEAR["gasoline"];
    const expectedMileage = carAge * expectedPerYear;
    const mileageRatio =
      expectedMileage > 0 ? listing.mileage / expectedMileage : 1;

    if (mileageRatio <= 0.4) {
      mileageQualityScore = 100;
    } else if (mileageRatio <= 0.6) {
      mileageQualityScore = 90;
    } else if (mileageRatio <= 0.8) {
      mileageQualityScore = 80;
    } else if (mileageRatio <= 1.0) {
      mileageQualityScore = 70;
    } else if (mileageRatio <= 1.2) {
      mileageQualityScore = 55;
    } else if (mileageRatio <= 1.4) {
      mileageQualityScore = 40;
    } else if (mileageRatio <= 1.6) {
      mileageQualityScore = 25;
    } else {
      mileageQualityScore = 10;
    }
  }

  // Price per Km Score
  let pricePerKmScore = 50;
  if (listing.mileage && listing.mileage > 0) {
    const pricePerKm = listing.price / listing.mileage;
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
    const supabase = getSupabase();
    const weights = await loadWeights();

    // Get all listings (both active and recently inactive for segment comparison)
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000);

    const { data: allListings, error: listingsError } = await supabase
      .from('listings')
      .select('id, make, model, fuel_type, year, price, is_active, last_seen_at, price_evaluation, mileage')
      .or(`is_active.eq.true,last_seen_at.gte.${cutoffDate.toISOString()}`);

    if (listingsError) throw listingsError;

    // Get active listing IDs for price history
    const activeListings = (allListings || []).filter((l: Partial<TListing>) => l.is_active === true);
    const activeIds = activeListings.map((l: Partial<TListing>) => l.id as string);

    // Get price history for active listings
    const priceDropScores = new Map<string, number>();
    if (activeIds.length > 0) {
      const { data: priceHistoryData, error: priceError } = await supabase
        .from('price_history')
        .select('listing_id, price, recorded_at')
        .in('listing_id', activeIds)
        .order('recorded_at', { ascending: false });

      if (!priceError && priceHistoryData) {
        // Group by listing
        const pricesByListing = new Map<string, Array<{ price: number; recorded_at: string | null }>>();
        for (const record of priceHistoryData as TPriceHistory[]) {
          if (!pricesByListing.has(record.listing_id)) {
            pricesByListing.set(record.listing_id, []);
          }
          pricesByListing.get(record.listing_id)!.push({
            price: record.price,
            recorded_at: record.recorded_at,
          });
        }

        // Calculate price drop scores
        for (const [listingId, prices] of pricesByListing) {
          if (prices.length < 2) {
            priceDropScores.set(listingId, 0);
            continue;
          }

          const currentPrice = prices[0].price;
          const previousPrice = prices[1].price;
          const priceChange = ((currentPrice - previousPrice) / previousPrice) * 100;

          if (priceChange >= 0) {
            priceDropScores.set(listingId, 0);
            continue;
          }

          const dropPercent = Math.abs(priceChange);
          const recordedAt = prices[0].recorded_at;
          const daysSinceChange = recordedAt
            ? Math.floor((now.getTime() - new Date(recordedAt).getTime()) / (1000 * 60 * 60 * 24))
            : 30;

          let score = 0;
          if (dropPercent >= 20 && daysSinceChange <= 7) {
            score = 100;
          } else if (dropPercent >= 10 && daysSinceChange <= 14) {
            score = 80;
          } else if (dropPercent >= 5 && daysSinceChange <= 30) {
            score = 60;
          } else if (dropPercent > 0 && daysSinceChange <= 30) {
            score = 40;
          }

          priceDropScores.set(listingId, score);
        }
      }
    }

    // Calculate segment scores
    const segmentData = new Map<string, Array<{ price: number; weight: number; id: string; isActive: boolean }>>();

    for (const listing of allListings || []) {
      const yearGroup = Math.floor(listing.year / 3) * 3;
      const key = `${listing.make}|${listing.model}|${listing.fuel_type}|${yearGroup}`;

      const weight = listing.is_active ? 1.0 : getTimeDecayWeight(listing.last_seen_at);
      if (weight === 0) continue;

      if (!segmentData.has(key)) {
        segmentData.set(key, []);
      }
      segmentData.get(key)!.push({
        price: listing.price,
        weight,
        id: listing.id,
        isActive: listing.is_active ?? false,
      });
    }

    // Calculate and update scores for active listings
    let updatedCount = 0;
    const batchSize = 50;

    for (let i = 0; i < activeListings.length; i += batchSize) {
      const batch = activeListings.slice(i, i + batchSize);

      for (const listing of batch) {
        const yearGroup = Math.floor(listing.year / 3) * 3;
        const key = `${listing.make}|${listing.model}|${listing.fuel_type}|${yearGroup}`;
        const segmentPrices = segmentData.get(key) || [];

        const priceVsSegmentScore = calculateWeightedPercentile(listing.price, segmentPrices);
        const components = calculateComponentScores(listing as { price_evaluation: string | null; year: number; mileage: number | null; price: number; fuel_type: string | null });
        const priceDropScore = priceDropScores.get(listing.id) || 0;

        const baseScore =
          priceVsSegmentScore * weights.priceVsSegment +
          components.priceEvaluation * weights.priceEvaluation +
          components.mileageQuality * weights.mileageQuality +
          components.pricePerKm * weights.pricePerKm;

        const priceDropBonus = (priceDropScore / 100) * 10;
        const totalScore = Math.min(100, baseScore + priceDropBonus);

        const breakdown = {
          priceVsSegment: { score: priceVsSegmentScore, weight: weights.priceVsSegment },
          priceEvaluation: { score: components.priceEvaluation, weight: weights.priceEvaluation, value: listing.price_evaluation || "UNKNOWN" },
          mileageQuality: { score: components.mileageQuality, weight: weights.mileageQuality, value: listing.mileage, fuelType: listing.fuel_type },
          pricePerKm: { score: components.pricePerKm, weight: weights.pricePerKm, value: listing.mileage && listing.mileage > 0 ? Math.round((listing.price / listing.mileage) * 100) / 100 : null },
          priceDropBonus: { score: priceDropScore, bonus: priceDropBonus },
        };

        const { error: updateError } = await supabase
          .from('listings')
          .update({
            deal_score: Math.round(totalScore * 10) / 10,
            score_breakdown: JSON.stringify(breakdown),
          })
          .eq('id', listing.id);

        if (!updateError) updatedCount++;
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
