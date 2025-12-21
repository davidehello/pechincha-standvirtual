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
 * Format date relative to now
 */
export function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("pt-PT");
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
