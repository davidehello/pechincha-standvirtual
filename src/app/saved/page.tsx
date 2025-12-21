"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout";
import { DealGrid } from "@/components/deals";
import { TListing } from "@/types";

export default function SavedPage() {
  const [savedDeals, setSavedDeals] = useState<TListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSavedDeals() {
      try {
        const res = await fetch("/api/saved");
        if (res.ok) {
          const data = await res.json();
          setSavedDeals(data.deals);
        }
      } catch (error) {
        console.error("Failed to fetch saved deals:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSavedDeals();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-2">Saved Deals</h1>
        <p className="text-muted-foreground mb-8">
          Your saved deals for later comparison.
        </p>

        <DealGrid listings={savedDeals} isLoading={isLoading} />

        {!isLoading && savedDeals.length === 0 && (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-2">No saved deals yet</h2>
            <p className="text-muted-foreground">
              Save deals from the main page to compare them later.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
