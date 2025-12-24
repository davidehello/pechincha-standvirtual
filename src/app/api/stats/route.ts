import { NextResponse } from "next/server";
import { getSupabase, TListing, TScrapeRun, convertScrapeRun } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabase();

    // Get total and active listings count with price evaluation breakdown
    const { data: allListings, error: listingsError } = await supabase
      .from('listings')
      .select('is_active, price_evaluation');

    if (listingsError) throw listingsError;

    const total = allListings?.length ?? 0;
    const active = allListings?.filter((l: Partial<TListing>) => l.is_active === true).length ?? 0;
    const belowMarket = allListings?.filter((l: Partial<TListing>) => l.price_evaluation === 'BELOW' && l.is_active === true).length ?? 0;
    const inMarket = allListings?.filter((l: Partial<TListing>) => l.price_evaluation === 'IN' && l.is_active === true).length ?? 0;
    const aboveMarket = allListings?.filter((l: Partial<TListing>) => l.price_evaluation === 'ABOVE' && l.is_active === true).length ?? 0;

    // Get top makes
    const { data: activeListings, error: activeError } = await supabase
      .from('listings')
      .select('make')
      .eq('is_active', true);

    if (activeError) throw activeError;

    const makeCounts = (activeListings || []).reduce((acc: Record<string, number>, l: { make: string }) => {
      acc[l.make] = (acc[l.make] || 0) + 1;
      return acc;
    }, {});

    const topMakes = Object.entries(makeCounts)
      .map(([make, count]) => ({ make, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get last scrape run
    const { data: lastRunData, error: lastRunError } = await supabase
      .from('scrape_runs')
      .select('*')
      .order('id', { ascending: false })
      .limit(1);

    if (lastRunError) throw lastRunError;

    // Get scrape history (last 20 runs)
    const { data: scrapeHistoryData, error: historyError } = await supabase
      .from('scrape_runs')
      .select('*')
      .order('id', { ascending: false })
      .limit(20);

    if (historyError) throw historyError;

    // Get unique makes for filters
    const uniqueMakes = [...new Set((activeListings || []).map((l: { make: string }) => l.make))].filter(Boolean).sort();

    // Get unique models for filters
    const { data: modelsData, error: modelsError } = await supabase
      .from('listings')
      .select('model')
      .eq('is_active', true);

    if (modelsError) throw modelsError;

    const uniqueModels = [...new Set((modelsData || []).map((l: { model: string }) => l.model))].filter(Boolean).sort();

    // Get unique regions for filters
    const { data: regionsData, error: regionsError } = await supabase
      .from('listings')
      .select('region')
      .eq('is_active', true);

    if (regionsError) throw regionsError;

    const uniqueRegions = [...new Set((regionsData || []).map((l: { region: string | null }) => l.region))].filter(Boolean).sort();

    return NextResponse.json({
      totalListings: total,
      activeListings: active,
      belowMarketCount: belowMarket,
      inMarketCount: inMarket,
      aboveMarketCount: aboveMarket,
      topMakes,
      lastScrapeRun: lastRunData?.[0] ? convertScrapeRun(lastRunData[0] as TScrapeRun) : null,
      scrapeHistory: (scrapeHistoryData || []).map((run: TScrapeRun) => convertScrapeRun(run)),
      filterOptions: {
        makes: uniqueMakes,
        models: uniqueModels,
        regions: uniqueRegions,
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
