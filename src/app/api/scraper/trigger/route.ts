import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export async function POST() {
  try {
    const scraperDir = path.join(process.cwd(), "scraper");

    // Spawn Python process
    const pythonProcess = spawn("python", ["main.py"], {
      cwd: scraperDir,
      detached: true,
      stdio: "ignore",
    });

    // Unref to allow parent to exit independently
    pythonProcess.unref();

    return NextResponse.json({
      success: true,
      message: "Scraper started",
      pid: pythonProcess.pid,
    });
  } catch (error) {
    console.error("Error starting scraper:", error);
    return NextResponse.json(
      { error: "Failed to start scraper" },
      { status: 500 }
    );
  }
}
