import { type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get("runId");
  if (!runId) return new Response("Missing runId", { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const mockEvents = [
        { event_type: "node_started" as const, node_name: "intake_agent", timestamp: new Date().toISOString(), data: {}, cost_delta_usd: 0, total_cost_usd: 0 },
        { event_type: "node_completed" as const, node_name: "intake_agent", timestamp: new Date().toISOString(), data: { latency_ms: 420 }, cost_delta_usd: 0.0004, total_cost_usd: 0.0004 },
        { event_type: "node_started" as const, node_name: "decision_agent", timestamp: new Date().toISOString(), data: {}, cost_delta_usd: 0, total_cost_usd: 0.0004 },
        { event_type: "node_completed" as const, node_name: "decision_agent", timestamp: new Date().toISOString(), data: { disposition: "refurbish", confidence: 0.87 }, cost_delta_usd: 0.0082, total_cost_usd: 0.0086 },
        { event_type: "run_completed" as const, node_name: null, timestamp: new Date().toISOString(), data: {}, cost_delta_usd: 0, total_cost_usd: 0.0086 },
      ];

      for (const event of mockEvents) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        await new Promise<void>((r) => setTimeout(r, 600));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
