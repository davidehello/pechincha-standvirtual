import { NextResponse } from "next/server";

export async function POST() {
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPO || "davidehello/pechincha-standvirtual";

    if (!githubToken) {
      return NextResponse.json(
        { error: "GitHub token not configured." },
        { status: 400 }
      );
    }

    // Get running workflows
    const runsResponse = await fetch(
      `https://api.github.com/repos/${githubRepo}/actions/workflows/scrape.yml/runs?status=in_progress&per_page=10`,
      {
        headers: {
          "Authorization": `Bearer ${githubToken}`,
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "pechincha-standvirtual",
        },
      }
    );

    if (!runsResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch running workflows" },
        { status: 500 }
      );
    }

    const runsData = await runsResponse.json();

    if (runsData.total_count === 0) {
      return NextResponse.json(
        { error: "No running scrape to cancel" },
        { status: 404 }
      );
    }

    // Cancel all running workflows
    let cancelledCount = 0;
    for (const run of runsData.workflow_runs) {
      const cancelResponse = await fetch(
        `https://api.github.com/repos/${githubRepo}/actions/runs/${run.id}/cancel`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${githubToken}`,
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "pechincha-standvirtual",
          },
        }
      );

      if (cancelResponse.ok || cancelResponse.status === 202) {
        cancelledCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cancelled ${cancelledCount} running workflow(s)`,
    });
  } catch (error) {
    console.error("Error cancelling scraper:", error);
    return NextResponse.json(
      { error: "Failed to cancel scraper" },
      { status: 500 }
    );
  }
}
