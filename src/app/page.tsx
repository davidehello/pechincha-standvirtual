"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout";
import { DealGrid } from "@/components/deals";
import { FilterPanel } from "@/components/search";
import { Button } from "@/components/ui";
import { TListing, TFilterOptions, TSortOption } from "@/types";

interface Stats {
  activeListings: number;
  belowMarketCount: number;
  filterOptions: {
    makes: string[];
    models: string[];
    regions: string[];
  };
  lastScrapeRun?: {
    completedAt: string | null;
    status: string;
    listingsFound: number;
  } | null;
}

export default function HomePage() {
  const [deals, setDeals] = useState<TListing[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filters, setFilters] = useState<TFilterOptions>({});
  const [sort, setSort] = useState<TSortOption>("score_desc");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Fetch stats on mount
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/stats");
        const data = await res.json();
        setStats(data);
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      }
    }
    fetchStats();
  }, []);

  // Fetch deals
  const fetchDeals = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("sort", sort);

      if (filters.priceMin) params.set("priceMin", filters.priceMin.toString());
      if (filters.priceMax) params.set("priceMax", filters.priceMax.toString());
      if (filters.yearMin) params.set("yearMin", filters.yearMin.toString());
      if (filters.yearMax) params.set("yearMax", filters.yearMax.toString());
      if (filters.mileageMin)
        params.set("mileageMin", filters.mileageMin.toString());
      if (filters.mileageMax)
        params.set("mileageMax", filters.mileageMax.toString());
      if (filters.minDealScore)
        params.set("minDealScore", filters.minDealScore.toString());
      if (filters.makes?.length)
        params.set("makes", filters.makes.join(","));
      if (filters.models?.length)
        params.set("models", filters.models.join(","));
      if (filters.fuelTypes?.length)
        params.set("fuelTypes", filters.fuelTypes.join(","));
      if (filters.gearboxTypes?.length)
        params.set("gearboxTypes", filters.gearboxTypes.join(","));
      if (filters.regions?.length)
        params.set("regions", filters.regions.join(","));
      if (filters.priceEvaluations?.length)
        params.set("priceEvaluations", filters.priceEvaluations.join(","));

      const res = await fetch(`/api/deals?${params}`);
      const data = await res.json();

      if (page === 1) {
        setDeals(data.deals);
      } else {
        setDeals((prev) => [...prev, ...data.deals]);
      }
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch (error) {
      console.error("Failed to fetch deals:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, sort, filters]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  // Reset page when filters change
  const handleFiltersChange = useCallback((newFilters: TFilterOptions) => {
    setFilters(newFilters);
    setPage(1);
  }, []);

  const handleSortChange = useCallback((newSort: TSortOption) => {
    setSort(newSort);
    setPage(1);
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({});
    setPage(1);
  }, []);

  const loadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      setPage((p) => p + 1);
    }
  }, [hasMore, isLoading]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="flex">
        {/* Filter sidebar - desktop */}
        <aside className="hidden lg:block w-72 shrink-0 border-r border-border p-4 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
          <FilterPanel
            filters={filters}
            onChange={handleFiltersChange}
            onReset={handleResetFilters}
            makes={stats?.filterOptions.makes ?? []}
            models={stats?.filterOptions.models ?? []}
            regions={stats?.filterOptions.regions ?? []}
          />
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Header bar */}
          <div className="sticky top-14 z-40 bg-background border-b border-border px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {/* Mobile filter toggle */}
                <Button
                  variant="secondary"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                >
                  Filters
                </Button>

                {/* Results count */}
                <span className="text-sm text-muted-foreground">
                  {total.toLocaleString()} deals
                </span>

                {/* Last scraped indicator */}
                {stats?.lastScrapeRun?.completedAt && (
                  <span className="text-xs text-muted-foreground hidden sm:inline-flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                      <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
                    </svg>
                    Updated {new Date(stats.lastScrapeRun.completedAt).toLocaleString("pt-PT", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </span>
                )}
              </div>

              {/* Sort dropdown */}
              <select
                value={sort}
                onChange={(e) => handleSortChange(e.target.value as TSortOption)}
                className="px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="score_desc">Best Score</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="year_desc">Year: Newest</option>
                <option value="year_asc">Year: Oldest</option>
                <option value="mileage_asc">Mileage: Lowest</option>
                <option value="mileage_desc">Mileage: Highest</option>
              </select>
            </div>
          </div>

          {/* Mobile filter panel */}
          {isFilterOpen && (
            <div className="lg:hidden border-b border-border p-4 bg-card">
              <FilterPanel
                filters={filters}
                onChange={handleFiltersChange}
                onReset={handleResetFilters}
                makes={stats?.filterOptions.makes ?? []}
                models={stats?.filterOptions.models ?? []}
                regions={stats?.filterOptions.regions ?? []}
              />
            </div>
          )}

          {/* Deals grid */}
          <div className="p-4">
            <DealGrid listings={deals} isLoading={isLoading && page === 1} />

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center mt-8">
                <Button
                  variant="secondary"
                  onClick={loadMore}
                  isLoading={isLoading && page > 1}
                >
                  Load More
                </Button>
              </div>
            )}

            {/* Empty state when no database */}
            {!isLoading && deals.length === 0 && (
              <div className="text-center py-12">
                <h2 className="text-xl font-semibold mb-2">No deals found</h2>
                <p className="text-muted-foreground mb-4">
                  Run the scraper to fetch listings from StandVirtual.
                </p>
                <Button onClick={() => (window.location.href = "/admin")}>
                  Go to Admin
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
