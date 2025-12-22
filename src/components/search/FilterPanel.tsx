"use client";

import { TFilterOptions } from "@/types";
import { RangeSlider, MultiSelect, Checkbox, Button } from "@/components/ui";
import { formatPrice, formatMileage } from "@/lib/utils/format";

interface FilterPanelProps {
  filters: TFilterOptions;
  onChange: (filters: TFilterOptions) => void;
  onReset: () => void;
  makes: string[];
  models: string[];
  regions: string[];
  isLoading?: boolean;
}

const FUEL_TYPE_OPTIONS = [
  { value: "diesel", label: "Diesel" },
  { value: "gasoline", label: "Gasoline" },
  { value: "electric", label: "Electric" },
  { value: "hybrid", label: "Hybrid" },
  { value: "plug-in-hybrid", label: "Plug-in Hybrid" },
  { value: "lpg", label: "LPG" },
];

const GEARBOX_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "automatic", label: "Automatic" },
];

const PRICE_EVALUATION_OPTIONS = [
  { value: "BELOW", label: "Below Market" },
  { value: "IN", label: "At Market" },
  { value: "ABOVE", label: "Above Market" },
];

export function FilterPanel({
  filters,
  onChange,
  onReset,
  makes,
  models,
  regions,
  isLoading,
}: FilterPanelProps) {
  const currentYear = new Date().getFullYear();

  const updateFilter = <K extends keyof TFilterOptions>(
    key: K,
    value: TFilterOptions[K]
  ) => {
    onChange({ ...filters, [key]: value });
  };

  const makeOptions = makes.map((m) => ({ value: m, label: m }));
  const modelOptions = models.map((m) => ({ value: m, label: m }));
  const regionOptions = regions.map((r) => ({ value: r, label: r }));

  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== undefined && (Array.isArray(v) ? v.length > 0 : true)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Filters</h2>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            Reset
          </Button>
        )}
      </div>

      {/* Deal Score */}
      <div className="space-y-3">
        <RangeSlider
          label="Deal Score"
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
          label="Hide unavailable listings"
          checked={filters.hideUnavailable ?? true}
          onChange={(checked) => updateFilter("hideUnavailable", checked)}
        />
        <p className="text-xs text-muted-foreground">
          Uncheck to show listings no longer on StandVirtual
        </p>
      </div>

      {/* Price */}
      <RangeSlider
        label="Price"
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
        label="Year"
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
        label="Mileage"
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
        label="Make"
        options={makeOptions}
        value={filters.makes ?? []}
        onChange={(v) => updateFilter("makes", v.length > 0 ? v : undefined)}
        placeholder="All makes"
      />

      {/* Model */}
      <MultiSelect
        label="Model"
        options={modelOptions}
        value={filters.models ?? []}
        onChange={(v) => updateFilter("models", v.length > 0 ? v : undefined)}
        placeholder="All models"
      />

      {/* Region */}
      <MultiSelect
        label="Region"
        options={regionOptions}
        value={filters.regions ?? []}
        onChange={(v) => updateFilter("regions", v.length > 0 ? v : undefined)}
        placeholder="All regions"
      />

      {/* Fuel Type */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Fuel Type</label>
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
        <label className="text-sm font-medium">Gearbox</label>
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
        <label className="text-sm font-medium">Price Evaluation</label>
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
        label="Engine Power (cv)"
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
