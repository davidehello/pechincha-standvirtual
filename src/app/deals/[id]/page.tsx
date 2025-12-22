"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui";
import { TListing, TScoreBreakdown } from "@/types";
import {
  formatPrice,
  formatMileage,
  formatEngineCapacity,
  formatEnginePower,
  getDealScoreColor,
  getDealScoreBgColor,
  getPriceEvaluationColor,
} from "@/lib/utils/format";
import { getScoreLabel } from "@/lib/utils/dealScore";
import { useLanguage } from "@/lib/i18n";

export default function DealDetailPage() {
  const { t } = useLanguage();
  const params = useParams();
  const id = params.id as string;

  const [listing, setListing] = useState<TListing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchListing() {
      try {
        const res = await fetch(`/api/deals/${id}`);
        if (!res.ok) {
          throw new Error("Deal not found");
        }
        const data = await res.json();
        setListing(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load deal");
      } finally {
        setIsLoading(false);
      }
    }
    fetchListing();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-4xl mx-auto p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-64 rounded-lg bg-muted" />
            <div className="h-8 w-3/4 rounded bg-muted" />
            <div className="h-6 w-1/4 rounded bg-muted" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-4xl mx-auto p-6 text-center">
          <h1 className="text-2xl font-bold mb-4">{t.deals.noDeals}</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Link href="/">
            <Button>{t.detail.backToDeals}</Button>
          </Link>
        </main>
      </div>
    );
  }

  const score = listing.dealScore ?? 0;
  const rawBreakdown = listing.scoreBreakdown
    ? JSON.parse(listing.scoreBreakdown)
    : null;

  // Normalize score breakdown to handle both old and new formats
  const scoreBreakdown: TScoreBreakdown | null = rawBreakdown
    ? {
        priceVsSegment: rawBreakdown.priceVsSegment?.score ?? rawBreakdown.price_evaluation?.score ?? 0,
        priceEvaluation: rawBreakdown.priceEvaluation?.score ?? rawBreakdown.price_evaluation?.score ?? 0,
        mileageQuality: rawBreakdown.mileageQuality?.score ?? rawBreakdown.mileage?.score ?? 0,
        pricePerKm: rawBreakdown.pricePerKm?.score ?? rawBreakdown.freshness?.score ?? 0,
        total: score,
      }
    : null;

  const getPriceEvalText = (eval_: string) => {
    if (eval_ === "BELOW") return t.priceEval.below;
    if (eval_ === "IN") return t.priceEval.in;
    if (eval_ === "ABOVE") return t.priceEval.above;
    return eval_;
  };

  const getFuelTypeText = (fuel: string) => {
    const key = fuel.toLowerCase() as keyof typeof t.fuel;
    return t.fuel[key] || fuel;
  };

  const getGearboxText = (gearbox: string) => {
    const key = gearbox.toLowerCase() as keyof typeof t.gearbox;
    return t.gearbox[key] || gearbox;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-4xl mx-auto p-6">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
              clipRule="evenodd"
            />
          </svg>
          {t.detail.backToDeals}
        </Link>

        <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
          {/* Main content */}
          <div className="space-y-6">
            {/* Image */}
            <div className="relative aspect-[16/9] rounded-lg overflow-hidden bg-muted">
              {listing.thumbnailUrl ? (
                <Image
                  src={listing.thumbnailUrl}
                  alt={listing.title}
                  fill
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No image
                </div>
              )}
            </div>

            {/* Title and price */}
            <div>
              <h1 className="text-2xl font-bold mb-2">{listing.title}</h1>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold">
                  {formatPrice(listing.price)}
                </span>
                {listing.priceEvaluation && (
                  <span
                    className={`px-2 py-1 rounded text-sm font-medium border ${getPriceEvaluationColor(listing.priceEvaluation)}`}
                  >
                    {getPriceEvalText(listing.priceEvaluation)}
                  </span>
                )}
              </div>
            </div>

            {/* Specs grid */}
            <div className="p-6 rounded-lg border border-border bg-card">
              <h2 className="text-lg font-semibold mb-4">{t.detail.specifications}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t.detail.make}</p>
                  <p className="font-medium">{listing.make}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t.detail.model}</p>
                  <p className="font-medium">{listing.model}</p>
                </div>
                {listing.version && (
                  <div>
                    <p className="text-sm text-muted-foreground">{t.detail.version}</p>
                    <p className="font-medium">{listing.version}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">{t.detail.year}</p>
                  <p className="font-medium">{listing.year}</p>
                </div>
                {listing.mileage && (
                  <div>
                    <p className="text-sm text-muted-foreground">{t.detail.mileage}</p>
                    <p className="font-medium">
                      {formatMileage(listing.mileage)}
                    </p>
                  </div>
                )}
                {listing.fuelType && (
                  <div>
                    <p className="text-sm text-muted-foreground">{t.detail.fuelType}</p>
                    <p className="font-medium">
                      {getFuelTypeText(listing.fuelType)}
                    </p>
                  </div>
                )}
                {listing.gearbox && (
                  <div>
                    <p className="text-sm text-muted-foreground">{t.detail.gearbox}</p>
                    <p className="font-medium">
                      {getGearboxText(listing.gearbox)}
                    </p>
                  </div>
                )}
                {listing.engineCapacity && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t.detail.engineCapacity}
                    </p>
                    <p className="font-medium">
                      {formatEngineCapacity(listing.engineCapacity)}
                    </p>
                  </div>
                )}
                {listing.enginePower && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t.detail.enginePower}
                    </p>
                    <p className="font-medium">
                      {formatEnginePower(listing.enginePower)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Location */}
            {(listing.city || listing.region) && (
              <div className="p-6 rounded-lg border border-border bg-card">
                <h2 className="text-lg font-semibold mb-4">{t.detail.location}</h2>
                <div className="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-5 h-5 text-muted-foreground"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>
                    {[listing.city, listing.region].filter(Boolean).join(", ")}
                  </span>
                </div>
              </div>
            )}

            {/* Seller */}
            {listing.sellerName && (
              <div className="p-6 rounded-lg border border-border bg-card">
                <h2 className="text-lg font-semibold mb-4">{t.detail.seller}</h2>
                <p className="font-medium">{listing.sellerName}</p>
                {listing.sellerType && (
                  <p className="text-sm text-muted-foreground capitalize">
                    {listing.sellerType}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Deal Score */}
            <div className="p-6 rounded-lg border border-border bg-card">
              <h2 className="text-lg font-semibold mb-4">{t.detail.dealScore}</h2>

              <div
                className={`flex items-center justify-center p-6 rounded-lg border ${getDealScoreBgColor(score)}`}
              >
                <div className="text-center">
                  <span
                    className={`text-5xl font-bold ${getDealScoreColor(score)}`}
                  >
                    {score.toFixed(0)}
                  </span>
                  <p className={`text-sm mt-1 ${getDealScoreColor(score)}`}>
                    {getScoreLabel(score)}
                  </p>
                </div>
              </div>

              {/* Score breakdown */}
              {scoreBreakdown && (
                <div className="mt-4 space-y-3">
                  <h3 className="text-sm font-medium">{t.detail.scoreBreakdown}</h3>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {t.detail.priceVsSegment}
                      </span>
                      <span className="font-medium">
                        {scoreBreakdown.priceVsSegment.toFixed(0)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${scoreBreakdown.priceVsSegment}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {t.detail.priceEvaluation}
                      </span>
                      <span className="font-medium">
                        {scoreBreakdown.priceEvaluation.toFixed(0)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${scoreBreakdown.priceEvaluation}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {t.detail.mileageQuality}
                      </span>
                      <span className="font-medium">
                        {scoreBreakdown.mileageQuality.toFixed(0)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${scoreBreakdown.mileageQuality}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {t.detail.pricePerKm}
                      </span>
                      <span className="font-medium">
                        {scoreBreakdown.pricePerKm.toFixed(0)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${scoreBreakdown.pricePerKm}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-6 rounded-lg border border-border bg-card space-y-3">
              <a
                href={listing.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button className="w-full">{t.detail.viewOnStandVirtual}</Button>
              </a>
              <Button variant="secondary" className="w-full">
                {t.detail.saveDeal}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
