import { NextRequest, NextResponse } from "next/server";
import { getSupabase, TListing, TPriceHistory, convertListing } from "@/lib/supabase";
import { z } from "zod";

const QuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(24),
  sort: z
    .enum([
      "score_desc",
      "price_asc",
      "price_desc",
      "year_desc",
      "year_asc",
      "mileage_asc",
      "mileage_desc",
    ])
    .default("score_desc"),
  priceMin: z.coerce.number().optional(),
  priceMax: z.coerce.number().optional(),
  yearMin: z.coerce.number().optional(),
  yearMax: z.coerce.number().optional(),
  mileageMin: z.coerce.number().optional(),
  mileageMax: z.coerce.number().optional(),
  minDealScore: z.coerce.number().optional(),
  makes: z.string().optional(),
  models: z.string().optional(),
  fuelTypes: z.string().optional(),
  gearboxTypes: z.string().optional(),
  regions: z.string().optional(),
  priceEvaluations: z.string().optional(),
  hideUnavailable: z.coerce.boolean().default(true),
  priceChanged: z.coerce.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());
    const query = QuerySchema.parse(params);

    const supabase = getSupabase();

    // If filtering by price changed, first get listing IDs with price changes
    let priceChangedListingIds: string[] | null = null;
    if (query.priceChanged) {
      // Get listings that have more than one price history entry (meaning price changed)
      const { data: priceHistoryData, error: phError } = await supabase
        .from('price_history')
        .select('listing_id');

      if (!phError && priceHistoryData) {
        // Count occurrences of each listing_id
        const countMap = new Map<string, number>();
        for (const record of priceHistoryData) {
          countMap.set(record.listing_id, (countMap.get(record.listing_id) || 0) + 1);
        }
        // Get IDs with more than 1 entry
        priceChangedListingIds = Array.from(countMap.entries())
          .filter(([, count]) => count > 1)
          .map(([id]) => id);
      }
    }

    // Build the query
    let listingsQuery = supabase.from('listings').select('*', { count: 'exact' });

    // Filter by price changed listing IDs
    if (query.priceChanged && priceChangedListingIds !== null) {
      if (priceChangedListingIds.length === 0) {
        // No listings with price changes, return empty
        return NextResponse.json({
          deals: [],
          total: 0,
          page: query.page,
          pageSize: query.pageSize,
          hasMore: false,
        });
      }
      listingsQuery = listingsQuery.in('id', priceChangedListingIds);
    }

    // Filter by availability
    if (query.hideUnavailable) {
      listingsQuery = listingsQuery.eq('is_active', true);
    }

    // Apply filters
    if (query.priceMin) {
      listingsQuery = listingsQuery.gte('price', query.priceMin);
    }
    if (query.priceMax) {
      listingsQuery = listingsQuery.lte('price', query.priceMax);
    }
    if (query.yearMin) {
      listingsQuery = listingsQuery.gte('year', query.yearMin);
    }
    if (query.yearMax) {
      listingsQuery = listingsQuery.lte('year', query.yearMax);
    }
    if (query.mileageMin) {
      listingsQuery = listingsQuery.gte('mileage', query.mileageMin);
    }
    if (query.mileageMax) {
      listingsQuery = listingsQuery.lte('mileage', query.mileageMax);
    }
    if (query.minDealScore) {
      listingsQuery = listingsQuery.gte('deal_score', query.minDealScore);
    }
    if (query.makes) {
      listingsQuery = listingsQuery.in('make', query.makes.split(','));
    }
    if (query.models) {
      listingsQuery = listingsQuery.in('model', query.models.split(','));
    }
    if (query.fuelTypes) {
      listingsQuery = listingsQuery.in('fuel_type', query.fuelTypes.split(','));
    }
    if (query.gearboxTypes) {
      listingsQuery = listingsQuery.in('gearbox', query.gearboxTypes.split(','));
    }
    if (query.regions) {
      listingsQuery = listingsQuery.in('region', query.regions.split(','));
    }
    if (query.priceEvaluations) {
      listingsQuery = listingsQuery.in('price_evaluation', query.priceEvaluations.split(','));
    }

    // Apply sorting
    const sortColumn = (() => {
      switch (query.sort) {
        case 'score_desc': return { column: 'deal_score', ascending: false };
        case 'price_asc': return { column: 'price', ascending: true };
        case 'price_desc': return { column: 'price', ascending: false };
        case 'year_desc': return { column: 'year', ascending: false };
        case 'year_asc': return { column: 'year', ascending: true };
        case 'mileage_asc': return { column: 'mileage', ascending: true };
        case 'mileage_desc': return { column: 'mileage', ascending: false };
        default: return { column: 'deal_score', ascending: false };
      }
    })();

    listingsQuery = listingsQuery
      .order(sortColumn.column, { ascending: sortColumn.ascending, nullsFirst: false })
      .range((query.page - 1) * query.pageSize, query.page * query.pageSize - 1);

    const { data: deals, count, error } = await listingsQuery;

    if (error) throw error;

    const total = count ?? 0;
    const dealIds = (deals || []).map((d: TListing) => d.id);

    // Get price history for deals
    const priceChangeMap = new Map<string, {
      hasPriceChanges: boolean;
      priceChangePercent: number | null;
      priceChangeAmount: number | null;
      previousPrice: number | null;
    }>();

    if (dealIds.length > 0) {
      const { data: priceHistoryData, error: priceError } = await supabase
        .from('price_history')
        .select('*')
        .in('listing_id', dealIds)
        .order('recorded_at', { ascending: false });

      if (!priceError && priceHistoryData) {
        // Group by listing_id
        const pricesByListing = new Map<string, TPriceHistory[]>();
        for (const record of priceHistoryData as TPriceHistory[]) {
          if (!pricesByListing.has(record.listing_id)) {
            pricesByListing.set(record.listing_id, []);
          }
          pricesByListing.get(record.listing_id)!.push(record);
        }

        // Calculate price changes
        for (const [listingId, prices] of pricesByListing) {
          if (prices.length >= 2) {
            const currentPrice = prices[0].price;
            const previousPrice = prices[1].price;
            const changeAmount = currentPrice - previousPrice;
            const changePercent = (changeAmount / previousPrice) * 100;

            priceChangeMap.set(listingId, {
              hasPriceChanges: true,
              priceChangePercent: changePercent,
              priceChangeAmount: changeAmount,
              previousPrice: previousPrice,
            });
          }
        }
      }
    }

    // Enrich deals with price change info and convert to camelCase
    const enrichedDeals = (deals || []).map((deal: TListing) => ({
      ...convertListing(deal),
      priceInfo: priceChangeMap.get(deal.id) || {
        hasPriceChanges: false,
        priceChangePercent: null,
        priceChangeAmount: null,
        previousPrice: null,
      },
    }));

    return NextResponse.json({
      deals: enrichedDeals,
      total,
      page: query.page,
      pageSize: query.pageSize,
      hasMore: query.page * query.pageSize < total,
    });
  } catch (error) {
    console.error("Error fetching deals:", error);
    return NextResponse.json(
      { error: "Failed to fetch deals" },
      { status: 500 }
    );
  }
}
