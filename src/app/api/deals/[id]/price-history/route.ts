import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { priceHistory } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const history = await db
      .select({
        id: priceHistory.id,
        price: priceHistory.price,
        recordedAt: priceHistory.recordedAt,
      })
      .from(priceHistory)
      .where(eq(priceHistory.listingId, id))
      .orderBy(desc(priceHistory.recordedAt));

    // Calculate price changes
    const historyWithChanges = history.map((record, index) => {
      const nextRecord = history[index + 1]; // Previous in time (older)
      let changePercent: number | null = null;
      let changeAmount: number | null = null;

      if (nextRecord) {
        changeAmount = record.price - nextRecord.price;
        changePercent = ((record.price - nextRecord.price) / nextRecord.price) * 100;
      }

      return {
        ...record,
        changeAmount,
        changePercent,
      };
    });

    return NextResponse.json({
      listingId: id,
      priceHistory: historyWithChanges,
      hasPriceChanges: history.length > 1,
      totalChange: history.length > 1
        ? {
            amount: history[0].price - history[history.length - 1].price,
            percent: ((history[0].price - history[history.length - 1].price) / history[history.length - 1].price) * 100
          }
        : null
    });
  } catch (error) {
    console.error("Error fetching price history:", error);
    return NextResponse.json(
      { error: "Failed to fetch price history" },
      { status: 500 }
    );
  }
}
