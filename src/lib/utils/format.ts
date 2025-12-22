/**
 * Formatting utilities
 */

/**
 * Format price in EUR
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Format mileage in km
 */
export function formatMileage(mileage: number): string {
  return `${new Intl.NumberFormat("pt-PT").format(mileage)} km`;
}

/**
 * Format engine capacity in cm³
 */
export function formatEngineCapacity(capacity: number): string {
  return `${new Intl.NumberFormat("pt-PT").format(capacity)} cm³`;
}

/**
 * Format engine power in cv
 */
export function formatEnginePower(power: number): string {
  return `${power} cv`;
}

/**
 * Format date relative to now (for PT)
 */
export function formatRelativeDate(
  date: Date,
  lang: "pt" | "en" = "pt"
): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (lang === "pt") {
    if (diffMins < 1) return "agora";
    if (diffMins < 60) return `${diffMins} min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
  } else {
    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
  }

  return formatAbsoluteDate(date);
}

/**
 * Format absolute date as DD/MM/YYYY HH:mm
 */
export function formatAbsoluteDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, "0");
  const mins = date.getMinutes().toString().padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${mins}`;
}

/**
 * Format listing date - shows relative time if recent, absolute otherwise
 */
export function formatListingDate(
  date: Date | null | undefined,
  lang: "pt" | "en" = "pt"
): string {
  if (!date) return "";

  const now = new Date();
  const dateObj = date instanceof Date ? date : new Date(date);
  const diffMs = now.getTime() - dateObj.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // If within 7 days, show relative time
  if (diffDays < 7) {
    return formatRelativeDate(dateObj, lang);
  }

  // Otherwise show absolute date DD/MM/YYYY HH:mm
  return formatAbsoluteDate(dateObj);
}

/**
 * Check if listing is "new" (less than 24 hours old)
 */
export function isNewListing(date: Date | null | undefined): boolean {
  if (!date) return false;

  const dateObj = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  return diffHours < 24;
}

/**
 * Check if listing is recent (less than 3 days old)
 */
export function isRecentListing(date: Date | null | undefined): boolean {
  if (!date) return false;

  const dateObj = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays < 3;
}

/**
 * Format fuel type for display
 */
export function formatFuelType(fuelType: string): string {
  const map: Record<string, string> = {
    diesel: "Diesel",
    gasoline: "Gasoline",
    electric: "Electric",
    hybrid: "Hybrid",
    "plug-in-hybrid": "Plug-in Hybrid",
    lpg: "LPG",
    gaz: "LPG",
  };
  return map[fuelType.toLowerCase()] || fuelType;
}

/**
 * Format gearbox type for display
 */
export function formatGearbox(gearbox: string): string {
  const map: Record<string, string> = {
    manual: "Manual",
    automatic: "Automatic",
  };
  return map[gearbox.toLowerCase()] || gearbox;
}

/**
 * Get deal score color class
 */
export function getDealScoreColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-muted-foreground";
}

/**
 * Get deal score background class
 */
export function getDealScoreBgColor(score: number): string {
  if (score >= 80) return "bg-success/10 border-success/20";
  if (score >= 60) return "bg-warning/10 border-warning/20";
  return "bg-muted border-border";
}

/**
 * Get price evaluation badge color
 */
export function getPriceEvaluationColor(evaluation: string): string {
  switch (evaluation) {
    case "BELOW":
      return "bg-success/10 text-success border-success/20";
    case "IN":
      return "bg-warning/10 text-warning border-warning/20";
    case "ABOVE":
      return "bg-destructive/10 text-destructive border-destructive/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

/**
 * Format number with K/M suffix
 */
export function formatCompactNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(0)}K`;
  }
  return num.toString();
}
