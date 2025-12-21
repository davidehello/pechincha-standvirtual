"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout";
import { Button, RangeSlider } from "@/components/ui";
import { TAlgorithmWeights, DEFAULT_WEIGHTS } from "@/types";

export default function SettingsPage() {
  const [weights, setWeights] = useState<TAlgorithmWeights>(DEFAULT_WEIGHTS);
  const [isSaving, setIsSaving] = useState(false);
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
        setMessage("Weights saved successfully!");
      } else {
        setMessage("Failed to save weights");
      }
    } catch (error) {
      setMessage("Failed to save weights");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setWeights(DEFAULT_WEIGHTS);
    setMessage(null);
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
        <h1 className="text-2xl font-bold mb-2">Algorithm Settings</h1>
        <p className="text-muted-foreground mb-8">
          Adjust the weights of each scoring component to customize how deals
          are ranked. The weights should add up to 100%.
        </p>

        <div className="space-y-8">
          {/* Weight sliders */}
          <div className="space-y-6 p-6 rounded-lg border border-border bg-card">
            <h2 className="text-lg font-semibold">Scoring Weights</h2>

            <div className="space-y-6">
              <div>
                <RangeSlider
                  label="Price vs Segment"
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
                  How cheap the car is compared to similar vehicles (same
                  make/model/year/fuel)
                </p>
              </div>

              <div>
                <RangeSlider
                  label="Price Evaluation"
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
                  StandVirtual&apos;s own market evaluation (BELOW/IN/ABOVE)
                </p>
              </div>

              <div>
                <RangeSlider
                  label="Mileage Quality"
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
                  Low mileage relative to the car&apos;s age (expected 15k
                  km/year)
                </p>
              </div>

              <div>
                <RangeSlider
                  label="Price per Km"
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
                  Value efficiency - lower price per kilometer driven is better
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
              <span className="font-medium">Total Weight</span>
              <span className="font-bold">
                {(totalWeight * 100).toFixed(0)}%
              </span>
            </div>

            {!isValid && (
              <p className="text-sm text-destructive">
                Weights must add up to 100%. Current total:{" "}
                {(totalWeight * 100).toFixed(0)}%
              </p>
            )}
          </div>

          {/* Formula preview */}
          <div className="p-6 rounded-lg border border-border bg-card">
            <h2 className="text-lg font-semibold mb-4">Score Formula</h2>
            <code className="block p-4 rounded bg-muted text-sm font-mono overflow-x-auto">
              dealScore = <br />
              &nbsp;&nbsp;(priceVsSegment × {(weights.priceVsSegment * 100).toFixed(0)}%) +<br />
              &nbsp;&nbsp;(priceEvaluation × {(weights.priceEvaluation * 100).toFixed(0)}%) +<br />
              &nbsp;&nbsp;(mileageQuality × {(weights.mileageQuality * 100).toFixed(0)}%) +<br />
              &nbsp;&nbsp;(pricePerKm × {(weights.pricePerKm * 100).toFixed(0)}%)
            </code>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <Button onClick={handleSave} disabled={!isValid || isSaving}>
              {isSaving ? "Saving..." : "Save Weights"}
            </Button>
            <Button variant="secondary" onClick={handleReset}>
              Reset to Defaults
            </Button>
          </div>

          {message && (
            <p
              className={`text-sm ${
                message.includes("success")
                  ? "text-success"
                  : "text-destructive"
              }`}
            >
              {message}
            </p>
          )}

          {/* Explanation */}
          <div className="p-6 rounded-lg border border-border bg-card">
            <h2 className="text-lg font-semibold mb-4">How Scoring Works</h2>
            <div className="space-y-4 text-sm text-muted-foreground">
              <div>
                <h3 className="font-medium text-foreground">
                  Price vs Segment (Default: 35%)
                </h3>
                <p>
                  Compares the car&apos;s price against similar vehicles with
                  the same make, model, fuel type, and year range. A car priced
                  at the segment minimum gets 100 points, while one at the
                  maximum gets 0.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-foreground">
                  Price Evaluation (Default: 25%)
                </h3>
                <p>
                  Uses StandVirtual&apos;s built-in market analysis. BELOW
                  market = 100 points, IN market = 50 points, ABOVE market = 0
                  points.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-foreground">
                  Mileage Quality (Default: 25%)
                </h3>
                <p>
                  Based on expected 15,000 km/year. A car with 50% of expected
                  mileage gets 100 points, 100% gets 50 points, and 150%+ gets 0
                  points.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-foreground">
                  Price per Km (Default: 15%)
                </h3>
                <p>
                  Calculates value efficiency (price / mileage). Lower cost per
                  kilometer driven relative to the segment average scores
                  higher.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
