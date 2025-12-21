"use client";

import Link from "next/link";
import Image from "next/image";
import { TListing } from "@/types";
import {
  formatPrice,
  formatMileage,
  formatFuelType,
  formatGearbox,
  getDealScoreBgColor,
  getDealScoreColor,
  getPriceEvaluationColor,
} from "@/lib/utils/format";

interface DealCardProps {
  listing: TListing;
  onSave?: (id: string) => void;
  isSaved?: boolean;
}

export function DealCard({ listing, onSave, isSaved }: DealCardProps) {
  const score = listing.dealScore ?? 0;

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

        {/* Score badge */}
        <div
          className={`absolute top-2 right-2 px-2 py-1 rounded-md text-sm font-semibold border ${getDealScoreBgColor(score)}`}
        >
          <span className={getDealScoreColor(score)}>{score.toFixed(0)}</span>
        </div>

        {/* Price evaluation badge */}
        {listing.priceEvaluation && (
          <div
            className={`absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-medium border ${getPriceEvaluationColor(listing.priceEvaluation)}`}
          >
            {listing.priceEvaluation}
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
      <Link href={`/deals/${listing.id}`} className="flex-1 p-3">
        {/* Title */}
        <h3 className="font-medium text-sm line-clamp-2 mb-2 group-hover:text-primary transition-colors">
          {listing.title}
        </h3>

        {/* Price */}
        <div className="text-lg font-bold mb-2">
          {formatPrice(listing.price)}
        </div>

        {/* Specs grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="font-medium text-foreground">{listing.year}</span>
          </div>
          {listing.mileage && (
            <div className="flex items-center gap-1">
              {formatMileage(listing.mileage)}
            </div>
          )}
          {listing.fuelType && (
            <div className="flex items-center gap-1">
              {formatFuelType(listing.fuelType)}
            </div>
          )}
          {listing.gearbox && (
            <div className="flex items-center gap-1">
              {formatGearbox(listing.gearbox)}
            </div>
          )}
        </div>

        {/* Location */}
        {(listing.city || listing.region) && (
          <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-3 h-3"
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
        )}
      </Link>
    </div>
  );
}
