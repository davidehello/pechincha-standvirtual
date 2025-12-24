import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
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
    const supabase = getSupabase();

    const { data: result, error } = await supabase
      .from('settings')
      .select('*')
      .eq('key', 'algorithm_weights')
      .limit(1);

    if (error) throw error;

    if (result && result.length > 0 && result[0].value) {
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
    const supabase = getSupabase();
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

    const now = new Date().toISOString();

    // Check if setting exists
    const { data: existing, error: existingError } = await supabase
      .from('settings')
      .select('id')
      .eq('key', 'algorithm_weights')
      .limit(1);

    if (existingError) throw existingError;

    if (existing && existing.length > 0) {
      const { error: updateError } = await supabase
        .from('settings')
        .update({
          value: JSON.stringify(weights),
          updated_at: now,
        })
        .eq('key', 'algorithm_weights');

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from('settings')
        .insert({
          key: 'algorithm_weights',
          value: JSON.stringify(weights),
          updated_at: now,
        });

      if (insertError) throw insertError;
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
