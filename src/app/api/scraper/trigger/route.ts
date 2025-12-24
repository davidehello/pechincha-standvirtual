import { NextResponse } from "next/server";

export async function POST() {
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPO || "davidehello/pechincha-standvirtual";

    if (!githubToken) {
      return NextResponse.json(
        { error: "GitHub token not configured. Scraper can only be triggered via GitHub Actions." },
        { status: 400 }
      );
    }

    // Trigger the GitHub Actions workflow
    const response = await fetch(
      `https://api.github.com/repos/${githubRepo}/actions/workflows/scrape.yml/dispatches`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${githubToken}`,
          "Accept": "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: "master",
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GitHub API error:", response.status, errorText);
      return NextResponse.json(
        { error: `Failed to trigger workflow: ${response.status}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Scraper workflow triggered on GitHub Actions. Check back in ~1 minute for results.",
    });
  } catch (error) {
    console.error("Error triggering scraper:", error);
    return NextResponse.json(
      { error: "Failed to trigger scraper" },
      { status: 500 }
    );
  }
}
