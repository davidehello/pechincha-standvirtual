import { NextResponse } from "next/server";
import { db, listings, scrapeRuns } from "@/lib/db";
import { sql, desc, eq } from "drizzle-orm";

export async function GET() {
  try {
    // Get total and active listings count
    const countResult = await db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`sum(case when ${listings.isActive} = true then 1 else 0 end)`,
        belowMarket: sql<number>`sum(case when ${listings.priceEvaluation} = 'BELOW' and ${listings.isActive} = true then 1 else 0 end)`,
        inMarket: sql<number>`sum(case when ${listings.priceEvaluation} = 'IN' and ${listings.isActive} = true then 1 else 0 end)`,
        aboveMarket: sql<number>`sum(case when ${listings.priceEvaluation} = 'ABOVE' and ${listings.isActive} = true then 1 else 0 end)`,
      })
      .from(listings);

    // Get top makes
    const topMakes = await db
      .select({
        make: listings.make,
        count: sql<number>`count(*)`,
      })
      .from(listings)
      .where(eq(listings.isActive, true))
      .groupBy(listings.make)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    // Get last scrape run
    const lastRun = await db
      .select()
      .from(scrapeRuns)
      .orderBy(desc(scrapeRuns.id))
      .limit(1);

    // Get scrape history (last 20 runs)
    const scrapeHistory = await db
      .select()
      .from(scrapeRuns)
      .orderBy(desc(scrapeRuns.id))
      .limit(20);

    // Get unique makes for filters
    const makes = await db
      .select({ make: listings.make })
      .from(listings)
      .where(eq(listings.isActive, true))
      .groupBy(listings.make)
      .orderBy(listings.make);

    // Get unique models for filters
    const models = await db
      .select({ model: listings.model })
      .from(listings)
      .where(eq(listings.isActive, true))
      .groupBy(listings.model)
      .orderBy(listings.model);

    // Get unique regions for filters
    const regions = await db
      .select({ region: listings.region })
      .from(listings)
      .where(eq(listings.isActive, true))
      .groupBy(listings.region)
      .orderBy(listings.region);

    const stats = countResult[0];

    return NextResponse.json({
      totalListings: stats?.total ?? 0,
      activeListings: stats?.active ?? 0,
      belowMarketCount: stats?.belowMarket ?? 0,
      inMarketCount: stats?.inMarket ?? 0,
      aboveMarketCount: stats?.aboveMarket ?? 0,
      topMakes,
      lastScrapeRun: lastRun[0] ?? null,
      scrapeHistory,
      filterOptions: {
        makes: makes.map((m) => m.make).filter(Boolean),
        models: models.map((m) => m.model).filter(Boolean),
        regions: regions.map((r) => r.region).filter(Boolean),
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
