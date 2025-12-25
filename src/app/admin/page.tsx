"use client";

import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui";
import { formatRelativeDate } from "@/lib/utils/format";
import { useLanguage } from "@/lib/i18n";

interface ScrapeDetails {
  api_total_count: number;
  expected_from_pagination: number;
  coverage_percentage: number;
  pages_failed: number;
  failed_page_numbers: number[];
  duration_seconds: number;
  speed_pages_per_min: number;
}

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
  scrapeDetails: ScrapeDetails | null;
  duration: string | null;
  elapsed: string | null;
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
  wasCancelled?: boolean;
  progress?: {
    currentPage: number;
    totalPages: number;
    listingsFound: number;
  };
}

export default function AdminPage() {
  const { language, t } = useLanguage();
  const [stats, setStats] = useState<Stats | null>(null);
  const [scraperStatus, setScraperStatus] = useState<ScraperStatus>({
    isRunning: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const wasRunningRef = useRef(false);
  const pendingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

      // When scraper confirms running, clear pending state
      if (data.isRunning && isPending) {
        setIsPending(false);
        if (pendingTimeoutRef.current) {
          clearTimeout(pendingTimeoutRef.current);
          pendingTimeoutRef.current = null;
        }
      }

      // Detect when scraper finishes (was running, now not running)
      if (wasRunningRef.current && !data.isRunning) {
        setIsPending(false);
        if (pendingTimeoutRef.current) {
          clearTimeout(pendingTimeoutRef.current);
          pendingTimeoutRef.current = null;
        }
        if (data.wasCancelled) {
          setMessage(t.admin.scrapeCancelled || "Scrape was cancelled or timed out");
        } else {
          setMessage(`✓ ${t.admin.scrapeCompleted}`);
        }
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
    const statusInterval = setInterval(fetchScraperStatus, 2000);

    // Poll stats every 5 seconds when scraper is running (to update history table)
    const statsInterval = setInterval(() => {
      if (wasRunningRef.current) {
        fetchStats();
      }
    }, 5000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(statsInterval);
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTriggerScrape = async () => {
    setTriggerLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/scraper/trigger", { method: "POST" });
      const data = await res.json();

      if (res.ok) {
        setMessage(t.admin.scraperStarted);
        setScraperStatus({ isRunning: true });
        wasRunningRef.current = true; // Track that we started a scrape
      } else {
        setMessage(data.error || t.admin.failedToStart);
      }
    } catch {
      setMessage(t.admin.failedToStart);
    } finally {
      setTriggerLoading(false);
    }
  };

  const handleCancelScrape = async () => {
    setCancelLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/scraper/cancel", { method: "POST" });
      const data = await res.json();

      if (res.ok) {
        setMessage(t.admin.scrapeCancelled || "Scrape cancelled");
        setScraperStatus({ isRunning: false });
        wasRunningRef.current = false;
        fetchStats(); // Refresh stats
      } else {
        setMessage(data.error || "Failed to cancel");
      }
    } catch {
      setMessage("Failed to cancel scrape");
    } finally {
      setCancelLoading(false);
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
      case "cancelled":
        return "text-muted-foreground";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-2">{t.admin.title}</h1>
        <p className="text-muted-foreground mb-8">
          {t.admin.description}
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
                <h2 className="text-lg font-semibold">{t.admin.scraperControls}</h2>
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      scraperStatus.isRunning
                        ? "bg-warning animate-pulse"
                        : "bg-muted-foreground"
                    }`}
                  />
                  <span className="text-sm text-muted-foreground">
                    {scraperStatus.isRunning ? t.admin.running : t.admin.idle}
                  </span>
                </div>
              </div>

              {scraperStatus.isRunning && scraperStatus.progress && (
                <div className="mb-4 p-4 rounded-md bg-muted">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{t.admin.progress}</span>
                    <span className="text-sm text-muted-foreground">
                      {t.admin.page} {scraperStatus.progress.currentPage}/
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
                    {t.admin.listingsFound}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleTriggerScrape}
                  disabled={scraperStatus.isRunning || triggerLoading}
                  isLoading={triggerLoading}
                >
                  {scraperStatus.isRunning ? t.admin.scraping : t.admin.startScrape}
                </Button>
                {scraperStatus.isRunning && (
                  <Button
                    onClick={handleCancelScrape}
                    disabled={cancelLoading}
                    isLoading={cancelLoading}
                    variant="ghost"
                    className="border border-destructive text-destructive hover:bg-destructive hover:text-white"
                  >
                    {t.admin.cancelScrape || "Cancel"}
                  </Button>
                )}
              </div>

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
              <h2 className="text-lg font-semibold mb-4">{t.admin.dbStats}</h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-md bg-muted">
                  <p className="text-2xl font-bold">
                    {(stats?.activeListings ?? 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t.admin.activeListings}
                  </p>
                </div>
                <div className="p-4 rounded-md bg-muted">
                  <p className="text-2xl font-bold text-success">
                    {(stats?.belowMarketCount ?? 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">{t.admin.belowMarket}</p>
                </div>
                <div className="p-4 rounded-md bg-muted">
                  <p className="text-2xl font-bold">
                    {(stats?.inMarketCount ?? 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">{t.admin.inMarket}</p>
                </div>
                <div className="p-4 rounded-md bg-muted">
                  <p className="text-2xl font-bold text-destructive">
                    {(stats?.aboveMarketCount ?? 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">{t.admin.aboveMarket}</p>
                </div>
              </div>
            </div>

            {/* Scrape Run History */}
            {stats?.scrapeHistory && stats.scrapeHistory.length > 0 && (
              <div className="p-6 rounded-lg border border-border bg-card">
                <h2 className="text-lg font-semibold mb-4">{t.admin.scrapeHistory}</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">{t.admin.startedAt}</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">{t.admin.status}</th>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground">{t.admin.duration}</th>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground">{t.admin.pages}</th>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground">{t.admin.found}</th>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground">{t.admin.new}</th>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground">{t.admin.updated}</th>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground">{t.admin.unavailable}</th>
                        <th className="text-center py-2 px-2 font-medium text-muted-foreground">{t.admin.info || "Info"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.scrapeHistory.map((run) => (
                        <tr key={run.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 px-2">
                            {run.startedAt
                              ? formatRelativeDate(new Date(run.startedAt), language)
                              : "—"}
                          </td>
                          <td className={`py-2 px-2 capitalize ${getStatusColor(run.status)}`}>
                            {run.status}
                          </td>
                          <td className="py-2 px-2 text-right text-muted-foreground">
                            {run.status === "running" ? run.elapsed : run.duration ?? "—"}
                          </td>
                          <td className="py-2 px-2 text-right">
                            {run.status === "running" && scraperStatus.progress
                              ? `${scraperStatus.progress.currentPage.toLocaleString()}/${scraperStatus.progress.totalPages.toLocaleString()}`
                              : run.pagesScraped?.toLocaleString() ?? "—"}
                          </td>
                          <td className="py-2 px-2 text-right">
                            {run.status === "running" && scraperStatus.progress
                              ? scraperStatus.progress.listingsFound.toLocaleString()
                              : run.listingsFound?.toLocaleString() ?? "—"}
                          </td>
                          <td className="py-2 px-2 text-right text-success">+{run.listingsNew?.toLocaleString() ?? 0}</td>
                          <td className="py-2 px-2 text-right">{run.listingsUpdated?.toLocaleString() ?? 0}</td>
                          <td className="py-2 px-2 text-right text-destructive">-{run.listingsInactive?.toLocaleString() ?? 0}</td>
                          <td className="py-2 px-2 text-center">
                            {(run.scrapeDetails || run.errorMessage) ? (
                              <div className="relative group inline-block">
                                <button
                                  className={`p-1 rounded hover:bg-muted ${
                                    run.scrapeDetails?.pages_failed || run.errorMessage
                                      ? "text-warning"
                                      : "text-muted-foreground"
                                  }`}
                                  aria-label={t.admin.viewDetails || "View details"}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 16v-4" />
                                    <path d="M12 8h.01" />
                                  </svg>
                                </button>
                                <div className="absolute z-50 right-0 bottom-full mb-2 w-64 p-3 rounded-lg bg-popover border border-border shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all text-left text-xs">
                                  {run.scrapeDetails && (
                                    <>
                                      <div className="flex justify-between mb-1">
                                        <span className="text-muted-foreground">{t.admin.apiTotal || "API Total"}:</span>
                                        <span>{run.scrapeDetails.api_total_count?.toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between mb-1">
                                        <span className="text-muted-foreground">{t.admin.coverage || "Coverage"}:</span>
                                        <span className={run.scrapeDetails.coverage_percentage < 95 ? "text-warning" : "text-success"}>
                                          {run.scrapeDetails.coverage_percentage}%
                                        </span>
                                      </div>
                                      <div className="flex justify-between mb-1">
                                        <span className="text-muted-foreground">{t.admin.speed || "Speed"}:</span>
                                        <span>{run.scrapeDetails.speed_pages_per_min} {t.admin.pagesPerMin || "pages/min"}</span>
                                      </div>
                                      {run.scrapeDetails.pages_failed > 0 && (
                                        <div className="flex justify-between mb-1 text-warning">
                                          <span>{t.admin.pagesFailed || "Pages Failed"}:</span>
                                          <span>{run.scrapeDetails.pages_failed}</span>
                                        </div>
                                      )}
                                    </>
                                  )}
                                  {run.errorMessage && (
                                    <div className="mt-2 pt-2 border-t border-border">
                                      <span className="text-destructive">{t.admin.error || "Error"}: {run.errorMessage}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
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
                <h2 className="text-lg font-semibold mb-4">{t.admin.topMakes}</h2>
                <div className="space-y-2">
                  {stats.topMakes.map((item) => (
                    <div
                      key={item.make}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm font-medium">{item.make}</span>
                      <span className="text-sm text-muted-foreground">
                        {item.count.toLocaleString()} {t.admin.listings}
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
