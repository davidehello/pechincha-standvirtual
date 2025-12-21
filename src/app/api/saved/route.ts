import { NextRequest, NextResponse } from "next/server";
import { db, savedDeals, listings } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

export async function GET() {
  try {
    const saved = await db
      .select({
        savedDeal: savedDeals,
        listing: listings,
      })
      .from(savedDeals)
      .innerJoin(listings, eq(savedDeals.listingId, listings.id))
      .orderBy(desc(savedDeals.savedAt));

    const deals = saved.map((s) => s.listing);

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
    const body = await request.json();
    const { listingId, notes } = SaveDealSchema.parse(body);

    // Check if already saved
    const existing = await db
      .select()
      .from(savedDeals)
      .where(eq(savedDeals.listingId, listingId))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ error: "Already saved" }, { status: 400 });
    }

    await db.insert(savedDeals).values({
      listingId,
      notes,
      savedAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving deal:", error);
    return NextResponse.json({ error: "Failed to save deal" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get("listingId");

    if (!listingId) {
      return NextResponse.json(
        { error: "listingId required" },
        { status: 400 }
      );
    }

    await db.delete(savedDeals).where(eq(savedDeals.listingId, listingId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing saved deal:", error);
    return NextResponse.json(
      { error: "Failed to remove deal" },
      { status: 500 }
    );
  }
}
