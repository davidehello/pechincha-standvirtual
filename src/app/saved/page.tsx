"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout";
import { DealGrid } from "@/components/deals";
import { TListing } from "@/types";
import { useLanguage } from "@/lib/i18n";

export default function SavedPage() {
  const { t } = useLanguage();
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
        <h1 className="text-2xl font-bold mb-6">{t.saved.title}</h1>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="aspect-[4/5] rounded-lg bg-muted animate-pulse"
              />
            ))}
          </div>
        ) : savedDeals.length > 0 ? (
          <DealGrid listings={savedDeals} isLoading={false} />
        ) : (
          <div className="text-center py-16">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4"
            >
              <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
            </svg>
            <p className="text-muted-foreground">{t.saved.empty}</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              {t.saved.emptyDesc}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
