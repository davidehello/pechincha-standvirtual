"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui";
import { formatRelativeDate, formatCompactNumber } from "@/lib/utils/format";

interface Stats {
  totalListings: number;
  activeListings: number;
  belowMarketCount: number;
  averagePrice: number;
  averageMileage: number;
  topMakes: { make: string; count: number }[];
  lastScrapeRun: {
    id: number;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    pagesScraped: number | null;
    listingsFound: number | null;
    listingsNew: number | null;
    listingsUpdated: number | null;
    errorMessage: string | null;
  } | null;
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

              <div className="flex items-center gap-4">
                <Button
                  onClick={handleTriggerScrape}
                  disabled={scraperStatus.isRunning || triggerLoading}
                  isLoading={triggerLoading}
                >
                  {scraperStatus.isRunning ? "Scraping..." : "Start Scrape"}
                </Button>
                <Button variant="secondary" onClick={fetchStats}>
                  Refresh Stats
                </Button>
              </div>

              {message && (
                <p
                  className={`mt-4 text-sm ${
                    message.includes("started")
                      ? "text-success"
                      : "text-destructive"
                  }`}
                >
                  {message}
                </p>
              )}

              <div className="mt-4 p-4 rounded-md bg-muted">
                <h3 className="text-sm font-medium mb-2">
                  Manual Scraper Command
                </h3>
                <code className="block text-xs font-mono text-muted-foreground">
                  cd scraper && python main.py
                </code>
                <p className="text-xs text-muted-foreground mt-2">
                  Run this command in your terminal to start the scraper
                  manually. Use <code>--test</code> flag to limit to 5 pages.
                </p>
              </div>
            </div>

            {/* Database Stats */}
            <div className="p-6 rounded-lg border border-border bg-card">
              <h2 className="text-lg font-semibold mb-4">Database Statistics</h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-md bg-muted">
                  <p className="text-2xl font-bold">
                    {formatCompactNumber(stats?.activeListings ?? 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Active Listings
                  </p>
                </div>
                <div className="p-4 rounded-md bg-muted">
                  <p className="text-2xl font-bold">
                    {formatCompactNumber(stats?.belowMarketCount ?? 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Below Market</p>
                </div>
                <div className="p-4 rounded-md bg-muted">
                  <p className="text-2xl font-bold">
                    {stats?.averagePrice
                      ? `${formatCompactNumber(stats.averagePrice)}`
                      : "—"}
                  </p>
                  <p className="text-sm text-muted-foreground">Avg Price</p>
                </div>
                <div className="p-4 rounded-md bg-muted">
                  <p className="text-2xl font-bold">
                    {stats?.averageMileage
                      ? `${formatCompactNumber(stats.averageMileage)} km`
                      : "—"}
                  </p>
                  <p className="text-sm text-muted-foreground">Avg Mileage</p>
                </div>
              </div>
            </div>

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

            {/* Last Scrape Run */}
            {stats?.lastScrapeRun && (
              <div className="p-6 rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Last Scrape Run</h2>
                  {stats.lastScrapeRun.completedAt && (
                    <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
                      </svg>
                      {new Date(stats.lastScrapeRun.completedAt).toLocaleString("pt-PT", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p
                      className={`font-medium capitalize ${getStatusColor(stats.lastScrapeRun.status)}`}
                    >
                      {stats.lastScrapeRun.status}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Started</p>
                    <p className="font-medium">
                      {stats.lastScrapeRun.startedAt
                        ? formatRelativeDate(
                            new Date(stats.lastScrapeRun.startedAt)
                          )
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Pages Scraped
                    </p>
                    <p className="font-medium">
                      {stats.lastScrapeRun.pagesScraped?.toLocaleString() ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Listings Found
                    </p>
                    <p className="font-medium">
                      {stats.lastScrapeRun.listingsFound?.toLocaleString() ??
                        "—"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">New</p>
                    <p className="font-medium text-success">
                      +{stats.lastScrapeRun.listingsNew?.toLocaleString() ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Updated</p>
                    <p className="font-medium">
                      {stats.lastScrapeRun.listingsUpdated?.toLocaleString() ??
                        0}
                    </p>
                  </div>
                </div>

                {stats.lastScrapeRun.errorMessage && (
                  <div className="mt-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                    {stats.lastScrapeRun.errorMessage}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
