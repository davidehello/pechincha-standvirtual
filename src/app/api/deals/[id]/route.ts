import { NextRequest, NextResponse } from "next/server";
import { getSupabase, TListing, convertListing } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    const { data: result, error } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .limit(1);

    if (error) throw error;

    if (!result || result.length === 0) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    return NextResponse.json(convertListing(result[0] as TListing));
  } catch (error) {
    console.error("Error fetching deal:", error);
    return NextResponse.json(
      { error: "Failed to fetch deal" },
      { status: 500 }
    );
  }
}
