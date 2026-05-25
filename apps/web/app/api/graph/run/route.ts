import { type NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { return_ids: string[] };
  // Validate input
  if (!Array.isArray(body.return_ids)) {
    return NextResponse.json({ error: "return_ids must be an array" }, { status: 400 });
  }
  // Demo mode: return a mock run_id
  const runId = `run-${Date.now()}`;
  return NextResponse.json({ run_id: runId, status: "started" });
}
