import { NextRequest, NextResponse } from "next/server";
import { getSupabase, TListing, convertListing } from "@/lib/supabase";
import { z } from "zod";

export async function GET() {
  try {
    const supabase = getSupabase();

    // Get saved deals with listing info using a join
    const { data: savedData, error: savedError } = await supabase
      .from('saved_deals')
      .select(`
        id,
        listing_id,
        notes,
        saved_at,
        listings (*)
      `)
      .order('saved_at', { ascending: false });

    if (savedError) throw savedError;

    // Extract the listings - Supabase returns it as an array for many-to-one relations
    const deals = (savedData || [])
      .map((s: { listings: TListing | TListing[] | null }) => {
        // Handle both array and object formats
        if (Array.isArray(s.listings)) {
          return s.listings[0] || null;
        }
        return s.listings;
      })
      .filter((l): l is TListing => l !== null)
      .map((l: TListing) => convertListing(l));

    return NextResponse.json({ deals });
  } catch (error) {
    console.error("Error fetching saved deals:", error);
    return NextResponse.json({ deals: [] });
  }
}

const SaveDealSchema = z.object({
  listingId: z.string(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();
    const { listingId, notes } = SaveDealSchema.parse(body);

    // Check if already saved
    const { data: existing, error: existingError } = await supabase
      .from('saved_deals')
      .select('id')
      .eq('listing_id', listingId)
      .limit(1);

    if (existingError) throw existingError;

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: "Already saved" }, { status: 400 });
    }

    const { error: insertError } = await supabase
      .from('saved_deals')
      .insert({
        listing_id: listingId,
        notes,
        saved_at: new Date().toISOString(),
      });

    if (insertError) throw insertError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving deal:", error);
    return NextResponse.json({ error: "Failed to save deal" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get("listingId");

    if (!listingId) {
      return NextResponse.json(
        { error: "listingId required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('saved_deals')
      .delete()
      .eq('listing_id', listingId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing saved deal:", error);
    return NextResponse.json(
      { error: "Failed to remove deal" },
      { status: 500 }
    );
  }
}
