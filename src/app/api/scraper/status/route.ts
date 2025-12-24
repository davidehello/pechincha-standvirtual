import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabase();

    // Check for running scrape in database
    const { data: runningRun, error } = await supabase
      .from('scrape_runs')
      .select('*')
      .eq('status', 'running')
      .order('id', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (runningRun && runningRun.length > 0) {
      // In Cloudflare Workers, we can't read local files
      // Just report that it's running
      return NextResponse.json({ isRunning: true });
    }

    return NextResponse.json({ isRunning: false });
  } catch (error) {
    console.error("Error checking scraper status:", error);
    return NextResponse.json({ isRunning: false });
  }
}
