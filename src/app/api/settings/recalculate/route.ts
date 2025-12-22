import { NextResponse } from "next/server";
import { db, listings, settings } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { TAlgorithmWeights, DEFAULT_WEIGHTS } from "@/types";

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

// Calculate scores for Price vs Segment (compare to similar vehicles)
async function calculatePriceVsSegmentScores(): Promise<Map<string, number>> {
  const scores = new Map<string, number>();

  // Get min/max prices per segment (make, model, fuel, year range)
  const segmentStats = await db
    .select({
      make: listings.make,
      model: listings.model,
      fuelType: listings.fuelType,
      yearGroup: sql<number>`(${listings.year} / 3) * 3`, // Group by 3-year ranges
      minPrice: sql<number>`min(${listings.price})`,
      maxPrice: sql<number>`max(${listings.price})`,
    })
    .from(listings)
    .where(eq(listings.isActive, true))
    .groupBy(
      listings.make,
      listings.model,
      listings.fuelType,
      sql`(${listings.year} / 3) * 3`
    );

  // Create lookup map
  const segmentMap = new Map<string, { min: number; max: number }>();
  for (const seg of segmentStats) {
    const key = `${seg.make}|${seg.model}|${seg.fuelType}|${seg.yearGroup}`;
    segmentMap.set(key, { min: seg.minPrice, max: seg.maxPrice });
  }

  // Get all active listings
  const allListings = await db
    .select({
      id: listings.id,
      make: listings.make,
      model: listings.model,
      fuelType: listings.fuelType,
      year: listings.year,
      price: listings.price,
    })
    .from(listings)
    .where(eq(listings.isActive, true));

  // Calculate score for each listing
  for (const listing of allListings) {
    const yearGroup = Math.floor(listing.year / 3) * 3;
    const key = `${listing.make}|${listing.model}|${listing.fuelType}|${yearGroup}`;
    const segment = segmentMap.get(key);

    let score = 50; // Default
    if (segment && segment.max > segment.min) {
      // Lower price = higher score (100 at min, 0 at max)
      const position =
        (listing.price - segment.min) / (segment.max - segment.min);
      score = Math.round((1 - position) * 100);
    }

    scores.set(listing.id, Math.max(0, Math.min(100, score)));
  }

  return scores;
}

// Calculate individual component scores
function calculateComponentScores(listing: {
  priceEvaluation: string | null;
  year: number;
  mileage: number | null;
  price: number;
}): {
  priceEvaluation: number;
  mileageQuality: number;
  pricePerKm: number;
} {
  const currentYear = new Date().getFullYear();

  // Price Evaluation Score
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

  // Mileage Quality Score
  let mileageQualityScore = 50;
  if (listing.year && listing.mileage) {
    const carAge = Math.max(1, currentYear - listing.year);
    const expectedMileage = carAge * 15000;
    const mileageRatio =
      expectedMileage > 0 ? listing.mileage / expectedMileage : 1;

    if (mileageRatio <= 0.5) {
      mileageQualityScore = 100;
    } else if (mileageRatio <= 0.75) {
      mileageQualityScore = 85;
    } else if (mileageRatio <= 1.0) {
      mileageQualityScore = 70;
    } else if (mileageRatio <= 1.25) {
      mileageQualityScore = 50;
    } else if (mileageRatio <= 1.5) {
      mileageQualityScore = 30;
    } else {
      mileageQualityScore = 10;
    }
  }

  // Price per Km Score
  let pricePerKmScore = 50;
  if (listing.mileage && listing.mileage > 0) {
    const pricePerKm = listing.price / listing.mileage;
    // Lower price per km is better
    // Typical range: 0.05€/km (great) to 0.50€/km (poor)
    if (pricePerKm <= 0.05) {
      pricePerKmScore = 100;
    } else if (pricePerKm <= 0.10) {
      pricePerKmScore = 85;
    } else if (pricePerKm <= 0.15) {
      pricePerKmScore = 70;
    } else if (pricePerKm <= 0.25) {
      pricePerKmScore = 50;
    } else if (pricePerKm <= 0.40) {
      pricePerKmScore = 30;
    } else {
      pricePerKmScore = 10;
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

    // Calculate price vs segment scores for all listings
    const priceVsSegmentScores = await calculatePriceVsSegmentScores();

    let updatedCount = 0;

    // Process in batches of 1000
    const batchSize = 1000;
    for (let i = 0; i < allListings.length; i += batchSize) {
      const batch = allListings.slice(i, i + batchSize);

      for (const listing of batch) {
        // Get component scores
        const components = calculateComponentScores(listing);
        const priceVsSegmentScore = priceVsSegmentScores.get(listing.id) || 50;

        // Calculate weighted total score
        const totalScore =
          priceVsSegmentScore * weights.priceVsSegment +
          components.priceEvaluation * weights.priceEvaluation +
          components.mileageQuality * weights.mileageQuality +
          components.pricePerKm * weights.pricePerKm;

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
          },
          pricePerKm: {
            score: components.pricePerKm,
            weight: weights.pricePerKm,
            value:
              listing.mileage && listing.mileage > 0
                ? Math.round((listing.price / listing.mileage) * 100) / 100
                : null,
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
