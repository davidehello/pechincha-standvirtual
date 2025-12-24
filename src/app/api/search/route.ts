import { NextRequest, NextResponse } from "next/server";
import { getSupabase, TListing, convertListing } from "@/lib/supabase";
import { z } from "zod";

const QuerySchema = z.object({
  q: z.string().optional(),
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
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());
    const query = QuerySchema.parse(params);

    const supabase = getSupabase();

    // Build the query
    let listingsQuery = supabase.from('listings').select('*', { count: 'exact' });

    // Always filter for active listings
    listingsQuery = listingsQuery.eq('is_active', true);

    // Text search using ilike for case-insensitive partial matching
    if (query.q) {
      listingsQuery = listingsQuery.or(
        `title.ilike.%${query.q}%,make.ilike.%${query.q}%,model.ilike.%${query.q}%,version.ilike.%${query.q}%`
      );
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

    return NextResponse.json({
      deals: (deals || []).map((d: TListing) => convertListing(d)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      hasMore: query.page * query.pageSize < total,
    });
  } catch (error) {
    console.error("Error searching deals:", error);
    return NextResponse.json(
      { error: "Failed to search deals" },
      { status: 500 }
    );
  }
}
