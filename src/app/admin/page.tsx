"use client";

import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui";
import { formatRelativeDate } from "@/lib/utils/format";

interface ScrapeRun {
  id: number;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  pagesScraped: number | null;
  listingsFound: number | null;
  listingsNew: number | null;
  listingsUpdated: number | null;
  listingsInactive: number | null;
  errorMessage: string | null;
}

interface Stats {
  totalListings: number;
  activeListings: number;
  belowMarketCount: number;
  inMarketCount: number;
  aboveMarketCount: number;
  topMakes: { make: string; count: number }[];
  lastScrapeRun: ScrapeRun | null;
  scrapeHistory: ScrapeRun[];
}

interface ScraperStatus {
  isRunning: boolean;
  progress?: {
    currentPage: number;
    totalPages: number;
    listingsFound: number;
  };
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [scraperStatus, setScraperStatus] = useState<ScraperStatus>({
    isRunning: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const wasRunningRef = useRef(false);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchScraperStatus = async () => {
    try {
      const res = await fetch("/api/scraper/status");
      const data = await res.json();

      // Detect when scraper finishes (was running, now not running)
      if (wasRunningRef.current && !data.isRunning) {
        setMessage("✓ Scraping completed! Stats updated.");
        fetchStats(); // Refresh stats to show new data
      }

      wasRunningRef.current = data.isRunning;
      setScraperStatus(data);
    } catch (error) {
      console.error("Failed to fetch scraper status:", error);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchScraperStatus();

    // Poll scraper status every 2 seconds for responsive progress updates
    const interval = setInterval(fetchScraperStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleTriggerScrape = async () => {
    setTriggerLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/scraper/trigger", { method: "POST" });
      const data = await res.json();

      if (res.ok) {
        setMessage("Scraper started! Check progress below.");
        setScraperStatus({ isRunning: true });
        wasRunningRef.current = true; // Track that we started a scrape
      } else {
        setMessage(data.error || "Failed to start scraper");
      }
    } catch (error) {
      setMessage("Failed to start scraper");
    } finally {
      setTriggerLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-success";
      case "running":
        return "text-warning";
      case "failed":
        return "text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground mb-8">
          Manage the scraper and view database statistics.
        </p>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-32 rounded-lg border border-border bg-card animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Scraper Controls */}
            <div className="p-6 rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Scraper Controls</h2>
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      scraperStatus.isRunning
                        ? "bg-warning animate-pulse"
                        : "bg-muted-foreground"
                    }`}
                  />
                  <span className="text-sm text-muted-foreground">
                    {scraperStatus.isRunning ? "Running" : "Idle"}
                  </span>
                </div>
              </div>

              {scraperStatus.isRunning && scraperStatus.progress && (
                <div className="mb-4 p-4 rounded-md bg-muted">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Progress</span>
                    <span className="text-sm text-muted-foreground">
                      Page {scraperStatus.progress.currentPage}/
                      {scraperStatus.progress.totalPages}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-background overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: `${
                          (scraperStatus.progress.currentPage /
                            scraperStatus.progress.totalPages) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {scraperStatus.progress.listingsFound.toLocaleString()}{" "}
                    listings found
                  </p>
                </div>
              )}

              <Button
                onClick={handleTriggerScrape}
                disabled={scraperStatus.isRunning || triggerLoading}
                isLoading={triggerLoading}
              >
                {scraperStatus.isRunning ? "Scraping..." : "Start Scrape"}
              </Button>

              {message && (
                <p
                  className={`mt-4 text-sm ${
                    message.includes("started") || message.includes("✓")
                      ? "text-success"
                      : "text-destructive"
                  }`}
                >
                  {message}
                </p>
              )}
            </div>

            {/* Database Stats */}
            <div className="p-6 rounded-lg border border-border bg-card">
              <h2 className="text-lg font-semibold mb-4">Database Statistics</h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-md bg-muted">
                  <p className="text-2xl font-bold">
                    {(stats?.activeListings ?? 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Active Listings
                  </p>
                </div>
                <div className="p-4 rounded-md bg-muted">
                  <p className="text-2xl font-bold text-success">
                    {(stats?.belowMarketCount ?? 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">Below Market</p>
                </div>
                <div className="p-4 rounded-md bg-muted">
                  <p className="text-2xl font-bold">
                    {(stats?.inMarketCount ?? 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">In Market</p>
                </div>
                <div className="p-4 rounded-md bg-muted">
                  <p className="text-2xl font-bold text-destructive">
                    {(stats?.aboveMarketCount ?? 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">Above Market</p>
                </div>
              </div>
            </div>

            {/* Scrape Run History */}
            {stats?.scrapeHistory && stats.scrapeHistory.length > 0 && (
              <div className="p-6 rounded-lg border border-border bg-card">
                <h2 className="text-lg font-semibold mb-4">Scrape History</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">When</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Status</th>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground">Pages</th>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground">Found</th>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground">New</th>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground">Updated</th>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground">Unavailable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.scrapeHistory.map((run) => (
                        <tr key={run.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 px-2">
                            {run.completedAt
                              ? formatRelativeDate(new Date(run.completedAt))
                              : "—"}
                          </td>
                          <td className={`py-2 px-2 capitalize ${getStatusColor(run.status)}`}>
                            {run.status}
                          </td>
                          <td className="py-2 px-2 text-right">{run.pagesScraped?.toLocaleString() ?? "—"}</td>
                          <td className="py-2 px-2 text-right">{run.listingsFound?.toLocaleString() ?? "—"}</td>
                          <td className="py-2 px-2 text-right text-success">+{run.listingsNew?.toLocaleString() ?? 0}</td>
                          <td className="py-2 px-2 text-right">{run.listingsUpdated?.toLocaleString() ?? 0}</td>
                          <td className="py-2 px-2 text-right text-destructive">-{run.listingsInactive?.toLocaleString() ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Top Makes */}
            {stats?.topMakes && stats.topMakes.length > 0 && (
              <div className="p-6 rounded-lg border border-border bg-card">
                <h2 className="text-lg font-semibold mb-4">Top Makes</h2>
                <div className="space-y-2">
                  {stats.topMakes.map((item) => (
                    <div
                      key={item.make}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm font-medium">{item.make}</span>
                      <span className="text-sm text-muted-foreground">
                        {item.count.toLocaleString()} listings
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
