import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    const { data: history, error } = await supabase
      .from('price_history')
      .select('id, price, recorded_at')
      .eq('listing_id', id)
      .order('recorded_at', { ascending: false });

    if (error) throw error;

    // Calculate price changes
    const historyWithChanges = (history || []).map((record: { id: number; price: number; recorded_at: string | null }, index: number) => {
      const nextRecord = (history || [])[index + 1] as { id: number; price: number; recorded_at: string | null } | undefined;
      let changePercent: number | null = null;
      let changeAmount: number | null = null;

      if (nextRecord) {
        changeAmount = record.price - nextRecord.price;
        changePercent = ((record.price - nextRecord.price) / nextRecord.price) * 100;
      }

      return {
        id: record.id,
        price: record.price,
        recordedAt: record.recorded_at,
        changeAmount,
        changePercent,
      };
    });

    const historyArr = history || [];
    return NextResponse.json({
      listingId: id,
      priceHistory: historyWithChanges,
      hasPriceChanges: historyArr.length > 1,
      totalChange: historyArr.length > 1
        ? {
            amount: historyArr[0].price - historyArr[historyArr.length - 1].price,
            percent: ((historyArr[0].price - historyArr[historyArr.length - 1].price) / historyArr[historyArr.length - 1].price) * 100
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
