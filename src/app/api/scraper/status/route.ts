import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabase();
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPO || "davidehello/pechincha-standvirtual";

    // Check for running scrape in database
    const { data: runningRun, error } = await supabase
      .from('scrape_runs')
      .select('*')
      .eq('status', 'running')
      .order('id', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (runningRun && runningRun.length > 0) {
      const run = runningRun[0];

      // Check if the run has been "running" for too long without a GitHub workflow
      // This handles cases where the workflow was cancelled/timed out but DB wasn't updated
      if (githubToken) {
        try {
          const runsResponse = await fetch(
            `https://api.github.com/repos/${githubRepo}/actions/workflows/scrape.yml/runs?status=in_progress&per_page=1`,
            {
              headers: {
                "Authorization": `Bearer ${githubToken}`,
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "pechincha-standvirtual",
              },
            }
          );

          if (runsResponse.ok) {
            const runsData = await runsResponse.json();

            // No GitHub workflow running, but DB says running - it was cancelled/timed out
            if (runsData.total_count === 0) {
              // Update the database to mark as cancelled
              await supabase
                .from('scrape_runs')
                .update({
                  status: 'cancelled',
                  completed_at: new Date().toISOString(),
                  error_message: 'Workflow cancelled or timed out'
                })
                .eq('id', run.id);

              return NextResponse.json({ isRunning: false, wasCancelled: true });
            }
          }
        } catch (ghError) {
          // If GitHub API fails, just use DB status
          console.error("GitHub API check failed:", ghError);
        }
      }

      return NextResponse.json({ isRunning: true });
    }

    return NextResponse.json({ isRunning: false });
  } catch (error) {
    console.error("Error checking scraper status:", error);
    return NextResponse.json({ isRunning: false });
  }
}
