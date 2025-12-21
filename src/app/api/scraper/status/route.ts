import { NextResponse } from "next/server";
import { db, scrapeRuns } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    // Check for running scrape in database
    const runningRun = await db
      .select()
      .from(scrapeRuns)
      .where(eq(scrapeRuns.status, "running"))
      .orderBy(desc(scrapeRuns.id))
      .limit(1);

    if (runningRun.length > 0) {
      // Try to read checkpoint for progress
      const checkpointPath = path.join(
        process.cwd(),
        "scraper",
        "data",
        "checkpoint.json"
      );

      try {
        if (fs.existsSync(checkpointPath)) {
          const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf-8"));
          return NextResponse.json({
            isRunning: true,
            progress: {
              currentPage: checkpoint.last_page,
              totalPages: checkpoint.total_pages,
              listingsFound: checkpoint.listings_found,
            },
          });
        }
      } catch {
        // Checkpoint read failed, just report running
      }

      return NextResponse.json({ isRunning: true });
    }

    return NextResponse.json({ isRunning: false });
  } catch (error) {
    console.error("Error checking scraper status:", error);
    return NextResponse.json({ isRunning: false });
  }
}
