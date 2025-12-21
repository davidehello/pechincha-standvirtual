"use client";

import { TListing } from "@/types";
import { DealCard } from "./DealCard";

interface DealGridProps {
  listings: TListing[];
  savedIds?: Set<string>;
  onSave?: (id: string) => void;
  isLoading?: boolean;
}

export function DealGrid({
  listings,
  savedIds,
  onSave,
  isLoading,
}: DealGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-card overflow-hidden animate-pulse"
          >
            <div className="aspect-[16/10] bg-muted" />
            <div className="p-3 space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-6 bg-muted rounded w-1/2" />
              <div className="grid grid-cols-2 gap-2">
                <div className="h-3 bg-muted rounded" />
                <div className="h-3 bg-muted rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-4xl mb-4">No deals found</div>
        <p className="text-muted-foreground max-w-md">
          Try adjusting your filters or run the scraper to fetch new listings.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {listings.map((listing) => (
        <DealCard
          key={listing.id}
          listing={listing}
          isSaved={savedIds?.has(listing.id)}
          onSave={onSave}
        />
      ))}
    </div>
  );
}
