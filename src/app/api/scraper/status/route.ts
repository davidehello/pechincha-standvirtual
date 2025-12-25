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
          // First check for in-progress workflows
          const runsResponse = await fetch(
            `https://api.github.com/repos/${githubRepo}/actions/workflows/scrape.yml/runs?per_page=5`,
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
            const runs = runsData.workflow_runs || [];

            // Check if there's an in-progress workflow
            const inProgressRun = runs.find((r: { status: string }) => r.status === 'in_progress');

            if (inProgressRun) {
              // Workflow is still running
              return NextResponse.json({ isRunning: true });
            }

            // No in-progress workflow - check the most recent completed one
            const recentRun = runs[0];
            if (recentRun) {
              let errorMessage = 'Workflow ended unexpectedly';
              let status = 'cancelled';

              if (recentRun.conclusion === 'failure') {
                status = 'failed';
                errorMessage = 'Workflow failed - check GitHub Actions logs for details';
              } else if (recentRun.conclusion === 'cancelled') {
                status = 'cancelled';
                errorMessage = 'Workflow was cancelled';
              } else if (recentRun.conclusion === 'timed_out') {
                status = 'cancelled';
                errorMessage = 'Workflow timed out';
              } else if (recentRun.conclusion === 'success') {
                // Workflow succeeded but DB wasn't updated - something went wrong
                status = 'failed';
                errorMessage = 'Workflow succeeded but database was not updated';
              }

              // Update the database with the actual status
              await supabase
                .from('scrape_runs')
                .update({
                  status: status,
                  completed_at: new Date().toISOString(),
                  error_message: errorMessage
                })
                .eq('id', run.id);

              return NextResponse.json({
                isRunning: false,
                wasCancelled: status === 'cancelled',
                status: status,
                errorMessage: errorMessage
              });
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
