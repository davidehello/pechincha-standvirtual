"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout";
import { Button, RangeSlider } from "@/components/ui";
import { TAlgorithmWeights, DEFAULT_WEIGHTS } from "@/types";
import { useLanguage } from "@/lib/i18n";

export default function SettingsPage() {
  const { t } = useLanguage();
  const [weights, setWeights] = useState<TAlgorithmWeights>(DEFAULT_WEIGHTS);
  const [isSaving, setIsSaving] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Load saved weights
  useEffect(() => {
    async function loadWeights() {
      try {
        const res = await fetch("/api/settings/weights");
        if (res.ok) {
          const data = await res.json();
          if (data.weights) {
            setWeights(data.weights);
          }
        }
      } catch (error) {
        console.error("Failed to load weights:", error);
      }
    }
    loadWeights();
  }, []);

  const handleWeightChange = (key: keyof TAlgorithmWeights, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: value }));
    setMessage(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings/weights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weights }),
      });

      if (res.ok) {
        setMessage(t.settings.saveSuccess);
      } else {
        setMessage(t.settings.saveFailed);
      }
    } catch (error) {
      setMessage(t.settings.saveFailed);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setWeights(DEFAULT_WEIGHTS);
    setMessage(null);
  };

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/recalculate", {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok) {
        setMessage(`${t.settings.recalculateSuccess} ${data.updatedCount.toLocaleString()}`);
      } else {
        setMessage(t.settings.recalculateFailed);
      }
    } catch (error) {
      setMessage(t.settings.recalculateFailed);
    } finally {
      setIsRecalculating(false);
    }
  };

  const totalWeight =
    weights.priceVsSegment +
    weights.priceEvaluation +
    weights.mileageQuality +
    weights.pricePerKm;

  const isValid = Math.abs(totalWeight - 1) < 0.01;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-2">{t.settings.title}</h1>
        <p className="text-muted-foreground mb-8">
          {t.settings.weightsDesc}
        </p>

        <div className="space-y-8">
          {/* Weight sliders */}
          <div className="space-y-6 p-6 rounded-lg border border-border bg-card">
            <h2 className="text-lg font-semibold">{t.settings.weightsTitle}</h2>

            <div className="space-y-6">
              <div>
                <RangeSlider
                  label={t.settings.priceVsSegment}
                  min={0}
                  max={100}
                  step={5}
                  value={[0, weights.priceVsSegment * 100]}
                  onChange={([, val]) =>
                    handleWeightChange("priceVsSegment", val / 100)
                  }
                  formatValue={(v) => `${v}%`}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t.settings.priceVsSegmentDesc}
                </p>
              </div>

              <div>
                <RangeSlider
                  label={t.settings.priceEvaluation}
                  min={0}
                  max={100}
                  step={5}
                  value={[0, weights.priceEvaluation * 100]}
                  onChange={([, val]) =>
                    handleWeightChange("priceEvaluation", val / 100)
                  }
                  formatValue={(v) => `${v}%`}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t.settings.priceEvaluationDesc}
                </p>
              </div>

              <div>
                <RangeSlider
                  label={t.settings.mileageQuality}
                  min={0}
                  max={100}
                  step={5}
                  value={[0, weights.mileageQuality * 100]}
                  onChange={([, val]) =>
                    handleWeightChange("mileageQuality", val / 100)
                  }
                  formatValue={(v) => `${v}%`}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t.settings.mileageQualityDesc}
                </p>
              </div>

              <div>
                <RangeSlider
                  label={t.settings.pricePerKm}
                  min={0}
                  max={100}
                  step={5}
                  value={[0, weights.pricePerKm * 100]}
                  onChange={([, val]) =>
                    handleWeightChange("pricePerKm", val / 100)
                  }
                  formatValue={(v) => `${v}%`}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t.settings.pricePerKmDesc}
                </p>
              </div>
            </div>

            {/* Total indicator */}
            <div
              className={`flex items-center justify-between p-3 rounded-md ${
                isValid
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              <span className="font-medium">{t.settings.total}</span>
              <span className="font-bold">
                {(totalWeight * 100).toFixed(0)}%
              </span>
            </div>

            {!isValid && (
              <p className="text-sm text-destructive">
                {t.settings.mustEqual100} {t.settings.currentTotal}:{" "}
                {(totalWeight * 100).toFixed(0)}%
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <Button onClick={handleSave} disabled={!isValid || isSaving}>
              {isSaving ? t.settings.saving : t.settings.save}
            </Button>
            <Button
              variant="secondary"
              onClick={handleRecalculate}
              disabled={isRecalculating}
            >
              {isRecalculating ? t.settings.recalculating : t.settings.recalculate}
            </Button>
            <Button variant="secondary" onClick={handleReset}>
              {t.settings.resetDefaults}
            </Button>
          </div>

          {message && (
            <p
              className={`text-sm ${
                message.includes(t.settings.saveSuccess) || message.includes(t.settings.recalculateSuccess)
                  ? "text-success"
                  : "text-destructive"
              }`}
            >
              {message}
            </p>
          )}

          {/* Explanation */}
          <div className="p-6 rounded-lg border border-border bg-card">
            <h2 className="text-lg font-semibold mb-4">{t.settings.howItWorks}</h2>
            <p className="text-sm text-muted-foreground">
              {t.settings.howItWorksDesc}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
