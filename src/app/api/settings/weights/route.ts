import { NextRequest, NextResponse } from "next/server";
import { db, settings } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { DEFAULT_WEIGHTS } from "@/types";

const WeightsSchema = z.object({
  weights: z.object({
    priceVsSegment: z.number().min(0).max(1),
    priceEvaluation: z.number().min(0).max(1),
    mileageQuality: z.number().min(0).max(1),
    pricePerKm: z.number().min(0).max(1),
  }),
});

export async function GET() {
  try {
    const result = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "algorithm_weights"))
      .limit(1);

    if (result.length > 0 && result[0].value) {
      return NextResponse.json({
        weights: JSON.parse(result[0].value),
      });
    }

    return NextResponse.json({ weights: DEFAULT_WEIGHTS });
  } catch (error) {
    console.error("Error fetching weights:", error);
    return NextResponse.json({ weights: DEFAULT_WEIGHTS });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { weights } = WeightsSchema.parse(body);

    // Validate total is approximately 1
    const total =
      weights.priceVsSegment +
      weights.priceEvaluation +
      weights.mileageQuality +
      weights.pricePerKm;

    if (Math.abs(total - 1) > 0.01) {
      return NextResponse.json(
        { error: "Weights must add up to 100%" },
        { status: 400 }
      );
    }

    const now = new Date();

    // Check if setting exists
    const existing = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "algorithm_weights"))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(settings)
        .set({
          value: JSON.stringify(weights),
          updatedAt: now,
        })
        .where(eq(settings.key, "algorithm_weights"));
    } else {
      await db.insert(settings).values({
        key: "algorithm_weights",
        value: JSON.stringify(weights),
        updatedAt: now,
      });
    }

    return NextResponse.json({ success: true, weights });
  } catch (error) {
    console.error("Error saving weights:", error);
    return NextResponse.json(
      { error: "Failed to save weights" },
      { status: 500 }
    );
  }
}
