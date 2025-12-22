"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { TListing, TScoreBreakdown } from "@/types";
import {
  formatPrice,
  formatMileage,
  formatEngineCapacity,
  formatEnginePower,
  getPriceEvaluationColor,
  formatListingDate,
  isNewListing,
} from "@/lib/utils/format";
import { useLanguage } from "@/lib/i18n";

interface DealCardProps {
  listing: TListing;
  onSave?: (id: string) => void;
  isSaved?: boolean;
}

export function DealCard({ listing, onSave, isSaved }: DealCardProps) {
  const { language, t } = useLanguage();
  const [showTooltip, setShowTooltip] = useState(false);
  const score = listing.dealScore ?? 0;
  const isNew = isNewListing(listing.listingDate);
  const listingDateStr = formatListingDate(listing.listingDate, language);

  // Parse score breakdown
  const rawBreakdown = listing.scoreBreakdown
    ? JSON.parse(listing.scoreBreakdown)
    : null;
  const scoreBreakdown: TScoreBreakdown | null = rawBreakdown
    ? {
        priceVsSegment: rawBreakdown.priceVsSegment?.score ?? 0,
        priceEvaluation: rawBreakdown.priceEvaluation?.score ?? 0,
        mileageQuality: rawBreakdown.mileageQuality?.score ?? 0,
        pricePerKm: rawBreakdown.pricePerKm?.score ?? 0,
        total: score,
      }
    : null;

  return (
    <div className="group relative flex flex-col rounded-lg border border-border bg-card overflow-hidden transition-all hover:border-muted-foreground/30 hover:shadow-lg">
      {/* Image */}
      <div className="relative aspect-[16/10] bg-muted overflow-hidden">
        {listing.thumbnailUrl ? (
          <Image
            src={listing.thumbnailUrl}
            alt={listing.title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No image
          </div>
        )}

        {/* Score badge - solid background for visibility */}
        <div
          className="absolute top-2 right-2"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <div
            className={`px-2.5 py-1 rounded-md text-sm font-bold shadow-md cursor-help ${
              score >= 80
                ? "bg-emerald-500 text-white"
                : score >= 60
                  ? "bg-amber-500 text-white"
                  : "bg-slate-600 text-white"
            }`}
          >
            {score.toFixed(0)}
          </div>

          {/* Score breakdown tooltip */}
          {showTooltip && scoreBreakdown && (
            <div className="absolute top-full right-0 mt-1 z-50 w-48 p-3 rounded-lg bg-popover border border-border shadow-lg text-xs">
              <p className="font-semibold text-foreground mb-2">
                {t.scoreBreakdown.title}
              </p>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t.scoreBreakdown.priceVsSegment}
                  </span>
                  <span className="font-medium text-foreground">
                    {scoreBreakdown.priceVsSegment.toFixed(0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t.scoreBreakdown.priceEvaluation}
                  </span>
                  <span className="font-medium text-foreground">
                    {scoreBreakdown.priceEvaluation.toFixed(0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t.scoreBreakdown.mileageQuality}
                  </span>
                  <span className="font-medium text-foreground">
                    {scoreBreakdown.mileageQuality.toFixed(0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t.scoreBreakdown.pricePerKm}
                  </span>
                  <span className="font-medium text-foreground">
                    {scoreBreakdown.pricePerKm.toFixed(0)}
                  </span>
                </div>
                <div className="border-t border-border pt-1.5 mt-1.5 flex justify-between">
                  <span className="font-semibold text-foreground">
                    {t.scoreBreakdown.total}
                  </span>
                  <span className="font-bold text-foreground">
                    {score.toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* New listing badge */}
        {isNew && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-semibold bg-red-500 text-white">
            {t.card.new}
          </div>
        )}

        {/* Save button */}
        {onSave && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSave(listing.id);
            }}
            className={`absolute bottom-2 right-2 p-1.5 rounded-full transition-colors ${
              isSaved
                ? "bg-primary text-primary-foreground"
                : "bg-background/80 text-foreground hover:bg-background"
            }`}
            aria-label={isSaved ? "Remove from saved" : "Save deal"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill={isSaved ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={2}
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-3 flex flex-col">
        <Link href={`/deals/${listing.id}`} className="flex-1">
          {/* Title */}
          <h3 className="font-medium text-sm line-clamp-2 mb-2 group-hover:text-primary transition-colors">
            {listing.title}
          </h3>

          {/* Price and evaluation row */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg font-bold">
              {formatPrice(listing.price)}
            </span>
            {listing.priceEvaluation && (
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium border ${getPriceEvaluationColor(listing.priceEvaluation)}`}
              >
                {listing.priceEvaluation === "BELOW"
                  ? t.priceEval.below
                  : listing.priceEvaluation === "IN"
                    ? t.priceEval.in
                    : listing.priceEvaluation === "ABOVE"
                      ? t.priceEval.above
                      : listing.priceEvaluation}
              </span>
            )}
          </div>

          {/* Specs grid with labels */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs mb-3">
            <div>
              <span className="text-muted-foreground">{t.card.year}</span>
              <p className="font-medium text-foreground">{listing.year}</p>
            </div>
            {listing.mileage !== null && listing.mileage !== undefined && (
              <div>
                <span className="text-muted-foreground">{t.card.mileage}</span>
                <p className="font-medium text-foreground">
                  {formatMileage(listing.mileage)}
                </p>
              </div>
            )}
            {listing.fuelType && (
              <div>
                <span className="text-muted-foreground">{t.card.fuel}</span>
                <p className="font-medium text-foreground">
                  {t.fuel[listing.fuelType.toLowerCase() as keyof typeof t.fuel] ||
                    listing.fuelType}
                </p>
              </div>
            )}
            {listing.gearbox && (
              <div>
                <span className="text-muted-foreground">{t.card.gearbox}</span>
                <p className="font-medium text-foreground">
                  {t.gearbox[
                    listing.gearbox.toLowerCase() as keyof typeof t.gearbox
                  ] || listing.gearbox}
                </p>
              </div>
            )}
            {listing.enginePower && (
              <div>
                <span className="text-muted-foreground">{t.card.power}</span>
                <p className="font-medium text-foreground">
                  {formatEnginePower(listing.enginePower)}
                </p>
              </div>
            )}
            {listing.engineCapacity && (
              <div>
                <span className="text-muted-foreground">{t.card.engine}</span>
                <p className="font-medium text-foreground">
                  {formatEngineCapacity(listing.engineCapacity)}
                </p>
              </div>
            )}
          </div>

          {/* Listing date */}
          {listingDateStr && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-3 h-3"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{t.card.published}: {listingDateStr}</span>
            </div>
          )}
        </Link>

        {/* View in StandVirtual button */}
        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-3 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path
              fillRule="evenodd"
              d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z"
              clipRule="evenodd"
            />
            <path
              fillRule="evenodd"
              d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z"
              clipRule="evenodd"
            />
          </svg>
          {t.card.viewInStandVirtual}
        </a>
      </div>
    </div>
  );
}
