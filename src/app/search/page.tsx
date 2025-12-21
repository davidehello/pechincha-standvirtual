"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout";
import { DealGrid } from "@/components/deals";
import { FilterPanel } from "@/components/search";
import { Button } from "@/components/ui";
import { TListing, TFilterOptions, TSortOption } from "@/types";

interface Stats {
  filterOptions: {
    makes: string[];
    models: string[];
    regions: string[];
  };
}

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [deals, setDeals] = useState<TListing[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [filters, setFilters] = useState<TFilterOptions>({});
  const [sort, setSort] = useState<TSortOption>("score_desc");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
      if (query) params.set("q", query);

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

      const res = await fetch(`/api/search?${params}`);
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
  }, [page, sort, query, filters]);

  // Initial search from URL
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) {
      setQuery(q);
    }
  }, [searchParams]);

  // Fetch when params change
  useEffect(() => {
    if (query || Object.keys(filters).length > 0) {
      fetchDeals();
    }
  }, [fetchDeals, query, filters]);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setPage(1);
      router.push(`/search?q=${encodeURIComponent(query)}`);
      fetchDeals();
    },
    [query, router, fetchDeals]
  );

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
        {/* Search bar */}
        <div className="sticky top-14 z-40 bg-background border-b border-border px-4 py-3">
          <form onSubmit={handleSearch} className="flex gap-2 mb-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, make, or model..."
              className="flex-1 px-4 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button type="submit">Search</Button>
          </form>

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
                {total.toLocaleString()} results
              </span>
            </div>

            {/* Sort dropdown */}
            <select
              value={sort}
              onChange={(e) =>
                handleSortChange(e.target.value as TSortOption)
              }
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
          {!query && Object.keys(filters).length === 0 ? (
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold mb-2">Search for deals</h2>
              <p className="text-muted-foreground">
                Enter a search term or apply filters to find deals.
              </p>
            </div>
          ) : (
            <>
              <DealGrid
                listings={deals}
                isLoading={isLoading && page === 1}
              />

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
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        }
      >
        <SearchContent />
      </Suspense>
    </div>
  );
}
