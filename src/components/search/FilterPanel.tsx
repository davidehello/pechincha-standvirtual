"use client";

import { TFilterOptions } from "@/types";
import { RangeSlider, MultiSelect, Checkbox, Button } from "@/components/ui";
import { formatPrice, formatMileage } from "@/lib/utils/format";
import { useLanguage } from "@/lib/i18n";

/**
 * Format make/model name for display
 * Removes hyphens and capitalizes first letter of each word
 */
function formatDisplayName(name: string): string {
  return name
    .replace(/-/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

interface FilterPanelProps {
  filters: TFilterOptions;
  onChange: (filters: TFilterOptions) => void;
  onReset: () => void;
  makes: string[];
  models: string[];
  regions: string[];
  isLoading?: boolean;
}

export function FilterPanel({
  filters,
  onChange,
  onReset,
  makes,
  models,
  regions,
}: FilterPanelProps) {
  const { t } = useLanguage();
  const currentYear = new Date().getFullYear();

  const FUEL_TYPE_OPTIONS = [
    { value: "diesel", label: t.fuel.diesel },
    { value: "gasoline", label: t.fuel.gasoline },
    { value: "electric", label: t.fuel.electric },
    { value: "hybrid", label: t.fuel.hybrid },
    { value: "plug-in-hybrid", label: t.fuel["plug-in-hybrid"] },
    { value: "lpg", label: t.fuel.lpg },
  ];

  const GEARBOX_OPTIONS = [
    { value: "manual", label: t.gearbox.manual },
    { value: "automatic", label: t.gearbox.automatic },
  ];

  const PRICE_EVALUATION_OPTIONS = [
    { value: "BELOW", label: t.priceEval.below },
    { value: "IN", label: t.priceEval.in },
    { value: "ABOVE", label: t.priceEval.above },
  ];

  const updateFilter = <K extends keyof TFilterOptions>(
    key: K,
    value: TFilterOptions[K]
  ) => {
    onChange({ ...filters, [key]: value });
  };

  const makeOptions = makes.map((m) => ({ value: m, label: formatDisplayName(m) }));
  const modelOptions = models.map((m) => ({ value: m, label: formatDisplayName(m) }));
  const regionOptions = regions.map((r) => ({ value: r, label: r }));

  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== undefined && (Array.isArray(v) ? v.length > 0 : true)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t.filters.title}</h2>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            {t.filters.reset}
          </Button>
        )}
      </div>

      {/* Deal Score */}
      <div className="space-y-3">
        <RangeSlider
          label={t.filters.dealScore}
          min={0}
          max={100}
          step={5}
          value={[filters.minDealScore ?? 0, 100]}
          onChange={([min]) => updateFilter("minDealScore", min > 0 ? min : undefined)}
          formatValue={(v) => v.toString()}
        />
      </div>

      {/* Availability */}
      <div className="space-y-2">
        <Checkbox
          label={t.filters.hideUnavailable}
          checked={filters.hideUnavailable ?? true}
          onChange={(checked) => updateFilter("hideUnavailable", checked)}
        />
        <p className="text-xs text-muted-foreground">
          {t.filters.hideUnavailableDesc}
        </p>
      </div>

      {/* Price */}
      <RangeSlider
        label={t.filters.price}
        min={0}
        max={100000}
        step={1000}
        value={[filters.priceMin ?? 0, filters.priceMax ?? 100000]}
        onChange={([min, max]) => {
          onChange({
            ...filters,
            priceMin: min > 0 ? min : undefined,
            priceMax: max < 100000 ? max : undefined,
          });
        }}
        formatValue={formatPrice}
      />

      {/* Year */}
      <RangeSlider
        label={t.filters.year}
        min={2000}
        max={currentYear}
        step={1}
        value={[filters.yearMin ?? 2000, filters.yearMax ?? currentYear]}
        onChange={([min, max]) => {
          onChange({
            ...filters,
            yearMin: min > 2000 ? min : undefined,
            yearMax: max < currentYear ? max : undefined,
          });
        }}
      />

      {/* Mileage */}
      <RangeSlider
        label={t.filters.mileage}
        min={0}
        max={300000}
        step={5000}
        value={[filters.mileageMin ?? 0, filters.mileageMax ?? 300000]}
        onChange={([min, max]) => {
          onChange({
            ...filters,
            mileageMin: min > 0 ? min : undefined,
            mileageMax: max < 300000 ? max : undefined,
          });
        }}
        formatValue={formatMileage}
      />

      {/* Make */}
      <MultiSelect
        label={t.filters.make}
        options={makeOptions}
        value={filters.makes ?? []}
        onChange={(v) => updateFilter("makes", v.length > 0 ? v : undefined)}
        placeholder={t.filters.allMakes}
      />

      {/* Model */}
      <MultiSelect
        label={t.filters.model}
        options={modelOptions}
        value={filters.models ?? []}
        onChange={(v) => updateFilter("models", v.length > 0 ? v : undefined)}
        placeholder={t.filters.allModels}
      />

      {/* Region */}
      <MultiSelect
        label={t.filters.region}
        options={regionOptions}
        value={filters.regions ?? []}
        onChange={(v) => updateFilter("regions", v.length > 0 ? v : undefined)}
        placeholder={t.filters.allRegions}
      />

      {/* Fuel Type */}
      <div className="space-y-2">
        <label className="text-sm font-medium">{t.filters.fuelType}</label>
        <div className="space-y-1.5">
          {FUEL_TYPE_OPTIONS.map((opt) => (
            <Checkbox
              key={opt.value}
              label={opt.label}
              checked={filters.fuelTypes?.includes(opt.value) ?? false}
              onChange={(checked) => {
                const current = filters.fuelTypes ?? [];
                const updated = checked
                  ? [...current, opt.value]
                  : current.filter((v) => v !== opt.value);
                updateFilter("fuelTypes", updated.length > 0 ? updated : undefined);
              }}
            />
          ))}
        </div>
      </div>

      {/* Gearbox */}
      <div className="space-y-2">
        <label className="text-sm font-medium">{t.filters.gearbox}</label>
        <div className="space-y-1.5">
          {GEARBOX_OPTIONS.map((opt) => (
            <Checkbox
              key={opt.value}
              label={opt.label}
              checked={filters.gearboxTypes?.includes(opt.value) ?? false}
              onChange={(checked) => {
                const current = filters.gearboxTypes ?? [];
                const updated = checked
                  ? [...current, opt.value]
                  : current.filter((v) => v !== opt.value);
                updateFilter("gearboxTypes", updated.length > 0 ? updated : undefined);
              }}
            />
          ))}
        </div>
      </div>

      {/* Price Evaluation */}
      <div className="space-y-2">
        <label className="text-sm font-medium">{t.filters.priceEvaluation}</label>
        <div className="space-y-1.5">
          {PRICE_EVALUATION_OPTIONS.map((opt) => (
            <Checkbox
              key={opt.value}
              label={opt.label}
              checked={filters.priceEvaluations?.includes(opt.value) ?? false}
              onChange={(checked) => {
                const current = filters.priceEvaluations ?? [];
                const updated = checked
                  ? [...current, opt.value]
                  : current.filter((v) => v !== opt.value);
                updateFilter(
                  "priceEvaluations",
                  updated.length > 0 ? updated : undefined
                );
              }}
            />
          ))}
        </div>
      </div>

      {/* Engine Power */}
      <RangeSlider
        label={t.filters.enginePower}
        min={0}
        max={500}
        step={10}
        value={[filters.enginePowerMin ?? 0, filters.enginePowerMax ?? 500]}
        onChange={([min, max]) => {
          onChange({
            ...filters,
            enginePowerMin: min > 0 ? min : undefined,
            enginePowerMax: max < 500 ? max : undefined,
          });
        }}
        formatValue={(v) => `${v} cv`}
      />
    </div>
  );
}
