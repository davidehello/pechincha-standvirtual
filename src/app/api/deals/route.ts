import { NextRequest, NextResponse } from "next/server";
import { db, listings } from "@/lib/db";
import { and, gte, lte, inArray, desc, asc, sql } from "drizzle-orm";
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
  hideUnavailable: z.coerce.boolean().default(true),  // Default to hiding unavailable
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());
    const query = QuerySchema.parse(params);

    // Build conditions
    const conditions = [];

    // Filter by availability (hide unavailable by default)
    if (query.hideUnavailable) {
      conditions.push(sql`${listings.isActive} = 1`);
    }

    if (query.priceMin) {
      conditions.push(gte(listings.price, query.priceMin));
    }
    if (query.priceMax) {
      conditions.push(lte(listings.price, query.priceMax));
    }
    if (query.yearMin) {
      conditions.push(gte(listings.year, query.yearMin));
    }
    if (query.yearMax) {
      conditions.push(lte(listings.year, query.yearMax));
    }
    if (query.mileageMin) {
      conditions.push(gte(listings.mileage, query.mileageMin));
    }
    if (query.mileageMax) {
      conditions.push(lte(listings.mileage, query.mileageMax));
    }
    if (query.minDealScore) {
      conditions.push(gte(listings.dealScore, query.minDealScore));
    }
    if (query.makes) {
      conditions.push(inArray(listings.make, query.makes.split(",")));
    }
    if (query.models) {
      conditions.push(inArray(listings.model, query.models.split(",")));
    }
    if (query.fuelTypes) {
      conditions.push(inArray(listings.fuelType, query.fuelTypes.split(",")));
    }
    if (query.gearboxTypes) {
      conditions.push(inArray(listings.gearbox, query.gearboxTypes.split(",")));
    }
    if (query.regions) {
      conditions.push(inArray(listings.region, query.regions.split(",")));
    }
    if (query.priceEvaluations) {
      conditions.push(
        inArray(listings.priceEvaluation, query.priceEvaluations.split(","))
      );
    }

    // Build sort order
    let orderBy;
    switch (query.sort) {
      case "score_desc":
        orderBy = desc(listings.dealScore);
        break;
      case "price_asc":
        orderBy = asc(listings.price);
        break;
      case "price_desc":
        orderBy = desc(listings.price);
        break;
      case "year_desc":
        orderBy = desc(listings.year);
        break;
      case "year_asc":
        orderBy = asc(listings.year);
        break;
      case "mileage_asc":
        orderBy = asc(listings.mileage);
        break;
      case "mileage_desc":
        orderBy = desc(listings.mileage);
        break;
      default:
        orderBy = desc(listings.dealScore);
    }

    // Build where clause (handle empty conditions)
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(listings)
      .where(whereClause);

    const total = countResult[0]?.count ?? 0;

    // Get deals
    const deals = await db
      .select()
      .from(listings)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);

    return NextResponse.json({
      deals,
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
